import { DetectedIssue, IssueCategory, ScannerSettings } from '../types';

export const DEFAULT_SETTINGS: ScannerSettings = {
  targetYear: new Date().getFullYear(), // e.g. 2026
  checkCopyright: true,
  checkLoremIpsum: true,
  checkDummyText: true,
  checkPlaceholderImages: true,
  checkFakeContacts: true,
  checkUnlinkedAnchors: true,
  customKeywords: [],
};

const LOREM_IPSUM_PATTERNS = [
  /\blorem\s+ipsum\b/i,
  /\bdolor\s+sit\s+amet\b/i,
  /\bconsectetur\s+adipiscing(\s+elit)?\b/i,
  /\bsed\s+do\s+eiusmod\s+tempor\b/i,
  /\but\s+labore\s+et\s+dolore\s+magna\b/i,
  /\baliquip\s+ex\s+ea\s+commodo\s+consequat\b/i,
  /\bduis\s+aute\s+irure\s+dolor\b/i,
  /\breprehenderit\s+in\s+voluptate\b/i,
  /\bcillum\s+dolore\s+eu\s+fugiat\s+nulla\b/i,
  /\bexcepteur\s+sint\s+occaecat\b/i,
  /\bcupidatat\s+non\s+proident\b/i,
  /\bsunt\s+in\s+culpa\s+qui\s+officia\b/i,
  /\bdeserunt\s+mollit\s+anim\s+id\s+est\s+laborum\b/i,
];

const DUMMY_TEXT_PATTERNS = [
  /\b(?:dummy\s+(?:text|content|copy|paragraph|data))\b/i,
  /\b(?:sample\s+(?:text|content|copy|paragraph|data))\b/i,
  /\b(?:placeholder\s+(?:text|content|copy|here))\b/i,
  /\b(?:insert\s+(?:text|content|title|name|here|description|image))\b/i,
  /\b(?:enter\s+(?:text|description|title)\s+here)\b/i,
  /\b(?:test\s+(?:text|content|title))\b/i,
  /\b(?:foo\s+bar|foobar)\b/i,
  /\b(?:asdfgh|qwertyuiop)\b/i,
  /\b(?:TODO|FIXME|TBD|WIP)\s*[:\-]\s*[^\n\r]+/i,
  /\b(?:[A-Z0-9_]{3,}_HERE)\b/,
];

const BRACKET_PLACEHOLDER_PATTERN = /\[\s*(?:company(?:\s+name)?|client(?:\s+name)?|your(?:\s+name)?|author(?:\s+name)?|phone(?:\s+number)?|email(?:\s+address)?|address|city|state|zip|website|url|title|subtitle|date|insert\s+[^\]]+|tbd)\s*\]/i;

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*[\w\.\-]+\s*\}\}|\$\{[\w\.\-]+\}|%[A-Z0-9_\-]+%/;

const FAKE_EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@(?:example\.com|example\.org|example\.net|test\.com|domain\.com|yourdomain\.com|company\.com|site\.com|fake\.com)\b/i;

const FAKE_PHONE_PATTERNS = [
  /\b(?:\+?1[-.\s]?)?\(?555\)?[-.\s]?01[0-9]{2}\b/, // Official 555-0100 through 555-0199 fictional range
  /\b(?:\+?1[-.\s]?)?\(?123\)?[-.\s]?456[-.\s]?7890\b/,
  /\b(?:\+?1[-.\s]?)?\(?000\)?[-.\s]?000[-.\s]?0000\b/,
  /\b1234567890\b/,
];

const PLACEHOLDER_IMAGE_DOMAINS = [
  'via.placeholder.com',
  'placehold.co',
  'dummyimage.com',
  'picsum.photos',
  'placeholder.com',
  'fakeimg.pl',
  'loremflickr.com',
  'placekitten.com',
  'lorempixel.com',
];

/**
 * Scans a text string for dummy words, placeholder variables, and outdated copyright years.
 */
