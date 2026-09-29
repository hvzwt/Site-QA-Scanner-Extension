import { analyzeTextSnippet, checkImageElement, checkAnchorElement, DEFAULT_SETTINGS, deduplicateIssues } from '../engine/detector';
import { DetectedIssue, ExtensionMessage, PageAuditResult, ScannerSettings, LiveContentBlock } from '../types';

let currentHighlightedEl: HTMLElement | null = null;
const HIGHLIGHT_ATTR = 'data-site-qa-id';

/**
 * Scans active DOM tree for dummy content and outdated copyright.
 */
function scanActiveDOM(settings: ScannerSettings = DEFAULT_SETTINGS): PageAuditResult {
  const issues: DetectedIssue[] = [];
  const currentUrl = window.location.href;
  const pageTitle = document.title || currentUrl;

  // Clear previous markers
  clearHighlights();

  // 1. Traverse visible text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'svg', 'iframe', 'canvas'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Ignore hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }

        if (!node.textContent || node.textContent.trim().length < 2) {
          return NodeFilter.FILTER_SKIP;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    const text = currentNode.textContent || '';
    const foundIssues = analyzeTextSnippet(text, settings, currentUrl);

    if (foundIssues.length > 0) {
      const parentEl = currentNode.parentElement;
      if (parentEl) {
        // Reuse existing highlight target if this text node is inside an already-flagged element
        const existingTarget = parentEl.closest('.sqa-detected-issue-target') as HTMLElement | null;
        let targetEl: HTMLElement;
        let highlightId: string;

        if (existingTarget) {
          targetEl = existingTarget;
          highlightId = existingTarget.getAttribute(HIGHLIGHT_ATTR) || `sqa-${Math.random().toString(36).substring(2, 9)}`;
        } else {
          targetEl = parentEl;
          highlightId = `sqa-${Math.random().toString(36).substring(2, 9)}`;
          targetEl.setAttribute(HIGHLIGHT_ATTR, highlightId);
          targetEl.classList.add('sqa-detected-issue-target');
        }

        for (const issue of foundIssues) {
          issue.highlightId = highlightId;
          issue.elementSelector = getElementSelector(targetEl);
          issues.push(issue);
        }
      }
    }
  }

  // 2. Scan Image Elements
  if (settings.checkPlaceholderImages) {
    const images = Array.from(document.querySelectorAll('img'));
    for (const img of images) {
      const src = img.src || img.getAttribute('data-src') || '';
      const alt = img.alt || '';
      const imgIssue = checkImageElement(src, alt, currentUrl);

      if (imgIssue) {
        const highlightId = `sqa-img-${Math.random().toString(36).substring(2, 9)}`;
        img.setAttribute(HIGHLIGHT_ATTR, highlightId);
        img.classList.add('sqa-detected-issue-target');
        imgIssue.highlightId = highlightId;
        imgIssue.elementSelector = getElementSelector(img);
        issues.push(imgIssue);
      }
    }
  }

  // 3. Scan Anchor Tags for Dummy / # Links
  if (settings.checkUnlinkedAnchors) {
    const anchors = Array.from(document.querySelectorAll('a'));
    for (const anchor of anchors) {
      const rawHref = anchor.getAttribute('href') ?? '';
      const text = anchor.textContent || anchor.getAttribute('aria-label') || '';
      const anchorIssue = checkAnchorElement(rawHref, text, currentUrl);

      if (anchorIssue) {
        const highlightId = `sqa-anchor-${Math.random().toString(36).substring(2, 9)}`;
        anchor.setAttribute(HIGHLIGHT_ATTR, highlightId);
        anchor.classList.add('sqa-detected-issue-target');
        anchorIssue.highlightId = highlightId;
        anchorIssue.elementSelector = getElementSelector(anchor);
        issues.push(anchorIssue);
      }
    }
  }

  const dedupedIssues = deduplicateIssues(issues);

  // Compute stats
  const stats = {
    total: dedupedIssues.length,
    loremIpsum: dedupedIssues.filter(i => i.category === 'lorem-ipsum').length,
    dummyText: dedupedIssues.filter(i => i.category === 'dummy-text').length,
    outdatedCopyright: dedupedIssues.filter(i => i.category === 'outdated-copyright').length,
    placeholderMedia: dedupedIssues.filter(i => i.category === 'placeholder-image').length,
    templateVariables: dedupedIssues.filter(i => i.category === 'template-variable').length,
    unlinkedAnchors: dedupedIssues.filter(i => i.category === 'unlinked-anchor').length,
  };

  injectHighlightStyles();

  return {
    url: currentUrl,
    title: pageTitle,
    timestamp: Date.now(),
    status: 'success',
    issues: dedupedIssues,
    stats,
  };
}

/**
 * Discovers internal same-origin links on the current page.
 */
function discoverInternalLinks(): string[] {
  const currentOrigin = window.location.origin;
  const links = new Set<string>();
  links.add(window.location.href.split('#')[0]); // Include current page

  const anchorElements = Array.from(document.querySelectorAll('a[href]'));
  const excludedExtensions = /\.(pdf|zip|tar|gz|exe|docx?|xlsx?|pptx?|jpe?g|png|gif|svg|webp|mp4|mp3|wav)$/i;

  for (const anchor of anchorElements) {
    const rawHref = anchor.getAttribute('href');
    if (!rawHref) continue;

    // Skip mailto, tel, javascript, hash-only
    if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) {
      continue;
    }

    try {
      const url = new URL(rawHref, window.location.href);
      if (url.origin === currentOrigin) {
        // Strip fragment (#)
        url.hash = '';
        const cleanUrl = url.href;
        if (!excludedExtensions.test(url.pathname)) {
          links.add(cleanUrl);
        }
      }
    } catch {
      // Invalid URL
    }
  }

  return Array.from(links);
}

