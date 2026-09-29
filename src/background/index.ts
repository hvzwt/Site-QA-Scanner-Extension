import { scanHtmlString, DEFAULT_SETTINGS } from '../engine/detector';
import { ExtensionMessage, PageAuditResult, ScannerSettings, SiteAuditProgress } from '../types';

let isCrawlCancelled = false;

// Configure side panel to open on toolbar action icon click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(err => {
      console.warn('Side panel open behavior could not be set:', err);
    });
  }
});

// Also handle action click directly as fallback
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && chrome.sidePanel && chrome.sidePanel.open) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle Background Crawl & Audit Messages
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'START_SITE_AUDIT') {
    handleSiteAudit(message.urls, message.settings as ScannerSettings || DEFAULT_SETTINGS);
    sendResponse({ started: true });
    return true;
  }

  if (message.type === 'CANCEL_SITE_AUDIT') {
    isCrawlCancelled = true;
    sendResponse({ cancelled: true });
    return true;
  }
});

/**
 * Iterates through approved URLs, fetches page HTML, runs detection engine, and emits progress.
 */
async function handleSiteAudit(urls: string[], settings: ScannerSettings) {
  isCrawlCancelled = false;
  const results: PageAuditResult[] = [];
  const total = urls.length;

  for (let i = 0; i < total; i++) {
    if (isCrawlCancelled) {
      break;
    }

    const url = urls[i];
    const progress: SiteAuditProgress = {
      current: i + 1,
      total,
      currentUrl: url,
    };

    // Notify UI of progress
    chrome.runtime.sendMessage({
      type: 'SITE_AUDIT_PROGRESS',
      progress,
    }).catch(() => {
      // Sidepanel might be closed or busy
    });

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const { issues, title } = scanHtmlString(html, url, settings);

      const stats = {
        total: issues.length,
        loremIpsum: issues.filter(issue => issue.category === 'lorem-ipsum').length,
        dummyText: issues.filter(issue => issue.category === 'dummy-text').length,
        outdatedCopyright: issues.filter(issue => issue.category === 'outdated-copyright').length,
        placeholderMedia: issues.filter(issue => issue.category === 'placeholder-image').length,
        templateVariables: issues.filter(issue => issue.category === 'template-variable').length,
        unlinkedAnchors: issues.filter(issue => issue.category === 'unlinked-anchor').length,
      };

      results.push({
        url,
        title,
        timestamp: Date.now(),
        status: 'success',
        issues,
        stats,
      });
    } catch (err: any) {
      results.push({
        url,
        title: url,
        timestamp: Date.now(),
        status: 'error',
        errorMessage: err.message || 'Failed to fetch page',
        issues: [],
        stats: {
          total: 0,
          loremIpsum: 0,
          dummyText: 0,
          outdatedCopyright: 0,
          placeholderMedia: 0,
          templateVariables: 0,
          unlinkedAnchors: 0,
        },
      });
    }

    // Gentle throttle between requests (150ms) to prevent server rate limiting
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Save results in storage
  await chrome.storage.local.set({ lastSiteAuditResults: results });

  // Notify UI of completion
  chrome.runtime.sendMessage({
    type: 'SITE_AUDIT_COMPLETE',
    results,
  }).catch(() => {});
}
