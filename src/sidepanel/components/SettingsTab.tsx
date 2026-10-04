import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Plus, X, Calendar, Check, Info } from 'lucide-react';
import { ScannerSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../engine/detector';

interface SettingsTabProps {
  settings: ScannerSettings;
  onUpdateSettings: (newSettings: ScannerSettings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdateSettings }) => {
  const [formData, setFormData] = useState<ScannerSettings>(settings);
  const [keywordInput, setKeywordInput] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    onUpdateSettings(formData);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
    onUpdateSettings(DEFAULT_SETTINGS);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const addCustomKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;
    const term = keywordInput.trim();
    if (!formData.customKeywords.includes(term)) {
      setFormData(prev => ({
        ...prev,
        customKeywords: [...prev.customKeywords, term],
      }));
    }
    setKeywordInput('');
  };

  const removeCustomKeyword = (term: string) => {
    setFormData(prev => ({
      ...prev,
      customKeywords: prev.customKeywords.filter(k => k !== term),
    }));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Scanner Configuration</h3>
              <p className="text-[11px] text-slate-500">Customize audit rules and target thresholds</p>
            </div>
          </div>
          {savedToast && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 animate-pulse">
              <Check className="w-3 h-3" /> Saved!
            </span>
          )}
        </div>

        {/* 1. Target Copyright Year */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            Target Copyright Year
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="2000"
              max="2100"
              value={formData.targetYear}
              onChange={(e) => setFormData(prev => ({ ...prev, targetYear: parseInt(e.target.value, 10) || 2026 }))}
              className="w-28 text-xs font-mono font-bold border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-400">
              (Current default: 2026)
            </span>
          </div>
          <p className="text-[10px] text-slate-500 flex items-start gap-1">
            <Info className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
            Any page containing copyright dates strictly less than this year (e.g. 2025, 2024, or older) will be flagged as an outdated mismatch.
          </p>
        </div>

        {/* 2. Audit Category Toggles */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-bold text-slate-700">Active Audit Rules</h4>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Detect Outdated Copyright Year</span>
              <input
                type="checkbox"
                checked={formData.checkCopyright}
                onChange={(e) => setFormData(prev => ({ ...prev, checkCopyright: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Detect Lorem Ipsum (Latin Dummy Text)</span>
              <input
                type="checkbox"
                checked={formData.checkLoremIpsum}
                onChange={(e) => setFormData(prev => ({ ...prev, checkLoremIpsum: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Detect Placeholders & Variables (TODO, [Company Name], &#123;&#123;var&#125;&#125;)</span>
              <input
                type="checkbox"
                checked={formData.checkDummyText}
                onChange={(e) => setFormData(prev => ({ ...prev, checkDummyText: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Detect Placeholder Images (via.placeholder, picsum, etc.)</span>
              <input
                type="checkbox"
                checked={formData.checkPlaceholderImages}
                onChange={(e) => setFormData(prev => ({ ...prev, checkPlaceholderImages: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Detect Fictional Contacts (example.com emails, 555-01xx phones)</span>
              <input
                type="checkbox"
                checked={formData.checkFakeContacts}
                onChange={(e) => setFormData(prev => ({ ...prev, checkFakeContacts: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Detect Broken / Unlinked Anchors (href="#", href="#!", empty)</span>
              <input
                type="checkbox"
                checked={formData.checkUnlinkedAnchors}
                onChange={(e) => setFormData(prev => ({ ...prev, checkUnlinkedAnchors: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
              <span>Audit HTML Structure & SEO (Headings h1-h6, Meta, Landmarks)</span>
              <input
                type="checkbox"
                checked={formData.checkHtmlStructure ?? true}
                onChange={(e) => setFormData(prev => ({ ...prev, checkHtmlStructure: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* 3. Custom Target Keywords */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-bold text-slate-700">Custom Placeholder Keywords</h4>
          <p className="text-[10px] text-slate-500">
            Add client-specific words or dummy tags you want the scanner to flag.
          </p>

          <form onSubmit={addCustomKeyword} className="flex gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="e.g. COMING_SOON, TBD_CLIENT..."
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>

          {formData.customKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.customKeywords.map(keyword => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeCustomKeyword(keyword)}
                    className="hover:text-red-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            onClick={handleReset}
            className="py-1.5 px-3 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            onClick={handleSave}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
