import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Layers, 
  ClipboardCheck, 
  AlertCircle, 
  CheckCircle2, 
  RotateCw, 
  Eye, 
  ExternalLink, 
  FileSpreadsheet, 
  FileCode, 
  ArrowRight,
  Info,
  KeyRound,
  Sparkles,
  ClipboardPaste
} from 'lucide-react';
import { ComparisonReport, ContentComparisonItem, LiveContentBlock } from '../../types';
import { fetchGoogleDocText, fetchFigmaText } from '../../engine/source-extractor';
import { compareContent } from '../../engine/diff-engine';

interface ContentCompareTabProps {
  currentUrl: string;
  activeTabId: number | null;
  onHighlightElement: (highlightId: string) => void;
}

export const ContentCompareTab: React.FC<ContentCompareTabProps> = ({
  currentUrl,
  activeTabId,
  onHighlightElement,
}) => {
  const [sourceType, setSourceType] = useState<'google-doc' | 'figma' | 'manual'>('google-doc');
  const [docUrl, setDocUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [manualText, setManualText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // URL-keyed comparison reports: prevents showing stale reports when switching tabs/pages
  const [reportsByUrl, setReportsByUrl] = useState<Record<string, ComparisonReport>>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'mismatch' | 'missing' | 'exact'>('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const cleanPageKey = (url: string) => (url ? url.split('#')[0] : '');
  const activePageKey = cleanPageKey(currentUrl);
  const report = activePageKey ? reportsByUrl[activePageKey] || null : null;

  // Load saved credentials and inputs on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(
        ['figmaToken', 'savedDocUrl', 'savedFigmaUrl', 'comparisonReportsByUrl'],
        (res) => {
          if (res.figmaToken) setFigmaToken(res.figmaToken);
          if (res.savedDocUrl) setDocUrl(res.savedDocUrl);
          if (res.savedFigmaUrl) setFigmaUrl(res.savedFigmaUrl);
          if (res.comparisonReportsByUrl) setReportsByUrl(res.comparisonReportsByUrl);
        }
      );
    }
  }, []);

  const handleSaveFigmaToken = (token: string) => {
    setFigmaToken(token);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ figmaToken: token });
    }
  };

  const handleClearComparison = () => {
    setReportsByUrl(prev => {
      const updated = { ...prev };
      delete updated[activePageKey];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ comparisonReportsByUrl: updated });
      }
      return updated;
    });
  };

  const handleStartComparison = async () => {
    if (!activeTabId) {
      setErrorMessage('No active browser tab found to compare against.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // 1. Extract approved blocks from selected source
      let approvedBlocks: string[] = [];
      let sourceUrlIdentifier = '';

      if (sourceType === 'google-doc') {
        if (!docUrl.trim()) throw new Error('Please enter a Google Doc URL.');
        sourceUrlIdentifier = docUrl.trim();
        approvedBlocks = await fetchGoogleDocText(docUrl.trim());
      } else if (sourceType === 'figma') {
        if (!figmaUrl.trim()) throw new Error('Please enter a Figma file URL.');
        if (!figmaToken.trim()) throw new Error('Please enter your Figma Personal Access Token.');
        sourceUrlIdentifier = figmaUrl.trim();
        handleSaveFigmaToken(figmaToken.trim());
        approvedBlocks = await fetchFigmaText(figmaUrl.trim(), figmaToken.trim());
      } else {
        if (!manualText.trim()) throw new Error('Please paste your approved text content.');
        sourceUrlIdentifier = 'Pasted Text';
        approvedBlocks = manualText.split(/\r?\n+/).map(t => t.trim()).filter(t => t.length > 2);
      }

      if (approvedBlocks.length === 0) {
        throw new Error('No readable text blocks could be extracted from the specified source.');
      }

      // 2. Query active page for live DOM text blocks
      chrome.tabs.sendMessage(
        activeTabId,
        { type: 'EXTRACT_PAGE_CONTENT_BLOCKS' },
        (response) => {
          setIsLoading(false);
          if (chrome.runtime.lastError || !response || !response.blocks) {
            setErrorMessage('Could not extract content from the active tab. Please refresh the page tab and try again.');
            return;
          }

          const liveBlocks: LiveContentBlock[] = response.blocks;

          // 3. Run Diff Engine
          const compReport = compareContent(
            approvedBlocks,
            liveBlocks,
            sourceUrlIdentifier,
            sourceType,
            currentUrl
          );

          // Save report scoped to the active page URL
          setReportsByUrl(prev => {
            const updated = { ...prev, [activePageKey]: compReport };
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              chrome.storage.local.set({ 
                comparisonReportsByUrl: updated,
                savedDocUrl: docUrl,
                savedFigmaUrl: figmaUrl,
              });
            }
            return updated;
          });
        }
      );
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'An error occurred during verification.');
    }
  };

  const handleLocate = (highlightId?: string) => {
    if (!highlightId) return;
    setHighlightedId(highlightId);
    onHighlightElement(highlightId);
  };

  const exportToCSV = () => {
    if (!report) return;
    const rows = [
      ['Status', 'Approved Copy (Spec)', 'Live Website Copy', 'Similarity (%)', 'Element Selector'],
    ];

    for (const item of report.items) {
      rows.push([
        item.type.toUpperCase(),
        `"${item.approvedText.replace(/"/g, '""')}"`,
        `"${(item.liveText || '').replace(/"/g, '""')}"`,
        `${Math.round(item.similarity * 100)}%`,
        item.elementSelector || '',
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `content-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportToJSON = () => {
    if (!report) return;
    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonStr;
    link.download = `content-comparison-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const filteredItems = report?.items.filter(item => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  }) || [];

  return (
    <div className="p-4 space-y-4">
      {/* 1. SETUP / INPUT CARD */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
        <div>
          <h3 className="text-xs font-bold text-slate-800">Content Source of Truth</h3>
          <p className="text-[11px] text-slate-500">
            Compare live page copy against your approved Google Doc or Figma design
          </p>
        </div>

        {/* Source Toggle Pills */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setSourceType('google-doc')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              sourceType === 'google-doc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Google Doc
          </button>

          <button
            onClick={() => setSourceType('figma')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              sourceType === 'figma' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Figma
          </button>

          <button
            onClick={() => setSourceType('manual')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              sourceType === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste Text
          </button>
        </div>

        {/* Dynamic Inputs */}
        {sourceType === 'google-doc' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Google Doc URL</label>
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-500 flex items-start gap-1">
              <Info className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
              Ensure document sharing is set to "Anyone with the link can view".
            </p>
          </div>
        )}

        {sourceType === 'figma' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-bold text-slate-700">Figma File / Frame URL</label>
              <input
                type="url"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/:file_key/...(?node-id=...)"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-indigo-600" />
                  Figma Access Token
                </label>
                <a
                  href="https://www.figma.com/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  Generate Token <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                placeholder="figd_..."
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
              />
            </div>
          </div>
        )}

        {sourceType === 'manual' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Approved Copy Deck</label>
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste approved paragraphs and headings here..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{errorMessage}</span>
              {sourceType !== 'manual' && (
                <button
                  onClick={() => setSourceType('manual')}
                  className="block mt-1 font-bold text-red-800 underline text-[11px]"
                >
                  Or switch to "Paste Text" mode
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleStartComparison}
          disabled={isLoading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              Extracting & Verifying Copy...
            </>
          ) : (
            <>
              <ClipboardCheck className="w-4 h-4" />
              Verify Live Page Against Source
            </>
          )}
        </button>
      </div>

      {/* 2. RESULTS DASHBOARD */}
      {report && (
        <div className="space-y-4">
          {/* Match Score & Overview Banner */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Copy Accuracy Score
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-black ${
                  report.matchScore >= 90 ? 'text-emerald-600' : report.matchScore >= 70 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {report.matchScore}%
                </span>
                <span className="text-xs text-slate-500 font-medium">Approved Copy Matched</span>
              </div>
            </div>

            <div className="flex gap-1.5 items-center">
              <button
                onClick={handleClearComparison}
                className="px-2 py-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 text-[10px] font-bold"
                title="Clear comparison for this page"
              >
                Reset
              </button>
              <button
                onClick={exportToCSV}
                className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
                title="Download CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={exportToJSON}
                className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
                title="Download JSON"
              >
                <FileCode className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stat Metric Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Matched</span>
              <span className="text-base font-bold text-emerald-600">{report.exactMatches}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Mismatched</span>
              <span className={`text-base font-bold ${report.mismatches > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {report.mismatches}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Missing</span>
              <span className={`text-base font-bold ${report.missingFromPage > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {report.missingFromPage}
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({report.items.length})
            </button>
            {report.mismatches > 0 && (
              <button
                onClick={() => setActiveFilter('mismatch')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  activeFilter === 'mismatch' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mismatches ({report.mismatches})
              </button>
            )}
            {report.missingFromPage > 0 && (
              <button
                onClick={() => setActiveFilter('missing')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  activeFilter === 'missing' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Missing ({report.missingFromPage})
              </button>
            )}
            {report.exactMatches > 0 && (
              <button
                onClick={() => setActiveFilter('exact')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  activeFilter === 'exact' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Matched ({report.exactMatches})
              </button>
            )}
          </div>

          {/* Comparison Items List */}
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const isFocused = highlightedId === item.highlightId;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-3 border space-y-2.5 transition-all ${
                    isFocused ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.type === 'exact'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.type === 'mismatch'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.type === 'exact' ? '✓ Matched Copy' : item.type === 'mismatch' ? '⚠ Content Mismatch' : '✕ Missing on Page'}
                    </span>

                    {item.highlightId && (
                      <button
                        onClick={() => handleLocate(item.highlightId)}
                        className="py-1 px-2 text-indigo-600 hover:bg-indigo-50 rounded-md border border-indigo-200 text-[10px] font-bold flex items-center gap-1"
                        title="Scroll to element on page"
                      >
                        <Eye className="w-3 h-3" />
                        Locate
                      </button>
                    )}
                  </div>

                  {/* Approved Copy from Doc/Figma */}
                  <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Approved Spec ({sourceType === 'figma' ? 'Figma' : sourceType === 'google-doc' ? 'Google Doc' : 'Spec'})
                    </span>
                    <p className="text-slate-900 font-medium text-[11px] leading-relaxed">
                      "{item.approvedText}"
                    </p>
                  </div>

                  {/* Live Copy on Webpage (if mismatched) */}
                  {item.type === 'mismatch' && item.liveText && (
                    <div className="p-2 bg-rose-50/70 border border-rose-200 rounded-lg text-xs space-y-0.5">
                      <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                        Live Website DOM
                      </span>
                      <p className="text-slate-900 font-medium text-[11px] leading-relaxed">
                        "{item.liveText}"
                      </p>
                      <span className="text-[10px] text-amber-700 font-bold block pt-0.5">
                        Similarity: {Math.round(item.similarity * 100)}%
                      </span>
                    </div>
                  )}

                  {item.elementSelector && (
                    <div className="text-[9px] text-slate-400 font-mono truncate">
                      Selector: {item.elementSelector}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
