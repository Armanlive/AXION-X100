import React, { useState, useRef } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { NativeWorkspaceService } from '../../services/nativeWorkspace';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  ShieldCheck,
  HardDrive,
  Search,
  X,
  ArrowRight,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const MobileWorkspace: React.FC = () => {
  const {
    activeWorkspace,
    files,
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    mountDirectoryHandle,
    mountFileList,
    isScanningProject,
    scanStatusMessage
  } = useAxionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNativeRuntime = NativeWorkspaceService.isNative();

  const handleOpenFolder = async () => {
    setErrorMessage(null);
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
          if (dirHandle) {
            await mountDirectoryHandle(dirHandle);
            return;
          }
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') return;
          fileInputRef.current?.click();
          return;
        }
      }
      fileInputRef.current?.click();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to open directory');
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    await mountFileList(uploadedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Files in active workspace
  const filesMap = files || {};
  const filePaths = Object.keys(filesMap);

  const filteredPaths = filePaths.filter((path) =>
    path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFile = (path: string) => {
    setSelectedFilePath(path);
    setFileContent(filesMap[path] || '(Empty file)');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] text-zinc-100 overflow-hidden relative pb-16">
      {/* 1. Mobile Top Bar */}
      <header className="h-12 bg-[#09090b]/95 border-b border-zinc-800/80 px-4 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-semibold tracking-wider text-zinc-200">
            LOCAL WORKSPACE
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          Phase 1: Read-Only
        </span>
      </header>

      {/* Hidden Folder Upload Input Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFolderUpload}
        className="hidden"
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Workspace Identity Card */}
        {activeWorkspace ? (
          <div className="p-4 rounded-2xl bg-[#121215] border border-zinc-800 shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Active Project
                </span>
                <h2 className="text-base font-bold text-white font-mono truncate">
                  {activeWorkspace.name}
                </h2>
                <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5" title={activeWorkspace.absolutePath}>
                  {activeWorkspace.absolutePath}
                </p>
              </div>

              <button
                onClick={handleOpenFolder}
                className="px-2.5 py-1.5 min-h-[38px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700/80 shrink-0 transition"
              >
                Change
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-850">
              <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-850">
                <span className="text-[10px] font-mono text-zinc-500 block">Indexed Files</span>
                <span className="text-xs font-mono font-semibold text-zinc-200">
                  {activeWorkspace.indexedFileCount || filePaths.length} files
                </span>
              </div>

              <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-850">
                <span className="text-[10px] font-mono text-zinc-500 block">Runtime Mode</span>
                <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {isNativeRuntime ? 'Tauri Native' : 'Web Read-Only'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Workspace State */
          <div className="p-6 rounded-2xl bg-[#121215] border border-dashed border-zinc-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No Project Mounted</h3>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1 leading-relaxed">
                Connect a local folder to inspect files and ask questions with full project context.
              </p>
            </div>
            <button
              onClick={handleOpenFolder}
              disabled={isScanningProject}
              className="px-4 py-2 min-h-[44px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold shadow-md transition"
            >
              {isScanningProject ? 'Scanning Project...' : 'Open Local Folder'}
            </button>
          </div>
        )}

        {/* Status / Errors */}
        {scanStatusMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{scanStatusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* Compact File Browser */}
        {filePaths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider">
                Files ({filePaths.length})
              </span>
            </div>

            {/* Search Files */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter files..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans"
              />
            </div>

            {/* File List */}
            <div className="rounded-xl border border-zinc-800/80 divide-y divide-zinc-850/80 overflow-hidden bg-[#121215]">
              {filteredPaths.slice(0, 35).map((path) => {
                const isCode = /\.(ts|tsx|js|jsx|json|rs|py|go|html|css)$/i.test(path);
                return (
                  <button
                    key={path}
                    onClick={() => handleSelectFile(path)}
                    className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-850/60 transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isCode ? (
                        <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-xs font-mono text-zinc-300 group-hover:text-white truncate">
                        {path}
                      </span>
                    </div>
                    <Eye className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Read-Only File Inspection Modal / Sheet */}
      {selectedFilePath && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end p-2 animate-in fade-in">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="p-3 bg-[#16161a] border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-mono font-semibold text-white truncate">
                  {selectedFilePath}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  (Read-Only)
                </span>
              </div>
              <button
                onClick={() => setSelectedFilePath(null)}
                className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white"
                aria-label="Close file viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 flex-1 overflow-auto bg-[#0b0b0c] font-mono text-xs text-zinc-300 select-text whitespace-pre leading-relaxed">
              {fileContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
