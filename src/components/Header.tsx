import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Mic,
  Laptop,
  Terminal,
  PanelRight,
  FolderOpen,
  X
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    openCustomFolder,
    isFolderPickerOpen,
    setIsFolderPickerOpen,
    speechMode,
    setSpeechMode,
    isFilePanelOpen,
    toggleFilePanel,
    isTerminalOpen,
    toggleTerminal,
    isPreviewPanelOpen,
    togglePreviewPanel,
    setCurrentTab
  } = useAxionStore();

  const [customFolderName, setCustomFolderName] = useState('');
  const [customFolderPath, setCustomFolderPath] = useState('');

  const handleOpenFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFolderName.trim()) return;
    const path = customFolderPath.trim() || customFolderName.trim();
    openCustomFolder(customFolderName.trim(), path);
    setCustomFolderName('');
    setCustomFolderPath('');
    setIsFolderPickerOpen(false);
  };

  const handleToggleVoice = () => {
    setSpeechMode(speechMode === 'speech' ? 'chat' : 'speech');
  };

  return (
    <header className="h-11 bg-[#09090b] border-b border-zinc-800/80 px-3.5 flex items-center justify-between select-none shrink-0 z-30">
      {/* Left: Clean AXION-X100 Brand (Zero Clutter) */}
      <div className="flex items-center gap-2">
        <div
          onClick={() => setCurrentTab('workspace')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition"
          title="AXION-X100 Local AI Workspace"
        >
          <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700/80 flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-zinc-100 font-mono tracking-tighter">AX</span>
          </div>
          <span className="font-semibold text-xs tracking-tight text-zinc-200">
            AXION-X100
          </span>
        </div>
      </div>

      {/* Right: Clean Action Controls [Preview] [Files] [Terminal] */}
      <div className="flex items-center gap-1.5">
        {/* Live Preview / Activity Panel */}
        <button
          onClick={() => togglePreviewPanel()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border ${
            isPreviewPanelOpen
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700/80'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60 border-transparent'
          }`}
          title={isPreviewPanelOpen ? 'Hide Preview & Activity' : 'Show Live Preview & Activity'}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Preview</span>
        </button>

        {/* Filesystem Explorer Toggle */}
        <button
          onClick={() => toggleFilePanel()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border ${
            isFilePanelOpen
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700/80'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60 border-transparent'
          }`}
          title={isFilePanelOpen ? 'Hide Files & Explorer' : 'Show Files & Explorer'}
        >
          <PanelRight className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Files</span>
        </button>

        {/* Integrated Terminal Toggle */}
        <button
          onClick={() => toggleTerminal()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border ${
            isTerminalOpen
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700/80'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60 border-transparent'
          }`}
          title={isTerminalOpen ? 'Hide Terminal Panel' : 'Show Integrated Terminal'}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Terminal</span>
        </button>
      </div>

      {/* Modal: Open Folder Picker Dialog Simulation */}
      {isFolderPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="p-3.5 bg-[#16161a] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100 font-mono">
                <FolderOpen className="w-4 h-4 text-zinc-300" />
                <span>Open Local Project Folder</span>
              </div>
              <button
                onClick={() => setIsFolderPickerOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleOpenFolderSubmit} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Project Folder Name:
                </label>
                <input
                  type="text"
                  value={customFolderName}
                  onChange={(e) => setCustomFolderName(e.target.value)}
                  placeholder="e.g. vehicle-stock-management"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Local Absolute Path (Desktop / Tauri):
                </label>
                <input
                  type="text"
                  value={customFolderPath}
                  onChange={(e) => setCustomFolderPath(e.target.value)}
                  placeholder="e.g. /path/to/project or C:\path\to\project"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed font-sans">
                <strong className="text-zinc-200 font-mono">Local-First Guarantee:</strong> In the native Tauri desktop app, this mounts real local filesystem access. All diffs, AST patches, terminal runs, and task snapshots are strictly bound to this folder boundary.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderPickerOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customFolderName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-900 disabled:opacity-40 transition shadow-sm"
                >
                  Mount Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
