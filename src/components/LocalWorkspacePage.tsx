import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Folder,
  FolderOpen,
  GitBranch,
  ShieldCheck,
  Check,
  Clock,
  HardDrive,
  FileCode,
  Terminal,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';

export const LocalWorkspacePage: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    openCustomFolder,
    closeWorkspace,
    setIsFolderPickerOpen,
    isFolderPickerOpen,
    files,
    setCurrentTab
  } = useAxionStore();

  const [customFolderName, setCustomFolderName] = useState('');
  const [customFolderPath, setCustomFolderPath] = useState('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const fileCount = Object.keys(files).length;

  const handleOpenFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFolderName.trim()) return;
    const path = customFolderPath.trim() || `E:\\Projects\\${customFolderName.trim()}`;
    openCustomFolder(customFolderName.trim(), path);
    setCustomFolderName('');
    setCustomFolderPath('');
    setIsNewFolderModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] text-zinc-100 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800/80 bg-[#0e0e11] shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 uppercase tracking-widest mb-1">
              <Folder className="w-3.5 h-3.5 text-zinc-400" />
              <span>Project Management</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>LOCAL WORKSPACE</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Boundary
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
              AXION is bound strictly to your local folder. All terminal executions, AST diff generations, and agent operations execute within this directory boundary.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsNewFolderModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition"
            >
              <FolderOpen className="w-4 h-4 text-zinc-900" />
              <span>Open Folder</span>
            </button>
            <button
              onClick={() => setCurrentTab('workspace')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition"
            >
              <span>Back to Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 flex-1 max-w-5xl w-full mx-auto space-y-6">
        {/* Active Workspace Showcase Card */}
        <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-800/90 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-mono shadow-md">
                  <Folder className="w-6 h-6 text-zinc-300" />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    CURRENT WORKSPACE
                  </div>
                  <h2 className="text-xl font-bold text-white font-mono tracking-tight">
                    {activeWorkspace?.name || 'No Active Workspace'}
                  </h2>
                </div>
              </div>

              {/* Project Meta Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-zinc-400" />
                    <span>Absolute Path</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-200 truncate mt-1" title={activeWorkspace?.path}>
                    {activeWorkspace?.path || 'Not mounted'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3 text-zinc-400" />
                    <span>Git Branch</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-200 mt-1 flex items-center gap-2">
                    <span className="font-semibold">{activeWorkspace?.branch || 'main'}</span>
                    <span className="text-[10px] text-zinc-500">(clean tree)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Runtime Status</span>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 mt-1 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Ready & Guarded</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-zinc-400" />
                    <span>Project Type</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-200 mt-1">
                    {activeWorkspace?.isLocalTauri ? 'Native Local Filesystem (Tauri)' : 'Browser Sandbox Simulation'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                    <FileCode className="w-3 h-3 text-zinc-400" />
                    <span>Indexed Files</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-200 mt-1">
                    {fileCount} files in memory index
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>Last Opened</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-200 mt-1">
                    {activeWorkspace?.lastOpened || 'Just now'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-2 shrink-0 pt-2">
              <button
                onClick={() => setIsNewFolderModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition"
              >
                <FolderOpen className="w-4 h-4 text-zinc-300" />
                <span>Open Folder</span>
              </button>

              <button
                onClick={() => setIsNewFolderModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Change Workspace</span>
              </button>

              <button
                onClick={closeWorkspace}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl hover:bg-rose-500/10 text-rose-400 text-xs font-medium border border-transparent hover:border-rose-500/20 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Workspace</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security & Boundary Lock Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
            <div className="font-semibold text-zinc-200">Local-First Sandbox Protection</div>
            <p>
              All agent modifications, AST diff hunks, PowerShell/Bash executions, and snapshot reversions are strictly scoped to <code className="text-zinc-300 font-mono bg-zinc-800 px-1 py-0.5 rounded">{activeWorkspace?.path}</code>. No agent can traverse beyond this workspace root.
            </p>
          </div>
        </div>

        {/* Recent Workspaces List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
              Recent Workspaces ({workspaces.length})
            </h3>
            <span className="text-[11px] text-zinc-500">Click to switch globally</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <div
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isActive
                      ? 'bg-zinc-800/80 border-zinc-600 shadow-md ring-1 ring-zinc-500/30'
                      : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#161619]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-zinc-700 text-white'
                          : 'bg-zinc-850 text-zinc-400 border border-zinc-800'
                      }`}
                    >
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-200 truncate font-mono">
                          {ws.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-sans">
                          ({ws.branch})
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono truncate mt-1">
                        {ws.path}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-1">
                        Last opened: {ws.lastOpened || 'Recent'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isActive ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 hover:text-zinc-200 font-medium">
                        Switch
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal: Open Local Folder */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="p-3.5 bg-[#16161a] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100 font-mono">
                <FolderOpen className="w-4 h-4 text-zinc-300" />
                <span>Open Local Project Folder</span>
              </div>
              <button
                onClick={() => setIsNewFolderModalOpen(false)}
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
                  placeholder="e.g. E:\Projects\vehicle-stock-management"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed font-sans">
                <strong className="text-zinc-200 font-mono">Local-First Guarantee:</strong> In the native Tauri desktop app, this mounts real local filesystem access. All diffs, AST patches, terminal runs, and task snapshots are strictly bound to this folder boundary.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
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
    </div>
  );
};
