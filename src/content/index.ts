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

  // 4. Scan HTML Structure & SEO Quality
  if (settings.checkHtmlStructure) {
    const structIssues = scanActiveDOMStructure(currentUrl);
    issues.push(...structIssues);
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
    htmlStructure: dedupedIssues.filter(i => i.category === 'html-structure').length,
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
 * Scans active DOM for HTML structure, heading hierarchy, meta tags, and semantic landmarks.
 */
function scanActiveDOMStructure(url: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // 1. Heading Hierarchy Analysis in Live DOM
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
  const h1Elements = headings.filter(h => h.tagName.toLowerCase() === 'h1');

  if (headings.length > 0 && h1Elements.length === 0) {
    const target = document.body;
    const highlightId = `sqa-struct-h1-${Math.random().toString(36).substring(2, 9)}`;
    target.setAttribute(HIGHLIGHT_ATTR, highlightId);
    target.classList.add('sqa-detected-issue-target');

    issues.push({
      id: `struct-h1-missing-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'high',
      title: 'Missing <h1> Primary Heading',
      snippet: 'No <h1> element found on page',
      context: 'Page contains headings but lacks an <h1> primary header.',
      pageUrl: url,
      highlightId,
      elementSelector: 'body',
    });
  } else if (h1Elements.length > 1) {
    for (let i = 1; i < h1Elements.length; i++) {
      const h1 = h1Elements[i];
      const highlightId = `sqa-struct-h1-multi-${Math.random().toString(36).substring(2, 9)}`;
      h1.setAttribute(HIGHLIGHT_ATTR, highlightId);
      h1.classList.add('sqa-detected-issue-target');

      issues.push({
        id: `struct-h1-multiple-${Math.random().toString(36).substring(2, 9)}`,
        category: 'html-structure',
        severity: 'medium',
        title: `Multiple <h1> Headings Detected (${h1Elements.length} total)`,
        snippet: h1.textContent?.trim() || '<h1>',
        context: `Extra <h1> heading tag found. Best practice is to have exactly one <h1> per page.`,
        pageUrl: url,
        highlightId,
        elementSelector: getElementSelector(h1),
      });
    }
  }

  // Heading Level Skips
  let prevLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName.substring(1), 10);
    const text = h.textContent?.trim() || h.tagName;

    if (prevLevel > 0 && level > prevLevel + 1) {
      const highlightId = `sqa-struct-hskip-${Math.random().toString(36).substring(2, 9)}`;
      h.setAttribute(HIGHLIGHT_ATTR, highlightId);
      h.classList.add('sqa-detected-issue-target');

      issues.push({
        id: `struct-h-skip-${Math.random().toString(36).substring(2, 9)}`,
        category: 'html-structure',
        severity: 'medium',
        title: `Skipped Heading Level (<h${prevLevel}> to <h${level}>)`,
        snippet: `<h${level}> ${text} </h${level}>`,
        context: `Heading level skipped from <h${prevLevel}> directly to <h${level}> without an <h${prevLevel + 1}>.`,
        pageUrl: url,
        highlightId,
        elementSelector: getElementSelector(h),
      });
    }
    prevLevel = level;
  }

  // 2. Meta Title & Description
  const titleText = (document.title || '').trim();
  if (!titleText) {
    issues.push({
      id: `struct-title-missing-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'high',
      title: 'Missing or Empty Page Title (<title>)',
      snippet: '<title></title>',
      context: 'The document lacks a valid <title> tag in <head>.',
      pageUrl: url,
    });
  } else if (titleText.length < 10) {
    issues.push({
      id: `struct-title-short-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'low',
      title: `Page Title Too Short (${titleText.length} chars)`,
      snippet: titleText,
      context: `Title "${titleText}" is under recommended 10 character minimum for SEO.`,
      pageUrl: url,
    });
  } else if (titleText.length > 70) {
    issues.push({
      id: `struct-title-long-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'low',
      title: `Page Title Too Long (${titleText.length} chars)`,
      snippet: titleText,
      context: `Title is ${titleText.length} characters (recommended maximum is 60-70 characters).`,
      pageUrl: url,
    });
  }

  const metaDescEl = document.querySelector('meta[name="description"]');
  if (!metaDescEl) {
    issues.push({
      id: `struct-desc-missing-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'high',
      title: 'Missing Meta Description (<meta name="description">)',
      snippet: '<meta name="description" content="...">',
      context: 'No meta description tag was found in the document <head>.',
      pageUrl: url,
    });
  } else {
    const descText = (metaDescEl.getAttribute('content') || '').trim();
    if (!descText) {
      issues.push({
        id: `struct-desc-empty-${Math.random().toString(36).substring(2, 9)}`,
        category: 'html-structure',
        severity: 'high',
        title: 'Empty Meta Description Content',
        snippet: '<meta name="description" content="">',
        context: 'Meta description tag exists but content attribute is empty.',
        pageUrl: url,
      });
    } else if (descText.length < 50) {
      issues.push({
        id: `struct-desc-short-${Math.random().toString(36).substring(2, 9)}`,
        category: 'html-structure',
        severity: 'low',
        title: `Meta Description Too Short (${descText.length} chars)`,
        snippet: descText,
        context: `Meta description is ${descText.length} characters (recommended 50 - 160 characters).`,
        pageUrl: url,
      });
    } else if (descText.length > 160) {
      issues.push({
        id: `struct-desc-long-${Math.random().toString(36).substring(2, 9)}`,
        category: 'html-structure',
        severity: 'low',
        title: `Meta Description Too Long (${descText.length} chars)`,
        snippet: descText,
        context: `Meta description is ${descText.length} characters (will be truncated in search results above 160 chars).`,
        pageUrl: url,
      });
    }
  }

  // 3. Semantic Landmark Tags
  const mainEl = document.querySelector('main, [role="main"]');
  if (!mainEl) {
    issues.push({
      id: `struct-main-missing-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'medium',
      title: 'Missing <main> Landmark Container',
      snippet: '<main> ... </main>',
      context: 'Document lacks a <main> semantic landmark tag for main content accessibility.',
      pageUrl: url,
    });
  }

  const divElements = document.querySelectorAll('div');
  const semanticElements = document.querySelectorAll('section, article, header, footer, nav');
  if (divElements.length >= 10 && semanticElements.length === 0) {
    issues.push({
      id: `struct-div-soup-${Math.random().toString(36).substring(2, 9)}`,
      category: 'html-structure',
      severity: 'medium',
      title: 'Non-Semantic Layout Structure (Div Soup)',
      snippet: `${divElements.length} <div> elements with 0 semantic landmark tags`,
      context: `Page uses ${divElements.length} <div> elements but lacks semantic layout tags like <section>, <article>, or <nav>.`,
      pageUrl: url,
    });
  }

  return issues;
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