export function analyzeTextSnippet(
  text: string,
  settings: ScannerSettings = DEFAULT_SETTINGS,
  pageUrl: string = ''
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return issues;

  // 1. Check Copyright Year Mismatches
  if (settings.checkCopyright) {
    const copyrightIssues = checkCopyrightYear(trimmed, settings.targetYear, pageUrl);
    issues.push(...copyrightIssues);
  }

  // 2. Check Lorem Ipsum
  if (settings.checkLoremIpsum) {
    for (const pattern of LOREM_IPSUM_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        issues.push({
          id: `lorem-${Math.random().toString(36).substring(2, 9)}`,
          category: 'lorem-ipsum',
          severity: 'high',
          title: 'Lorem Ipsum Placeholder Detected',
          snippet: match[0],
          context: getContextSnippet(trimmed, match.index ?? 0, match[0].length),
          pageUrl,
        });
        break; // Only report once per element for lorem ipsum
      }
    }
  }

  // 3. Check General Dummy Text
  if (settings.checkDummyText) {
    for (const pattern of DUMMY_TEXT_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        issues.push({
          id: `dummy-${Math.random().toString(36).substring(2, 9)}`,
          category: 'dummy-text',
          severity: 'high',
          title: 'Dummy / Placeholder Text Detected',
          snippet: match[0],
          context: getContextSnippet(trimmed, match.index ?? 0, match[0].length),
          pageUrl,
        });
        break;
      }
    }

    // Bracket placeholders e.g. [Company Name]
    const bracketMatch = trimmed.match(BRACKET_PLACEHOLDER_PATTERN);
    if (bracketMatch) {
      issues.push({
        id: `bracket-${Math.random().toString(36).substring(2, 9)}`,
        category: 'template-variable',
        severity: 'high',
        title: 'Bracketed Placeholder Detected',
        snippet: bracketMatch[0],
        context: getContextSnippet(trimmed, bracketMatch.index ?? 0, bracketMatch[0].length),
        pageUrl,
      });
    }

    // Template variables e.g. {{ company_name }}
    const tmplMatch = trimmed.match(TEMPLATE_VARIABLE_PATTERN);
    if (tmplMatch) {
      issues.push({
        id: `tmpl-${Math.random().toString(36).substring(2, 9)}`,
        category: 'template-variable',
        severity: 'medium',
        title: 'Unrendered Template Variable Detected',
        snippet: tmplMatch[0],
        context: getContextSnippet(trimmed, tmplMatch.index ?? 0, tmplMatch[0].length),
        pageUrl,
      });
    }
  }

  // 4. Check Fake / Example Contacts
  if (settings.checkFakeContacts) {
    const emailMatch = trimmed.match(FAKE_EMAIL_PATTERN);
    if (emailMatch) {
      issues.push({
        id: `email-${Math.random().toString(36).substring(2, 9)}`,
        category: 'fake-contact',
        severity: 'medium',
        title: 'Placeholder / Example Email Detected',
        snippet: emailMatch[0],
        context: getContextSnippet(trimmed, emailMatch.index ?? 0, emailMatch[0].length),
        pageUrl,
      });
    }

    for (const phonePattern of FAKE_PHONE_PATTERNS) {
      const phoneMatch = trimmed.match(phonePattern);
      if (phoneMatch) {
        issues.push({
          id: `phone-${Math.random().toString(36).substring(2, 9)}`,
          category: 'fake-contact',
          severity: 'medium',
          title: 'Fictional / Placeholder Phone Number Detected',
          snippet: phoneMatch[0],
          context: getContextSnippet(trimmed, phoneMatch.index ?? 0, phoneMatch[0].length),
          pageUrl,
        });
        break;
      }
    }
  }

  // 5. Check Custom User Keywords
  if (settings.customKeywords && settings.customKeywords.length > 0) {
    for (const keyword of settings.customKeywords) {
      if (!keyword.trim()) continue;
      const regex = new RegExp(`\\b${escapeRegExp(keyword.trim())}\\b`, 'i');
      const match = trimmed.match(regex);
      if (match) {
        issues.push({
          id: `custom-${Math.random().toString(36).substring(2, 9)}`,
          category: 'dummy-text',
          severity: 'medium',
          title: `Custom Target Keyword Detected ("${keyword}")`,
          snippet: match[0],
          context: getContextSnippet(trimmed, match.index ?? 0, match[0].length),
          pageUrl,
        });
      }
    }
  }

  return issues;
}

