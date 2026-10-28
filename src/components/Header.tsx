import {useProfileStore} from '../store/useProfileStore';
import React, { useState, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Mic,
  Laptop,
  Terminal,
  PanelRight,
  FolderOpen,
  X,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  AlertTriangle
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
    setCurrentTab,
    scanForStaleFiles,
    staleScan
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
    <header className="h-11 bg-[#050508]/95 backdrop-blur-xl border-b border-cyan-500/20 px-3.5 flex items-center justify-between select-none shrink-0 z-30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      {/* Left: Clean AXION-X100 Brand with Holographic Cyan Glow */}
      <div className="flex items-center gap-2">
        <div
          onClick={() => setCurrentTab('workspace')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-95 transition group"
          title="AXION-X100 Local AI Workspace"
        >
          <div className="w-5 h-5 rounded-md bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.25)] group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition">
            <span className="text-[10px] font-bold text-[#00f0ff] font-mono tracking-tighter">AX</span>
          </div>
          <span className="font-semibold text-xs tracking-tight text-white font-mono">
            AXION<span className="text-[#00f0ff]">-X100</span>
          </span>
          <span className="text-[9px] font-mono text-cyan-400/60 px-1.5 py-0.2 rounded bg-cyan-950/40 border border-cyan-500/20 hidden sm:inline">
            QUANTUM HUD
          </span>
        </div>
      </div>

      {/* Right: Clean Action Controls [Preview] [Files] [Terminal] */}
      <div className="flex items-center gap-1.5">
        {/* Live Preview / Activity Panel */}
        <button
          onClick={() => togglePreviewPanel()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border font-mono ${
            isPreviewPanelOpen
              ? 'bg-cyan-950/80 text-[#00f0ff] border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40 border-transparent hover:border-cyan-500/30'
          }`}
          title={isPreviewPanelOpen ? 'Hide Preview & Activity' : 'Show Live Preview & Activity'}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Preview</span>
        </button>

        {/* Filesystem Explorer Toggle */}
        <button
          onClick={() => toggleFilePanel()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border font-mono ${
            isFilePanelOpen
              ? 'bg-cyan-950/80 text-[#00f0ff] border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40 border-transparent hover:border-cyan-500/30'
          }`}
          title={isFilePanelOpen ? 'Hide Files & Explorer' : 'Show Files & Explorer'}
        >
          <PanelRight className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Files</span>
        </button>

        {/* Integrated Terminal Toggle */}
        <button
          onClick={() => toggleTerminal()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border font-mono ${
            isTerminalOpen
              ? 'bg-cyan-950/80 text-[#00f0ff] border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40 border-transparent hover:border-cyan-500/30'
          }`}
          title={isTerminalOpen ? 'Hide Terminal Panel' : 'Show Integrated Terminal'}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Terminal</span>
        </button>

        {/* 🛡 Stale File Scan */}
        <div className="relative">
          <button
            onClick={() => scanForStaleFiles(30)}
            disabled={staleScan.isScanning}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition border font-mono ${
              staleScan.isScanning
                ? 'bg-cyan-950/60 text-cyan-500/60 border-cyan-500/30 cursor-wait'
                : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40 border-transparent hover:border-cyan-500/30'
            }`}
            title="Scan workspace for stale files (unused 30+ days)"
          >
            {staleScan.isScanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00f0ff]" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] hidden sm:inline">Stale</span>
          </button>

          {staleScan.results.length > 0 && (
            <div className="absolute right-0 top-full mt-1.5 w-80 max-h-60 overflow-auto rounded-xl border border-cyan-500/35 bg-[#080e1c] p-3 shadow-[0_0_25px_rgba(0,240,255,0.25)] z-50 animate-in fade-in duration-150 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-cyan-500/20">
                <span className="text-[11px] font-mono text-cyan-300 font-semibold">Stale workspace files</span>
                <span className="text-[11px] font-mono font-semibold text-[#00f0ff] px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40">
                  {staleScan.results.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {staleScan.results.slice(0, 8).map((item) => (
                  <div
                    key={item.filePath}
                    className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg hover:bg-cyan-950/60 transition"
                  >
                    <span className="text-cyan-100 truncate">{item.filePath}</span>
                    <span className="font-mono text-cyan-400/60 shrink-0 ml-2">
                      {item.ageDays}d · {item.size < 1024 ? `${item.size} B` : `${(item.size / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                ))}
                {staleScan.results.length > 8 && (
                  <div className="text-[11px] font-mono text-cyan-400/60 px-2 py-1">
                    +{staleScan.results.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => useProfileStore.getState().show()}
          className="px-2 py-1 rounded-md text-[11px] text-[#00f0ff] hover:bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400 transition font-mono shadow-[0_0_8px_rgba(0,240,255,0.1)]"
          title="Your AXION profile"
        >
          Profile
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
