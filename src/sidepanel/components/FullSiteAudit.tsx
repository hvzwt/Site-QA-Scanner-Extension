import React, { useState } from 'react';
import { 
  Globe, 
  Search, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Play, 
  StopCircle, 
  RotateCw, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Layers,
  FileSpreadsheet,
  FileCode,
  Type,
  Clock,
  Image as ImageIcon
} from 'lucide-react';
import { PageAuditResult, SiteAuditProgress, IssueCategory } from '../../types';

interface FullSiteAuditProps {
  currentUrl: string;
  discoveredUrls: string[];
  selectedUrls: string[];
  setSelectedUrls: React.Dispatch<React.SetStateAction<string[]>>;
  onDiscoverLinks: () => void;
  isDiscovering: boolean;
  onStartAudit: (urls: string[]) => void;
  onCancelAudit: () => void;
  isAuditing: boolean;
  progress: SiteAuditProgress | null;
  results: PageAuditResult[];
  onResetResults: () => void;
}

export const FullSiteAudit: React.FC<FullSiteAuditProps> = ({
  currentUrl,
  discoveredUrls,
  selectedUrls,
  setSelectedUrls,
  onDiscoverLinks,
  isDiscovering,
  onStartAudit,
  onCancelAudit,
  isAuditing,
  progress,
  results,
  onResetResults,
}) => {
  const [newUrlInput, setNewUrlInput] = useState('');
  const [urlFilter, setUrlFilter] = useState('');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  // Filter discovered URLs
  const filteredDiscoveredUrls = discoveredUrls.filter(url => 
    url.toLowerCase().includes(urlFilter.toLowerCase())
  );

  const toggleSelectUrl = (url: string) => {
    setSelectedUrls(prev => 
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  const selectAll = () => {
    setSelectedUrls(filteredDiscoveredUrls);
  };

  const deselectAll = () => {
    setSelectedUrls([]);
  };

  const handleAddManualUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;
    try {
      const formatted = new URL(newUrlInput.trim(), currentUrl).href;
      if (!discoveredUrls.includes(formatted)) {
        discoveredUrls.push(formatted);
      }
      if (!selectedUrls.includes(formatted)) {
        setSelectedUrls(prev => [...prev, formatted]);
      }
      setNewUrlInput('');
    } catch {
      alert('Please enter a valid absolute or relative URL');
    }
  };

  const toggleAccordion = (url: string) => {
    setExpandedPages(prev => ({ ...prev, [url]: !prev[url] }));
  };

  // Export to CSV
  const exportToCSV = () => {
    if (results.length === 0) return;
    const rows = [
      ['Page URL', 'Page Title', 'Category', 'Severity', 'Issue Title', 'Flagged Snippet', 'Context'],
    ];

    for (const page of results) {
      if (page.issues.length === 0) {
        rows.push([page.url, `"${page.title}"`, 'CLEAN', 'NONE', 'No Issues Detected', '', '']);
      } else {
        for (const issue of page.issues) {
          rows.push([
            page.url,
            `"${page.title.replace(/"/g, '""')}"`,
            issue.category,
            issue.severity,
            `"${issue.title.replace(/"/g, '""')}"`,
            `"${issue.snippet.replace(/"/g, '""')}"`,
            `"${issue.context.replace(/"/g, '""')}"`,
          ]);
        }
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `site-qa-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Export to JSON
  const exportToJSON = () => {
    if (results.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(results, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `site-qa-audit-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Calculate Aggregated Metrics
  const totalAuditedPages = results.length;
  const pagesWithIssues = results.filter(r => r.issues.length > 0).length;
  const cleanPages = results.filter(r => r.status === 'success' && r.issues.length === 0).length;
  const totalIssuesFound = results.reduce((acc, curr) => acc + curr.stats.total, 0);

  return (
    <div className="p-4 space-y-4">
      {/* 1. PROGRESS BAR VIEW (While Auditing) */}
      {isAuditing && progress && (
        <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              Auditing Site ({progress.current}/{progress.total})
            </span>
            <span className="text-indigo-600 font-mono">
              {Math.round((progress.current / progress.total) * 100)}%
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-indigo-600 h-2 transition-all duration-300 rounded-full"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500 truncate font-mono">
            Fetching: {progress.currentUrl}
          </p>

          <button
            onClick={onCancelAudit}
            className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-rose-200"
          >
            <StopCircle className="w-3.5 h-3.5" />
            Stop / Abort Crawl
          </button>
        </div>
      )}

      {/* 2. RESULTS REPORT VIEW (When Completed) */}
      {!isAuditing && results.length > 0 && (
        <div className="space-y-4">
          {/* Summary Stat Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Pages</span>
              <span className="text-base font-bold text-slate-800">{totalAuditedPages}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Issues</span>
              <span className={`text-base font-bold ${totalIssuesFound > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {totalIssuesFound}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Clean</span>
              <span className="text-base font-bold text-emerald-600">{cleanPages}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">Flawed</span>
              <span className={`text-base font-bold ${pagesWithIssues > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {pagesWithIssues}
              </span>
            </div>
          </div>

          {/* Export & Action Bar */}
          <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={onResetResults}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ← Edit URLs
            </button>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                title="Download CSV Spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={exportToJSON}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                title="Download JSON Report"
              >
                <FileCode className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>

          {/* Page-by-Page Accordion */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 px-1">Audited Pages Breakdown</h4>

            {results.map((page, idx) => {
              const isExpanded = !!expandedPages[page.url];
              const hasIssues = page.issues.length > 0;

              return (
                <div 
                  key={idx} 
                  className={`bg-white rounded-xl border transition-all ${
                    hasIssues ? 'border-red-200' : 'border-slate-200'
                  }`}
                >
                  <div
                    onClick={() => toggleAccordion(page.url)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 rounded-xl"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-slate-800 truncate" title={page.title}>
                            {page.title || 'Untitled Page'}
                          </h5>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-indigo-600"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate" title={page.url}>
                          {page.url}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {hasIssues ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          {page.issues.length} {page.issues.length === 1 ? 'issue' : 'issues'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Clean
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Collapsed content list */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                      {page.issues.length === 0 ? (
                        <p className="text-xs text-emerald-600 py-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> No dummy content or outdated copyright found on this page.
                        </p>
                      ) : (
                        page.issues.map((issue) => (
                          <div key={issue.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{issue.title}</span>
                              <span className="text-[10px] font-bold uppercase text-slate-400">{issue.category}</span>
                            </div>
                            <div className="font-mono bg-white p-1.5 rounded border border-slate-200 text-slate-900 break-words text-[11px]">
                              <mark className="bg-amber-200 px-1 py-0.5 rounded font-bold text-amber-950">
                                {issue.snippet}
                              </mark>
                            </div>
                            {issue.context && (
                              <p className="text-[10px] text-slate-500 italic truncate" title={issue.context}>
                                "{issue.context}"
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. URL DISCOVERY & EXCLUSION MANAGER (Setup Phase) */}
      {!isAuditing && results.length === 0 && (
        <div className="space-y-4">
          {/* Discovery Action Banner */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800">1. Discover Website Pages</h3>
                <p className="text-[11px] text-slate-500">Scan internal links from the active page</p>
              </div>
              <button
                onClick={onDiscoverLinks}
                disabled={isDiscovering}
                className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-indigo-200 transition-colors disabled:opacity-50"
              >
                {isDiscovering ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    Auto-Discover Pages
                  </>
                )}
              </button>
            </div>

            {/* Manual URL Adder */}
            <form onSubmit={handleAddManualUrl} className="flex gap-2">
              <input
                type="text"
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                placeholder="Or add URL (e.g. /about or https://...)"
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </div>

          {/* URL Exclusion Checklist */}
          {discoveredUrls.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">2. Review & Exclude Pages</h3>
                  <p className="text-[11px] text-slate-500">
                    Uncheck any page URLs you do <strong>not</strong> want to audit
                  </p>
                </div>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  {selectedUrls.length} of {discoveredUrls.length} selected
                </span>
              </div>

              {/* URL Filter Search Bar & Bulk Toggles */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={urlFilter}
                    onChange={(e) => setUrlFilter(e.target.value)}
                    placeholder="Filter URLs (e.g. /blog, /contact)..."
                    className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={selectAll}
                  className="px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                  title="Select All"
                >
                  All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                  title="Deselect All (Exclude All)"
                >
                  None
                </button>
              </div>

              {/* Scrollable Checkbox List */}
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                {filteredDiscoveredUrls.map((url) => {
                  const isChecked = selectedUrls.includes(url);
                  return (
                    <div
                      key={url}
                      onClick={() => toggleSelectUrl(url)}
                      className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-50/40 text-slate-900' : 'bg-slate-50/60 text-slate-400 line-through'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="font-mono text-[11px] truncate" title={url}>
                          {url}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${isChecked ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {isChecked ? 'Included' : 'Excluded'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Run Full Site Audit Button */}
              <button
                onClick={() => onStartAudit(selectedUrls)}
                disabled={selectedUrls.length === 0}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Full Site Audit ({selectedUrls.length} Pages)
              </button>
            </div>
          )}

          {discoveredUrls.length === 0 && (
            <div className="bg-white rounded-xl p-8 border border-dashed border-slate-300 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Multi-Page Website Audit</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Click "Auto-Discover Pages" to scan all internal links on this website. You can review and exclude any URLs before launching the audit.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
