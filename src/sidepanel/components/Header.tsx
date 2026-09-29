import React from 'react';
import { ShieldAlert, Globe, FileText, Settings, Layers } from 'lucide-react';

interface HeaderProps {
  activeTab: 'single' | 'site' | 'settings';
  setActiveTab: (tab: 'single' | 'site' | 'settings') => void;
  currentUrl: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, currentUrl }) => {
  let hostname = '';
  try {
    hostname = currentUrl ? new URL(currentUrl).hostname : '';
  } catch {
    hostname = currentUrl;
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-indigo-200 shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Site QA Auditor</h1>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]" title={currentUrl}>
              {hostname || 'No active tab'}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          MV3 Pro
        </span>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-t border-slate-100 px-3 bg-slate-50/70">
        <button
          onClick={() => setActiveTab('single')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'single'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Single Page
        </button>

        <button
          onClick={() => setActiveTab('site')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'site'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Full Site Audit
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          title="Audit Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
