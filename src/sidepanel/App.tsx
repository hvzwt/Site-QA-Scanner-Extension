import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SinglePageAudit } from './components/SinglePageAudit';
import { FullSiteAudit } from './components/FullSiteAudit';
import { SettingsTab } from './components/SettingsTab';
import { DEFAULT_SETTINGS } from '../engine/detector';
import { PageAuditResult, ScannerSettings, SiteAuditProgress, ExtensionMessage } from '../types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'site' | 'settings'>('single');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  // Settings State
  const [settings, setSettings] = useState<ScannerSettings>(DEFAULT_SETTINGS);

  // Single Page State
  const [pageResult, setPageResult] = useState<PageAuditResult | null>(null);
  const [isScanningSingle, setIsScanningSingle] = useState(false);

  // Full Site State
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isAuditingSite, setIsAuditingSite] = useState(false);
  const [siteProgress, setSiteProgress] = useState<SiteAuditProgress | null>(null);
  const [siteResults, setSiteResults] = useState<PageAuditResult[]>([]);

  // 1. Initialize Active Tab Info & Saved Settings
  useEffect(() => {
    // Load Settings
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['scannerSettings', 'lastSiteAuditResults'], (res) => {
        if (res.scannerSettings) {
          setSettings(res.scannerSettings);
        }
        if (res.lastSiteAuditResults) {
          setSiteResults(res.lastSiteAuditResults);
        }
      });
    }

    // Query Active Tab
    refreshCurrentTab();

    // Listen to Tab Changes
    if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(refreshCurrentTab);
    }

    // Listen to background crawler messages
    const messageListener = (message: ExtensionMessage) => {
      if (message.type === 'SITE_AUDIT_PROGRESS') {
        setSiteProgress(message.progress);
      } else if (message.type === 'SITE_AUDIT_COMPLETE') {
        setSiteResults(message.results);
        setIsAuditingSite(false);
        setSiteProgress(null);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  const refreshCurrentTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          const tab = tabs[0];
          setActiveTabId(tab.id || null);
          if (tab.url) {
            setCurrentUrl(tab.url);
          }
        }
      });
    }
  };

  // 2. Single Page Handlers
  const handleScanPage = () => {
    if (!activeTabId) return;
    setIsScanningSingle(true);

    chrome.tabs.sendMessage(
      activeTabId,
      { type: 'SCAN_ACTIVE_TAB', settings },
      (response) => {
        setIsScanningSingle(false);
        if (chrome.runtime.lastError) {
          console.warn('Could not connect to page content script:', chrome.runtime.lastError.message);
          alert('Could not scan this page. Please refresh the page tab and try again.');
          return;
        }
        if (response && response.data) {
          setPageResult(response.data);
        }
      }
    );
  };

  const handleHighlightElement = (highlightId: string) => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'HIGHLIGHT_ELEMENT', highlightId });
  };

  const handleClearHighlights = () => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'CLEAR_HIGHLIGHTS' });
  };

  // 3. Full Site Handlers
  const handleDiscoverLinks = () => {
    if (!activeTabId) return;
    setIsDiscovering(true);

    chrome.tabs.sendMessage(
      activeTabId,
      { type: 'DISCOVER_INTERNAL_LINKS' },
      (response) => {
        setIsDiscovering(false);
        if (chrome.runtime.lastError) {
          alert('Could not discover links on this page. Please refresh the tab and try again.');
          return;
        }
        if (response && response.links) {
          setDiscoveredUrls(response.links);
          setSelectedUrls(response.links); // Default: include all, allow user to exclude
        }
      }
    );
  };

  const handleStartSiteAudit = (urlsToAudit: string[]) => {
    if (urlsToAudit.length === 0) return;
    setIsAuditingSite(true);
    setSiteResults([]);
    setSiteProgress({ current: 0, total: urlsToAudit.length, currentUrl: urlsToAudit[0] });

    chrome.runtime.sendMessage({
      type: 'START_SITE_AUDIT',
      urls: urlsToAudit,
      settings,
    });
  };

  const handleCancelSiteAudit = () => {
    chrome.runtime.sendMessage({ type: 'CANCEL_SITE_AUDIT' });
    setIsAuditingSite(false);
    setSiteProgress(null);
  };

  const handleResetResults = () => {
    setSiteResults([]);
  };

  const handleUpdateSettings = (newSettings: ScannerSettings) => {
    setSettings(newSettings);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ scannerSettings: newSettings });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUrl={currentUrl}
      />

      <main className="flex-1">
        {activeTab === 'single' && (
          <SinglePageAudit
            pageResult={pageResult}
            isScanning={isScanningSingle}
            onScanPage={handleScanPage}
            onHighlightElement={handleHighlightElement}
            onClearHighlights={handleClearHighlights}
          />
        )}

        {activeTab === 'site' && (
          <FullSiteAudit
            currentUrl={currentUrl}
            discoveredUrls={discoveredUrls}
            selectedUrls={selectedUrls}
            setSelectedUrls={setSelectedUrls}
            onDiscoverLinks={handleDiscoverLinks}
            isDiscovering={isDiscovering}
            onStartAudit={handleStartSiteAudit}
            onCancelAudit={handleCancelSiteAudit}
            isAuditing={isAuditingSite}
            progress={siteProgress}
            results={siteResults}
            onResetResults={handleResetResults}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
      </main>
    </div>
  );
};

export default App;
