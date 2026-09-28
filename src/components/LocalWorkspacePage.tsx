import React, { useState, useRef } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { NativeWorkspaceService } from '../services/nativeWorkspace';
import {
  Folder,
  FolderOpen,
  GitBranch,
  ShieldCheck,
  HardDrive,
  ArrowRight,
  X,
  Package,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Cpu
} from 'lucide-react';

export const LocalWorkspacePage: React.FC = () => {
  const {
    activeWorkspace,
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    mountNativeWorkspace,
    mountDirectoryHandle,
    mountFileList,
    openCustomFolder,
    removeRecentWorkspace,
    clearRecentWorkspaces,
    isScanningProject,
    scanStatusMessage,
    setCurrentTab
  } = useAxionStore();

  const [customFolderName, setCustomFolderName] = useState('');
  const [customFolderPath, setCustomFolderPath] = useState('');
  const [isPathModalOpen, setIsPathModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNativeRuntime = NativeWorkspaceService.isNative();

  // 1. Native / HTML5 File System Directory Picker
  const handleOpenFolder = async () => {
    setErrorMessage(null);
    try {
      // 1a. If running in genuine Tauri native desktop environment
      if (isNativeRuntime) {
        const selected = await NativeWorkspaceService.selectFolderDialog();
        if (selected) {
          await mountNativeWorkspace(selected);
        }
        return;
      }

      // 1b. Try modern HTML5 File System Access API
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
          if (dirHandle) {
            await mountDirectoryHandle(dirHandle);
          }
          return;
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            // User cancelled picker safely
            return;
          }
          console.warn('showDirectoryPicker error, falling back to file input', pickerErr);
          fileInputRef.current?.click();
          return;
        }
      }

      // 1c. Standard fallback
      fileInputRef.current?.click();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to open directory');
    }
  };

  // 2. HTML Folder Upload Input Fallback (webkitdirectory)
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    await mountFileList(fileList);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 3. Manual Path Input Submit
  const handlePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmedPath = customFolderPath.trim();
    const trimmedName = customFolderName.trim();

    if (!trimmedName) {
      setErrorMessage('Project name is required.');
      return;
    }

    if (!trimmedPath) {
      setErrorMessage('Please specify an absolute folder path on your system.');
      return;
    }

    try {
      if (isNativeRuntime) {
        await mountNativeWorkspace(trimmedPath);
      } else {
        openCustomFolder(trimmedName, trimmedPath);
      }
      setCustomFolderName('');
      setCustomFolderPath('');
      setIsPathModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish workspace path');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] text-zinc-100 overflow-y-auto select-none font-sans">
      {/* Hidden Webkitdirectory folder input */}
      <input
        type="file"
        ref={fileInputRef}
        // @ts-ignore
        webkitdirectory="true"
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

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
              {activeWorkspace ? (
                activeWorkspace.runtimeMode === 'native-tauri' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Tauri v2 Native (Disk Enforced)
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Web Sandbox (Browser API)
                  </span>
                )
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  No Project Mounted
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
              {isNativeRuntime
                ? 'AXION executes with Rust native boundary enforcement in Tauri v2. All path operations are validated against canonical disk roots.'
                : 'Running in Web Sandbox mode. Folder access uses the browser File System Access API.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenFolder}
              disabled={isScanningProject}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4 text-zinc-900" />
              <span>{isScanningProject ? 'Scanning...' : 'Open Folder'}</span>
            </button>
            <button
              onClick={() => setIsPathModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition"
            >
              <span>Mount Path</span>
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

      {/* Status banner if folder is scanning */}
      {scanStatusMessage && (
        <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-6 py-2.5 text-xs text-emerald-300 font-mono flex items-center gap-2 max-w-5xl mx-auto w-full">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{scanStatusMessage}</span>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="bg-rose-950/40 border-b border-rose-800/40 px-6 py-2.5 text-xs text-rose-300 font-mono flex items-center justify-between gap-2 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6 flex-1 max-w-5xl w-full mx-auto space-y-6">
        {activeWorkspace ? (
          /* Active Workspace Showcase Card */
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
                      CURRENT ACTIVE WORKSPACE
                    </div>
                    <h2 className="text-xl font-bold text-white font-mono tracking-tight">
                      {activeWorkspace.name}
                    </h2>
                  </div>
                </div>

                {/* Project Meta Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-zinc-400" />
                      <span>Workspace Root</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-200 truncate mt-1" title={activeWorkspace.absolutePath}>
                      {activeWorkspace.absolutePath}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                      <GitBranch className="w-3 h-3 text-zinc-400" />
                      <span>Git Branch</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-200 mt-1 flex items-center gap-2">
                      <span className="font-semibold">{activeWorkspace.gitBranch || 'main'}</span>
                      <span className="text-[10px] text-zinc-500">
                        ({activeWorkspace.gitRepository ? 'Git repo' : 'Local'})
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Runtime Mode</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-200 mt-1 font-semibold flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeWorkspace.runtimeMode === 'native-tauri' ? 'bg-emerald-400' : 'bg-blue-400'
                        }`}
                      />
                      <span>
                        {activeWorkspace.runtimeMode === 'native-tauri'
                          ? 'Tauri v2 Native (Disk Enforced)'
                          : 'Web Sandbox (Browser API)'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-zinc-400" />
                      <span>Project Type</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-200 mt-1 truncate">
                      {activeWorkspace.projectType || 'Standard Application'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-zinc-400" />
                      <span>Indexed Files</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-200 mt-1">
                      {activeWorkspace.indexedFileCount} files
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Workspace Banner */
          <div className="p-12 rounded-2xl border border-dashed border-zinc-800 bg-[#121214]/50 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
              <FolderOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No Project Mounted</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                Open a local project directory to allow AXION to read files, run tests, and execute within your repository boundary.
              </p>
            </div>
            <button
              onClick={handleOpenFolder}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Select Project Directory</span>
            </button>
          </div>
        )}

        {/* Recent Workspaces List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
              Recent Projects ({workspaces.length})
            </h3>
            {workspaces.length > 0 && (
              <button
                onClick={clearRecentWorkspaces}
                className="text-[11px] font-mono text-zinc-500 hover:text-rose-400 transition"
              >
                Clear Recents
              </button>
            )}
          </div>

          {workspaces.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
              No recent projects recorded. Open a project folder to populate this list.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <div
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className={`group p-4 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
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
                          <span className="text-xs font-bold text-white font-mono truncate">{ws.name}</span>
                          {isActive && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5" title={ws.path}>
                          {ws.path}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 mt-2">
                          <span>branch: {ws.branch || 'main'}</span>
                          {ws.indexedFileCount ? (
                            <>
                              <span>•</span>
                              <span>{ws.indexedFileCount} files</span>
                            </>
                          ) : null}
                          <span>•</span>
                          <span>{ws.lastOpened || 'Recent'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentWorkspace(ws.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition rounded"
                        title="Remove from Recents"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-zinc-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Manual Path Modal */}
      {isPathModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-[#141417] border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsPathModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <FolderOpen className="w-5 h-5 text-zinc-300" />
              <span>Mount Workspace Directory</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter local folder name and absolute path on your host machine.
            </p>

            <form onSubmit={handlePathSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={customFolderName}
                  onChange={(e) => setCustomFolderName(e.target.value)}
                  placeholder="e.g. my-project"
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                  Absolute Directory Path
                </label>
                <input
                  type="text"
                  required
                  value={customFolderPath}
                  onChange={(e) => setCustomFolderPath(e.target.value)}
                  placeholder="e.g. /home/user/my-project or C:\Users\user\my-project"
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPathModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition"
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