/**
 * Checks for copyright notices and detects if the year is outdated (e.g. 2025 vs 2026).
 */
export function checkCopyrightYear(
  text: string,
  targetYear: number,
  pageUrl: string = ''
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // Match: (©|&copy;|(c)|copyright) followed by optional start year and ending year
  // e.g., "© 2024", "Copyright 2018-2025", "© 2015 - 2024", "(c) 2025"
  const copyrightRegex = /(?:©|&copy;|\(c\)|copyright(?:\s+notice)?)\s*(?:(?:\d{4})\s*[-–—/]\s*)?(\d{4})/gi;
  
  let match: RegExpExecArray | null;
  while ((match = copyrightRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const foundYear = parseInt(match[1], 10);

    if (foundYear > 1990 && foundYear < targetYear) {
      issues.push({
        id: `copyright-${Math.random().toString(36).substring(2, 9)}`,
        category: 'outdated-copyright',
        severity: 'high',
        title: `Outdated Copyright Year (${foundYear} vs current ${targetYear})`,
        snippet: fullMatch,
        context: getContextSnippet(text, match.index, fullMatch.length),
        pageUrl,
        meta: {
          foundYear,
          expectedYear: targetYear,
          matchText: fullMatch,
        },
      });
    }
  }

  // Check for placeholder copyright notice like "© [Year]" or "© YYYY"
  const placeholderCopyrightRegex = /(?:©|&copy;|\(c\)|copyright)\s*(?:\[\s*(?:year|date)\s*\]|yyyy|20xx)/i;
  const placeholderMatch = text.match(placeholderCopyrightRegex);
  if (placeholderMatch) {
    issues.push({
      id: `copyright-ph-${Math.random().toString(36).substring(2, 9)}`,
      category: 'outdated-copyright',
      severity: 'high',
      title: 'Unfilled Copyright Year Placeholder',
      snippet: placeholderMatch[0],
      context: getContextSnippet(text, placeholderMatch.index ?? 0, placeholderMatch[0].length),
      pageUrl,
    });
  }

  return issues;
}

/**
 * Checks an image src or element for dummy/placeholder indicators.
 */
export function checkImageElement(
  imgSrc: string,
  altText: string = '',
  pageUrl: string = ''
): DetectedIssue | null {
  if (!imgSrc) return null;

  // Domain checks
  const isPlaceholderDomain = PLACEHOLDER_IMAGE_DOMAINS.some(domain => imgSrc.toLowerCase().includes(domain));
  if (isPlaceholderDomain) {
    return {
      id: `img-${Math.random().toString(36).substring(2, 9)}`,
      category: 'placeholder-image',
      severity: 'high',
      title: 'Placeholder Image Service Detected',
      snippet: imgSrc.length > 80 ? `${imgSrc.substring(0, 80)}...` : imgSrc,
      context: altText ? `Alt: "${altText}"` : `Src: ${imgSrc}`,
      pageUrl,
    };
  }

  // Filename or Alt text checks
  const placeholderNameRegex = /(?:placeholder|dummy|sample|temp|fake)[-_]?(?:image|photo|pic|banner|thumb)?\.(?:png|jpe?g|webp|gif|svg)/i;
  if (placeholderNameRegex.test(imgSrc)) {
    return {
      id: `img-${Math.random().toString(36).substring(2, 9)}`,
      category: 'placeholder-image',
      severity: 'medium',
      title: 'Placeholder Image Filename Detected',
      snippet: imgSrc.split('/').pop() || imgSrc,
      context: `Src: ${imgSrc}`,
      pageUrl,
    };
  }

  if (altText && /\b(?:placeholder|dummy image|sample image|insert image)\b/i.test(altText)) {
    return {
      id: `img-${Math.random().toString(36).substring(2, 9)}`,
      category: 'placeholder-image',
      severity: 'medium',
      title: 'Placeholder Alt Text Detected',
      snippet: altText,
      context: `Image Alt Text: "${altText}"`,
      pageUrl,
    };
  }

  return null;
}

/**
 * Checks an anchor href for placeholder hash / broken links e.g. href="#", href="#!", href="javascript:void(0)".
 */
export function checkAnchorElement(
  href: string,
  linkText: string = '',
  pageUrl: string = ''
): DetectedIssue | null {
  const trimmedHref = (href || '').trim();
  const trimmedText = (linkText || '').replace(/\s+/g, ' ').trim();

  // Flag empty href or exact '#' or '#!' or '#?' or '#/' or 'javascript:void(0)' or 'javascript:;'
  const isDummyHash = 
    trimmedHref === '#' || 
    trimmedHref === '#!' || 
    trimmedHref === '#/' || 
    trimmedHref === '#?' || 
    trimmedHref === 'javascript:void(0)' || 
    trimmedHref === 'javascript:void(0);' || 
    trimmedHref === 'javascript:;' || 
    trimmedHref === '' ||
    trimmedHref.toLowerCase() === '#placeholder';

  if (isDummyHash) {
    const label = trimmedText ? `"${trimmedText}"` : 'Unlabeled Link/Button';
    return {
      id: `anchor-${Math.random().toString(36).substring(2, 9)}`,
      category: 'unlinked-anchor',
      severity: 'high',
      title: `Unlinked Placeholder Anchor (${trimmedHref || 'empty href'})`,
      snippet: `<a href="${trimmedHref || ''}"> ${label} </a>`,
      context: `Link text: ${label} with dummy destination href="${trimmedHref}"`,
      pageUrl,
    };
  }

  return null;
}

/**
 * Scans an entire HTML string (used by crawler for background pages).
 */
export function scanHtmlString(
  html: string,
  url: string,
  settings: ScannerSettings = DEFAULT_SETTINGS
): { issues: DetectedIssue[]; title: string } {
  const issues: DetectedIssue[] = [];
  
  // Extract Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : url;

  // Remove scripts, styles, noscript, svg to avoid false positives
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');

  // Extract text and analyze
  // Match text nodes between tags
  const textMatches = sanitized.match(/>([^<]+)</g);
  if (textMatches) {
    for (const raw of textMatches) {
      const text = raw.substring(1, raw.length - 1).trim();
      if (text.length > 2) {
        const found = analyzeTextSnippet(text, settings, url);
        issues.push(...found);
      }
    }
  }

  // Check images in HTML string
  if (settings.checkPlaceholderImages) {
    const imgMatches = sanitized.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const src = match[1];
      const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : '';
      const imgIssue = checkImageElement(src, alt, url);
      if (imgIssue) {
        issues.push(imgIssue);
      }
    }
  }

  // Check unlinked anchors in HTML string
  if (settings.checkUnlinkedAnchors) {
    const anchorMatches = sanitized.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis);
    for (const match of anchorMatches) {
      const href = match[1];
      const innerHtml = match[2];
      const text = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const anchorIssue = checkAnchorElement(href, text, url);
      if (anchorIssue) {
        issues.push(anchorIssue);
      }
    }
  }

  return { issues: deduplicateIssues(issues), title };
}

/**
 * Deduplicates issues found on the exact same DOM element or identical node location.
 * Allows multiple distinct elements across the page with identical dummy text
 * (e.g. 2 different Lorem Ipsum sections) to each be reported and highlighted individually.
 */
export function deduplicateIssues(issues: DetectedIssue[]): DetectedIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    // If element has a highlightId (active DOM inspection), each distinct element is a unique issue!
    // We only deduplicate if the EXACT SAME element somehow received multiple duplicate entries of the same category
    if (issue.highlightId) {
      const key = `${issue.highlightId}|${issue.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }
    // For crawler / raw HTML without highlightId, preserve distinct occurrences by unique issue ID
    const key = issue.id || `${issue.pageUrl}|${issue.category}|${issue.context}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getContextSnippet(fullText: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 35);
  const end = Math.min(fullText.length, matchIndex + matchLength + 35);
  let snippet = fullText.substring(start, end).replace(/\s+/g, ' ');
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  return snippet;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
