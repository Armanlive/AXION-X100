import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { detectFileLanguage, isBinaryFile } from '../utils/workspaceService';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-toml';
import {
  FileCode,
  Folder,
  FolderOpen,
  FolderGit2,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  FileText,
  FileJson,
  Code2,
  Share2,
  AlertCircle,
  Search,
  RefreshCw,
  Plus,
  FolderPlus,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  SearchCode,
  FilePlus2,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

interface FileNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  children?: FileNode[];
}

export const CodeFileViewer: React.FC = () => {
  const {
    files,
    filesIndex,
    selectedFilePath,
    selectFile,
    isFilePanelOpen,
    toggleFilePanel,
    activeWorkspace,
    unsavedFileChanges,
    updateFileDraft,
    discardFileDraft,
    initiateManualSave,
    pendingUnsavedConfirm,
    confirmDiscardAndProceed,
    cancelDiscardConfirm,
    refreshWorkspaceFiles,
    createNewFile,
    createNewFolder,
    deleteFileOrFolder,
    askAxionAboutFile,
    auxPanelWidth,
    setAuxPanelWidth
  } = useAxionStore();

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    src: true,
    'src/components': true,
    'src/store': true,
    'src/utils': true
  });

  // New File/Folder Modals
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isAskMenuOpen, setIsAskMenuOpen] = useState(false);

  // In-Editor Find (Ctrl+F)
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  // Active File Data
  const currentSavedContent = files[selectedFilePath] ?? '';
  const currentDraftContent = unsavedFileChanges[selectedFilePath];
  const activeContent = currentDraftContent !== undefined ? currentDraftContent : currentSavedContent;
  const isDirty = currentDraftContent !== undefined && currentDraftContent !== currentSavedContent;

  const activeLanguage = useMemo(() => detectFileLanguage(selectedFilePath), [selectedFilePath]);
  const isBinary = useMemo(() => isBinaryFile(selectedFilePath), [selectedFilePath]);
  const lines = useMemo(() => activeContent.split('\n'), [activeContent]);

  // Syntax Highlighting using Prism
  const highlightedCode = useMemo(() => {
    if (isBinary || !activeContent) return '';
    const prismLang = Prism.languages[activeLanguage] || Prism.languages.javascript || Prism.languages.plaintext;
    try {
      return Prism.highlight(activeContent, prismLang, activeLanguage);
    } catch {
      return activeContent;
    }
  }, [activeContent, activeLanguage, isBinary]);

  // Key Bindings: Ctrl+S to review/save, Ctrl+F for editor find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty) {
          initiateManualSave(selectedFilePath);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (isFilePanelOpen) {
          e.preventDefault();
          setIsFindOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, selectedFilePath, isFilePanelOpen]);

  if (!isFilePanelOpen) return null;

  // Filter file list by search query
  const allFilePaths = filesIndex.length > 0
    ? filesIndex.filter((f) => !f.isDirectory).map((f) => f.relativePath)
    : Object.keys(files);

  const filteredPaths = searchQuery.trim()
    ? allFilePaths.filter(
        (p) =>
          p.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.split('/').pop()?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allFilePaths;

  // Build File Tree
  const buildFileTree = (): FileNode[] => {
    const root: { [key: string]: any } = {};

    filteredPaths.forEach((filePath) => {
      const parts = filePath.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        if (!current[part]) {
          current[part] = {
            __isFolder: !isFile,
            __fullPath: parts.slice(0, index + 1).join('/'),
            __children: {}
          };
        }
        current = current[part].__children;
      });
    });

    const formatTree = (node: any, name: string): FileNode => {
      const isFolder = node.__isFolder;
      const fullPath = node.__fullPath;
      const childKeys = Object.keys(node.__children || {});

      const children = childKeys.map((key) => formatTree(node.__children[key], key));
      children.sort((a, b) => {
        if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
        return a.isFolder ? -1 : 1;
      });

      return {
        name,
        fullPath,
        isFolder,
        children: isFolder ? children : undefined
      };
    };

    return Object.keys(root).map((key) => formatTree(root[key], key));
  };

  const fileTree = buildFileTree();

  const handleCopyContent = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    if (!selectedFilePath) return;
    navigator.clipboard.writeText(selectedFilePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const toggleFolder = (folderPath: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Editor Textarea Change & Indentation
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateFileDraft(selectedFilePath, e.target.value);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const val = target.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      updateFileDraft(selectedFilePath, newVal);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const ok = await createNewFile(newFileName.trim());
    if (ok) {
      setNewFileName('');
      setIsNewFileModalOpen(false);
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const ok = await createNewFolder(newFolderName.trim());
    if (ok) {
      setNewFolderName('');
      setIsNewFolderModalOpen(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      return <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (fileName.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (fileName.endsWith('.css')) {
      return <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
    if (fileName.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    return <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  const renderTreeNode = (node: FileNode, depth = 0) => {
    if (node.isFolder) {
      const isOpen = openFolders[node.fullPath] ?? true;
      return (
        <div key={node.fullPath}>
          <button
            onClick={() => toggleFolder(node.fullPath)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="w-full flex items-center gap-1.5 py-1 text-left text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 transition font-mono group"
          >
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
            )}
            <span className="truncate text-zinc-300 font-medium">{node.name}</span>
          </button>
          {isOpen && node.children && (
            <div>
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedFilePath === node.fullPath;
    const isFileDirty = unsavedFileChanges[node.fullPath] !== undefined;

    return (
      <div
        key={node.fullPath}
        className={`w-full flex items-center justify-between group transition pr-2 ${
          isSelected
            ? 'bg-zinc-800 text-zinc-100 font-semibold'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
        }`}
      >
        <button
          onClick={() => selectFile(node.fullPath)}
          style={{ paddingLeft: `${depth * 12 + 18}px` }}
          className="flex-1 flex items-center gap-1.5 py-1 text-left text-xs font-mono truncate"
          title={node.fullPath}
        >
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
          {isFileDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1" title="Unsaved changes" />
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete file "${node.name}"?`)) {
              deleteFileOrFolder(node.fullPath);
            }
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 transition rounded"
          title="Delete file"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <div
      style={{ width: isExpanded ? '100%' : `${auxPanelWidth || 480}px` }}
      className="bg-[#0c0c0e] border-l border-zinc-800/80 flex flex-col h-full select-none shrink-0 overflow-hidden relative z-20 transition-all"
    >
      {/* Top Header Bar */}
      <div className="h-10 px-3 bg-[#111114] border-b border-zinc-800/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 truncate">
          <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-semibold truncate">{activeWorkspace?.name || 'No Workspace'}</span>
          {allFilePaths.length > 0 && (
            <span className="text-[10px] text-zinc-500 font-sans">({allFilePaths.length})</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsNewFileModalOpen(true)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsNewFolderModalOpen(true)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={refreshWorkspaceFiles}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Refresh workspace files"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title={isExpanded ? 'Restore standard width' : 'Maximize editor width'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => toggleFilePanel(false)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Close file panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!activeWorkspace ? (
        <div className="p-6 text-center text-xs text-zinc-400 flex flex-col items-center justify-center flex-1 space-y-3">
          <Folder className="w-8 h-8 text-zinc-600" />
          <p>No workspace selected.</p>
        </div>
      ) : (
        <>
          {/* File Search Control */}
          <div className="p-2 border-b border-zinc-800/80 bg-[#0e0e11] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Collapsible File Explorer Tree */}
          <div className="max-h-44 overflow-y-auto py-1 border-b border-zinc-800/80 bg-[#0e0e11] shrink-0">
            <div className="px-3 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>EXPLORER</span>
              <span className="text-[9px] text-zinc-600">click to open</span>
            </div>
            {fileTree.length === 0 ? (
              <div className="px-4 py-2 text-xs text-zinc-500 italic">
                {searchQuery ? 'No matching files found.' : 'No files in workspace.'}
              </div>
            ) : (
              fileTree.map((rootNode) => renderTreeNode(rootNode, 0))
            )}
          </div>

          {/* Active File Editor Header & Action Bar */}
          {selectedFilePath ? (
            <div className="px-3 py-1.5 bg-[#09090b] border-b border-zinc-800/80 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono text-zinc-300 truncate">{selectedFilePath}</span>
                {isDirty && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Modified
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Ask AXION Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsAskMenuOpen(!isAskMenuOpen)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium border border-zinc-700 transition"
                    title="Send file context to AXION Chat"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Ask AXION</span>
                  </button>

                  {isAskMenuOpen && (
                    <div className="absolute right-0 top-7 w-48 bg-[#18181b] border border-zinc-700 rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                      <button
                        onClick={() => {
                          askAxionAboutFile(selectedFilePath, 'Explain this file');
                          setIsAskMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-zinc-200"
                      >
                        Explain this file
                      </button>
                      <button
                        onClick={() => {
                          askAxionAboutFile(selectedFilePath, 'Find bugs and security issues in this file');
                          setIsAskMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-zinc-200"
                      >
                        Find bugs & issues
                      </button>
                      <button
                        onClick={() => {
                          askAxionAboutFile(selectedFilePath, 'Refactor this component/code for clarity and performance');
                          setIsAskMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-zinc-200"
                      >
                        Refactor code
                      </button>
                      <button
                        onClick={() => {
                          askAxionAboutFile(selectedFilePath, 'Write automated unit tests for this file');
                          setIsAskMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-zinc-200"
                      >
                        Write unit tests
                      </button>
                    </div>
                  )}
                </div>

                {/* Save & Discard Buttons */}
                {isDirty && (
                  <>
                    <button
                      onClick={() => discardFileDraft(selectedFilePath)}
                      className="px-2 py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition"
                      title="Discard unsaved changes"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => initiateManualSave(selectedFilePath)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold shadow-sm transition"
                      title="Review changes and save (Ctrl+S)"
                    >
                      <Save className="w-3 h-3" />
                      <span>Review & Save</span>
                    </button>
                  </>
                )}

                <button
                  onClick={handleCopyContent}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                  title={copied ? 'Copied!' : 'Copy file content'}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ) : null}

          {/* In-Editor Find Bar (Ctrl+F) */}
          {isFindOpen && (
            <div className="px-3 py-1.5 bg-[#121215] border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <SearchCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder="Find in current file..."
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 flex-1 font-mono"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setIsFindOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Code Editor Body */}
          <div className="flex-1 relative flex overflow-hidden bg-[#070709]">
            {isBinary ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <FileCode className="w-10 h-10 text-zinc-600" />
                <div className="text-xs text-zinc-400 font-mono">
                  Binary file format ({selectedFilePath.split('.').pop()?.toUpperCase()})
                </div>
                <p className="text-[11px] text-zinc-500 max-w-xs">
                  Binary files are not displayed in the text code editor to prevent corruption.
                </p>
              </div>
            ) : selectedFilePath ? (
              <div className="flex-1 flex h-full relative overflow-hidden font-mono text-xs">
                {/* Line Numbers Column */}
                <div
                  ref={lineNumbersRef}
                  className="w-10 py-3 bg-[#08080a] border-r border-zinc-850 text-right pr-2 select-none text-zinc-600 text-[11px] font-mono shrink-0 overflow-hidden leading-relaxed"
                >
                  {lines.map((_, idx) => (
                    <div key={idx}>{idx + 1}</div>
                  ))}
                </div>

                {/* Editor Surface */}
                <div className="flex-1 relative h-full overflow-auto">
                  {/* Highlighting Overlay (background) */}
                  <pre
                    aria-hidden="true"
                    className="absolute inset-0 p-3 m-0 pointer-events-none font-mono text-xs whitespace-pre leading-relaxed overflow-hidden text-zinc-300"
                    dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }}
                  />

                  {/* Interactive Transparent Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={activeContent}
                    onChange={handleEditorChange}
                    onKeyDown={handleEditorKeyDown}
                    onScroll={handleScroll}
                    spellCheck={false}
                    className="absolute inset-0 p-3 m-0 bg-transparent text-transparent caret-emerald-400 font-mono text-xs whitespace-pre leading-relaxed resize-none focus:outline-none overflow-auto select-text selection:bg-zinc-700/60 selection:text-white"
                    placeholder="Enter code here..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 text-xs text-zinc-500 italic">
                Select a file from the explorer to open and edit.
              </div>
            )}
          </div>

          {/* Status & Metadata Footer */}
          {selectedFilePath && (
            <div className="h-6 px-3 bg-[#09090b] border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <span className="uppercase text-zinc-400">{activeLanguage}</span>
                <span>•</span>
                <span>{lines.length} lines</span>
                <span>•</span>
                <span>{activeContent.length} chars</span>
              </div>
              <div className="flex items-center gap-2">
                {isDirty ? (
                  <span className="text-amber-400 font-medium">Unsaved Draft</span>
                ) : (
                  <span className="text-emerald-500">Saved</span>
                )}
                <span>•</span>
                <span>UTF-8</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Unsaved Changes Protection Modal */}
      {pendingUnsavedConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-[#141417] border border-zinc-800 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Unsaved Changes</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  You have unsaved changes in <code className="text-zinc-200 font-mono">{pendingUnsavedConfirm.filePath}</code>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={cancelDiscardConfirm}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscardAndProceed}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
              >
                Discard Edits
              </button>
              <button
                onClick={() => {
                  initiateManualSave(pendingUnsavedConfirm.filePath);
                  cancelDiscardConfirm();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Review & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-[#141417] border border-zinc-800 rounded-xl max-w-sm w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setIsNewFileModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <FilePlus2 className="w-4 h-4 text-zinc-300" />
              <span>Create New File</span>
            </h3>

            <form onSubmit={handleCreateFileSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Relative Path & Name
                </label>
                <input
                  type="text"
                  required
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. src/components/Button.tsx"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-[#141417] border border-zinc-800 rounded-xl max-w-sm w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setIsNewFolderModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <FolderPlus className="w-4 h-4 text-zinc-300" />
              <span>Create New Folder</span>
            </h3>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Folder Path
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. src/services"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
