import React, { useState } from 'react';
import { 
  Play, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Clock, 
  Image as ImageIcon, 
  FileCode, 
  Type, 
  Sparkles,
  ExternalLink,
  Link2
} from 'lucide-react';
import { PageAuditResult, DetectedIssue, IssueCategory } from '../../types';

interface SinglePageAuditProps {
  pageResult: PageAuditResult | null;
  isScanning: boolean;
  onScanPage: () => void;
  onHighlightElement: (highlightId: string) => void;
  onClearHighlights: () => void;
}

export const SinglePageAudit: React.FC<SinglePageAuditProps> = ({
  pageResult,
  isScanning,
  onScanPage,
  onHighlightElement,
  onClearHighlights,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | IssueCategory>('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const issues = pageResult?.issues || [];
  const filteredIssues = activeFilter === 'all' 
    ? issues 
    : issues.filter(issue => issue.category === activeFilter);

  const handleLocate = (highlightId?: string) => {
    if (!highlightId) return;
    setHighlightedId(highlightId);
    onHighlightElement(highlightId);
  };

  const getCategoryBadge = (category: IssueCategory) => {
    switch (category) {
      case 'lorem-ipsum':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1"><Type className="w-3 h-3" /> Lorem Ipsum</span>;
      case 'outdated-copyright':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Outdated Year</span>;
      case 'unlinked-anchor':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 flex items-center gap-1"><Link2 className="w-3 h-3" /> Unlinked (#)</span>;
      case 'html-structure':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1"><FileCode className="w-3 h-3" /> HTML / SEO</span>;
      case 'placeholder-image':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Dummy Media</span>;
      case 'template-variable':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 flex items-center gap-1"><FileCode className="w-3 h-3" /> Template Var</span>;
      case 'fake-contact':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 flex items-center gap-1">Fake Contact</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Dummy Text</span>;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center justify-between gap-2">
        <button
          onClick={onScanPage}
          disabled={isScanning}
          className="flex-1 py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-100 disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              Scanning Page...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              {pageResult ? 'Re-scan Page' : 'Scan Current Page'}
            </>
          )}
        </button>

        {pageResult && pageResult.issues.length > 0 && (
          <button
            onClick={onClearHighlights}
            title="Clear on-page highlight borders"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Initial Empty State */}
      {!pageResult && !isScanning && (
        <div className="bg-white rounded-xl p-8 border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Quick Single-Page Review</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Click the scan button above to audit dummy text, outdated copyrights, unlinked # anchors, meta tags, and h1-h6 heading structure.
            </p>
          </div>
        </div>
      )}

      {/* Audit Results */}
      {pageResult && (
        <div className="space-y-4">
          {/* Stat Metric Cards */}
          <div className="grid grid-cols-5 gap-1.5">
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider block">Total</span>
              <span className={`text-sm font-bold ${pageResult.stats.total > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pageResult.stats.total}
              </span>
            </div>
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider block">Lorem/Text</span>
              <span className="text-sm font-bold text-slate-800">
                {pageResult.stats.loremIpsum + pageResult.stats.dummyText}
              </span>
            </div>
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider block">Outdated</span>
              <span className={`text-sm font-bold ${pageResult.stats.outdatedCopyright > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {pageResult.stats.outdatedCopyright}
              </span>
            </div>
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider block"># Links</span>
              <span className={`text-sm font-bold ${pageResult.stats.unlinkedAnchors > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
                {pageResult.stats.unlinkedAnchors}
              </span>
            </div>
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider block">HTML/SEO</span>
              <span className={`text-sm font-bold ${pageResult.stats.htmlStructure > 0 ? 'text-indigo-600' : 'text-slate-800'}`}>
                {pageResult.stats.htmlStructure || 0}
              </span>
            </div>
          </div>

          {/* Zero Issues Success State */}
          {pageResult.issues.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-emerald-900">Page Passed QA!</h4>
              <p className="text-xs text-emerald-700">
                No Lorem Ipsum, dummy placeholders, broken # links, HTML heading skips, or outdated copyright years were found.
              </p>
            </div>
          ) : (
            <>
              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                    activeFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({issues.length})
                </button>
                {pageResult.stats.loremIpsum > 0 && (
                  <button
                    onClick={() => setActiveFilter('lorem-ipsum')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'lorem-ipsum'
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Lorem Ipsum ({pageResult.stats.loremIpsum})
                  </button>
                )}
                {pageResult.stats.htmlStructure > 0 && (
                  <button
                    onClick={() => setActiveFilter('html-structure')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'html-structure'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    HTML / SEO ({pageResult.stats.htmlStructure})
                  </button>
                )}
                {pageResult.stats.unlinkedAnchors > 0 && (
                  <button
                    onClick={() => setActiveFilter('unlinked-anchor')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'unlinked-anchor'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    # Links ({pageResult.stats.unlinkedAnchors})
                  </button>
                )}
                {pageResult.stats.outdatedCopyright > 0 && (
                  <button
                    onClick={() => setActiveFilter('outdated-copyright')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'outdated-copyright'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Copyright ({pageResult.stats.outdatedCopyright})
                  </button>
                )}
                {pageResult.stats.dummyText > 0 && (
                  <button
                    onClick={() => setActiveFilter('dummy-text')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'dummy-text'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Dummy ({pageResult.stats.dummyText})
                  </button>
                )}
                {pageResult.stats.placeholderMedia > 0 && (
                  <button
                    onClick={() => setActiveFilter('placeholder-image')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'placeholder-image'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Media ({pageResult.stats.placeholderMedia})
                  </button>
                )}
              </div>

              {/* Issues List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                  <span>Showing {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}</span>
                  <span className="text-[11px] text-indigo-600 font-medium">Click card to highlight</span>
                </div>

                {filteredIssues.map((issue) => {
                  const isFocused = highlightedId === issue.highlightId;
                  return (
                    <div
                      key={issue.id}
                      onClick={() => handleLocate(issue.highlightId)}
                      className={`bg-white rounded-xl p-3 border transition-all cursor-pointer hover:shadow-md ${
                        isFocused 
                          ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getCategoryBadge(issue.category)}
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {issue.severity}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800">
                            {issue.title}
                          </h4>
                        </div>

                        {issue.highlightId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLocate(issue.highlightId);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md border border-indigo-200 text-[11px] font-semibold flex items-center gap-1 shrink-0"
                            title="Scroll to and highlight element on webpage"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Locate</span>
                          </button>
                        )}
                      </div>

                      {/* Snippet box */}
                      <div className="mt-2 text-xs font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800 break-words">
                        <mark className="bg-amber-200 px-1 py-0.5 rounded font-bold text-amber-950">
                          {issue.snippet}
                        </mark>
                      </div>

                      {/* Context Quote */}
                      {issue.context && issue.context !== issue.snippet && (
                        <p className="mt-1.5 text-[11px] text-slate-500 italic truncate" title={issue.context}>
                          "{issue.context}"
                        </p>
                      )}

                      {/* Element Selector footnote */}
                      {issue.elementSelector && (
                        <div className="mt-2 text-[10px] text-slate-400 font-mono truncate">
                          Target: {issue.elementSelector}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
