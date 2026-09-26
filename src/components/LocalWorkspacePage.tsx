import React, { useState, useRef } from 'react';
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
  AlertCircle,
  Cpu,
  Package,
  CheckCircle2,
  FileText
} from 'lucide-react';

export const LocalWorkspacePage: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    openCustomFolder,
    loadDirectoryFiles,
    closeWorkspace,
    files,
    setCurrentTab
  } = useAxionStore();

  const [customFolderName, setCustomFolderName] = useState('');
  const [customFolderPath, setCustomFolderPath] = useState('');
  const [isPathModalOpen, setIsPathModalOpen] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const fileCount = Object.keys(files).length;

  // Detect project type and dependencies from package.json if present in workspace files
  const packageJsonContent = files['package.json'];
  let projectMeta = {
    name: activeWorkspace?.name || 'Local Project',
    type: 'React + TypeScript SPA',
    devCommand: 'npm run dev',
    dependenciesCount: 0
  };

  if (packageJsonContent) {
    try {
      const parsed = JSON.parse(packageJsonContent);
      if (parsed.name) projectMeta.name = parsed.name;
      if (parsed.dependencies) {
        projectMeta.dependenciesCount = Object.keys(parsed.dependencies).length;
        if (parsed.dependencies.next) projectMeta.type = 'Next.js App';
        else if (parsed.dependencies.react) projectMeta.type = 'React SPA (Vite)';
        else if (parsed.dependencies.vue) projectMeta.type = 'Vue.js Application';
        else projectMeta.type = 'Node.js Package';
      }
      if (parsed.scripts?.dev) projectMeta.devCommand = 'npm run dev';
      else if (parsed.scripts?.start) projectMeta.devCommand = 'npm start';
    } catch (e) {
      // ignore json parse error
    }
  }

  // 1. Native / HTML5 File System Access API Directory Picker
  const handleOpenNativeDirectory = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        setIsLoadingDirectory(true);
        setScanStatusMessage('Selecting directory...');
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const dirName = dirHandle.name;
        setScanStatusMessage(`Scanning files in "${dirName}"...`);

        const loadedFiles: Record<string, string> = {};
        const maxFiles = 300;
        let count = 0;

        // Recursive reader
        async function readDir(entryHandle: any, currentPath: string) {
          if (count >= maxFiles) return;

          for await (const entry of entryHandle.values()) {
            if (count >= maxFiles) break;

            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

            // Skip heavy build / dependency directories
            if (
              entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === '.next' ||
              entry.name === '.turbo'
            ) {
              continue;
            }

            if (entry.kind === 'file') {
              // Read text and code files
              const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.yml', '.yaml', '.svg'];
              const isText = validExts.some((ext) => entry.name.endsWith(ext));

              if (isText) {
                try {
                  const file = await entry.getFile();
                  if (file.size < 500000) { // < 500KB
                    const content = await file.text();
                    loadedFiles[entryPath] = content;
                    count++;
                  }
                } catch (err) {
                  console.warn(`Could not read file ${entryPath}`, err);
                }
              }
            } else if (entry.kind === 'directory') {
              await readDir(entry, entryPath);
            }
          }
        }

        await readDir(dirHandle, '');

        if (Object.keys(loadedFiles).length > 0) {
          loadDirectoryFiles(dirName, `E:\\Projects\\${dirName}`, loadedFiles);
          setScanStatusMessage(`Successfully indexed ${Object.keys(loadedFiles).length} files.`);
          setTimeout(() => setScanStatusMessage(null), 3000);
        } else {
          // If no files matched, create a project skeleton
          openCustomFolder(dirName, `E:\\Projects\\${dirName}`);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native folder selection fallback', err);
          // Fallback to file input
          fileInputRef.current?.click();
        }
      } finally {
        setIsLoadingDirectory(false);
      }
    } else {
      // Fallback for browsers without showDirectoryPicker
      fileInputRef.current?.click();
    }
  };

  // 2. HTML Folder Upload Input Fallback (webkitdirectory)
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsLoadingDirectory(true);
    setScanStatusMessage('Parsing folder files...');

    const loadedFiles: Record<string, string> = {};
    let folderName = 'Uploaded-Project';

    // Get root folder name
    const firstPath = fileList[0].webkitRelativePath || '';
    if (firstPath.includes('/')) {
      folderName = firstPath.split('/')[0];
    }

    const maxFiles = 300;
    let count = 0;

    for (let i = 0; i < fileList.length && count < maxFiles; i++) {
      const file = fileList[i];
      const relPath = file.webkitRelativePath.replace(`${folderName}/`, '');

      // Skip dependency folders
      if (
        relPath.includes('node_modules/') ||
        relPath.includes('.git/') ||
        relPath.includes('dist/') ||
        relPath.includes('.next/')
      ) {
        continue;
      }

      const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md'];
      if (validExts.some((ext) => file.name.endsWith(ext)) && file.size < 500000) {
        try {
          const text = await file.text();
          loadedFiles[relPath] = text;
          count++;
        } catch (err) {}
      }
    }

    if (Object.keys(loadedFiles).length > 0) {
      loadDirectoryFiles(folderName, `E:\\Projects\\${folderName}`, loadedFiles);
      setScanStatusMessage(`Loaded ${Object.keys(loadedFiles).length} files from ${folderName}.`);
      setTimeout(() => setScanStatusMessage(null), 3000);
    }

    setIsLoadingDirectory(false);
  };

  // 3. Manual Path Input Submit
  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFolderName.trim()) return;
    const path = customFolderPath.trim() || `E:\\Projects\\${customFolderName.trim()}`;
    openCustomFolder(customFolderName.trim(), path);
    setCustomFolderName('');
    setCustomFolderPath('');
    setIsPathModalOpen(false);
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
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Boundary Guarded
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
              AXION is bound strictly to your local folder. All terminal executions, AST diff generations, and agent operations execute within this directory boundary.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenNativeDirectory}
              disabled={isLoadingDirectory}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4 text-zinc-900" />
              <span>{isLoadingDirectory ? 'Scanning...' : 'Open Folder'}</span>
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
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{scanStatusMessage}</span>
        </div>
      )}

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
                    <span className="text-[10px] text-zinc-500">(clean working tree)</span>
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
                    <Package className="w-3 h-3 text-zinc-400" />
                    <span>Project Type</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-200 mt-1 truncate">
                    {projectMeta.type}
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
            <div className="flex flex-col gap-2 shrink-0 pt-2 w-full lg:w-48">
              <button
                onClick={handleOpenNativeDirectory}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition shadow-sm"
              >
                <FolderOpen className="w-4 h-4 text-zinc-300" />
                <span>Open Folder</span>
              </button>

              <button
                onClick={() => setIsPathModalOpen(true)}
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
                        <span>branch: {ws.branch}</span>
                        <span>•</span>
                        <span>{ws.lastOpened}</span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </div>
              );
            })}
          </div>
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
              <span>Change or Mount Workspace</span>
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
                  placeholder="e.g. my-awesome-app"
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
                  value={customFolderPath}
                  onChange={(e) => setCustomFolderPath(e.target.value)}
                  placeholder="e.g. E:\Projects\my-awesome-app or /home/user/my-awesome-app"
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