/**
 * Scrolls to and flashes element with highlightId.
 */
function highlightElementById(highlightId: string) {
  const el = document.querySelector(`[${HIGHLIGHT_ATTR}="${highlightId}"]`) as HTMLElement;
  if (!el) return;

  if (currentHighlightedEl) {
    currentHighlightedEl.classList.remove('sqa-active-focus');
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('sqa-active-focus');
  currentHighlightedEl = el;

  // Add floating banner tooltip
  showFloatingBadge(el);
}

function showFloatingBadge(el: HTMLElement) {
  const existing = document.getElementById('sqa-floating-indicator');
  if (existing) existing.remove();

  const rect = el.getBoundingClientRect();
  const badge = document.createElement('div');
  badge.id = 'sqa-floating-indicator';
  badge.innerHTML = `
    <div style="
      position: absolute;
      top: ${rect.top + window.scrollY - 34}px;
      left: ${Math.max(10, rect.left + window.scrollX)}px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 4px 10px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
      transition: opacity 0.3s;
    ">
      <span>⚠️ Site QA Flagged Issue</span>
    </div>
  `;
  document.body.appendChild(badge);

  setTimeout(() => {
    badge.style.opacity = '0';
    setTimeout(() => badge.remove(), 400);
  }, 4000);
}

function clearHighlights() {
  const targets = document.querySelectorAll('.sqa-detected-issue-target');
  targets.forEach(el => {
    el.removeAttribute(HIGHLIGHT_ATTR);
    el.classList.remove('sqa-detected-issue-target', 'sqa-active-focus');
  });
  const badge = document.getElementById('sqa-floating-indicator');
  if (badge) badge.remove();
}

function injectHighlightStyles() {
  if (document.getElementById('sqa-injected-styles')) return;

  const style = document.createElement('style');
  style.id = 'sqa-injected-styles';
  style.textContent = `
    .sqa-detected-issue-target {
      outline: 2px dashed rgba(239, 68, 68, 0.7) !important;
      outline-offset: 3px !important;
      background-color: rgba(254, 226, 226, 0.25) !important;
      transition: all 0.2s ease !important;
    }
    .sqa-active-focus {
      outline: 3px solid #ef4444 !important;
      outline-offset: 4px !important;
      animation: sqa-pulse-glow 1.5s infinite alternate !important;
      background-color: rgba(254, 202, 202, 0.6) !important;
    }
    @keyframes sqa-pulse-glow {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      100% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
    }
  `;
  document.head.appendChild(style);
}

function getElementSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let selector = current.nodeName.toLowerCase();
    if (current.className && typeof current.className === 'string') {
      const firstClass = current.className.trim().split(/\s+/)[0];
      if (firstClass && !firstClass.startsWith('sqa-')) {
        selector += `.${firstClass}`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
    if (parts.length >= 3) break;
  }
  return parts.join(' > ');
}

// Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'SCAN_ACTIVE_TAB') {
    const result = scanActiveDOM(message.settings as ScannerSettings || DEFAULT_SETTINGS);
    sendResponse({ type: 'SCAN_ACTIVE_TAB_RESULT', data: result });
    return true;
  }

  if (message.type === 'HIGHLIGHT_ELEMENT') {
    highlightElementById(message.highlightId);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLEAR_HIGHLIGHTS') {
    clearHighlights();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'DISCOVER_INTERNAL_LINKS') {
    const links = discoverInternalLinks();
    sendResponse({ type: 'DISCOVER_INTERNAL_LINKS_RESULT', links });
    return true;
  }

  if (message.type === 'EXTRACT_PAGE_CONTENT_BLOCKS') {
    const blocks = extractPageContentBlocks();
    sendResponse({ type: 'EXTRACT_PAGE_CONTENT_BLOCKS_RESULT', blocks });
    return true;
  }
});

/**
 * Extracts visible textual blocks from the page for content verification.
 */
function extractPageContentBlocks(): LiveContentBlock[] {
  const blocks: LiveContentBlock[] = [];
  const visitedElements = new Set<Element>();

  const candidates = Array.from(
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, button, a, .text, .title, .subheading, .description, [role="heading"]')
  );

  for (const el of candidates) {
    if (visitedElements.has(el)) continue;

    // Check visibility
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }

    const directText = el.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (directText.length < 2) continue;

    // Assign highlight ID for on-page locator
    let highlightId = el.getAttribute(HIGHLIGHT_ATTR);
    if (!highlightId) {
      highlightId = `sqa-comp-${Math.random().toString(36).substring(2, 9)}`;
      el.setAttribute(HIGHLIGHT_ATTR, highlightId);
      el.classList.add('sqa-detected-issue-target');
    }

    blocks.push({
      text: directText,
      elementSelector: getElementSelector(el),
      highlightId,
    });

    visitedElements.add(el);
  }

  injectHighlightStyles();
  return blocks;
}
