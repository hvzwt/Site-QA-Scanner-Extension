export type IssueCategory = 
  | 'lorem-ipsum'
  | 'dummy-text'
  | 'template-variable'
  | 'placeholder-image'
  | 'outdated-copyright'
  | 'fake-contact'
  | 'unlinked-anchor';

export type IssueSeverity = 'high' | 'medium' | 'low';

export interface DetectedIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  snippet: string;
  context: string;
  pageUrl: string;
  elementSelector?: string;
  highlightId?: string;
  meta?: {
    foundYear?: number;
    expectedYear?: number;
    matchText?: string;
  };
}

export interface PageAuditStats {
  total: number;
  loremIpsum: number;
  dummyText: number;
  outdatedCopyright: number;
  placeholderMedia: number;
  templateVariables: number;
  unlinkedAnchors: number;
}

export interface PageAuditResult {
  url: string;
  title: string;
  timestamp: number;
  status: 'success' | 'error';
  errorMessage?: string;
  issues: DetectedIssue[];
  stats: PageAuditStats;
}

export interface SiteAuditProgress {
  current: number;
  total: number;
  currentUrl: string;
}

export interface ScannerSettings {
  targetYear: number;
  checkCopyright: boolean;
  checkLoremIpsum: boolean;
  checkDummyText: boolean;
  checkPlaceholderImages: boolean;
  checkFakeContacts: boolean;
  checkUnlinkedAnchors: boolean;
  customKeywords: string[];
}

export interface ContentComparisonItem {
  id: string;
  type: 'exact' | 'mismatch' | 'missing' | 'extra';
  approvedText: string;
  liveText?: string;
  similarity: number; // 0 to 1
  elementSelector?: string;
  highlightId?: string;
}

export interface ComparisonReport {
  sourceUrl: string;
  sourceType: 'google-doc' | 'figma' | 'manual';
  pageUrl: string;
  matchScore: number; // 0 - 100%
  totalApprovedBlocks: number;
  exactMatches: number;
  mismatches: number;
  missingFromPage: number;
  items: ContentComparisonItem[];
}

export interface LiveContentBlock {
  text: string;
  elementSelector: string;
  highlightId: string;
}

export type ExtensionMessage =
  | { type: 'SCAN_ACTIVE_TAB'; settings?: Partial<ScannerSettings> }
  | { type: 'SCAN_ACTIVE_TAB_RESULT'; data: PageAuditResult }
  | { type: 'HIGHLIGHT_ELEMENT'; highlightId: string }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'DISCOVER_INTERNAL_LINKS' }
  | { type: 'DISCOVER_INTERNAL_LINKS_RESULT'; links: string[] }
  | { type: 'START_SITE_AUDIT'; urls: string[]; settings?: Partial<ScannerSettings> }
  | { type: 'SITE_AUDIT_PROGRESS'; progress: SiteAuditProgress }
  | { type: 'SITE_AUDIT_COMPLETE'; results: PageAuditResult[] }
  | { type: 'CANCEL_SITE_AUDIT' }
  | { type: 'EXTRACT_PAGE_CONTENT_BLOCKS' }
  | { type: 'EXTRACT_PAGE_CONTENT_BLOCKS_RESULT'; blocks: LiveContentBlock[] };
