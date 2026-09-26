import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
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
  RefreshCw,
  Share2
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
    selectedFilePath,
    selectFile,
    isFilePanelOpen,
    toggleFilePanel,
    workspaces,
    activeWorkspaceId
  } = useAxionStore();

  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    src: true,
    'src/components': true,
    'src/store': true
  });

  if (!isFilePanelOpen) return null;

  const fileList = Object.keys(files);
  const activeContent = files[selectedFilePath] || files[fileList[0]] || '';
  const lines = activeContent.split('\n');
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleCopyContent = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
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

  // Build tree from flat file paths
  const buildFileTree = (): FileNode[] => {
    const root: { [key: string]: any } = {};

    fileList.forEach((filePath) => {
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
      const childKeys = Object.keys(node.__children);

      const children = childKeys.map((key) => formatTree(node.__children[key], key));
      // Sort folders first, then files
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
            className="w-full flex items-center gap-1.5 py-1 text-left text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 transition font-mono"
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
    return (
      <button
        key={node.fullPath}
        onClick={() => selectFile(node.fullPath)}
        style={{ paddingLeft: `${depth * 12 + 18}px` }}
        className={`w-full flex items-center gap-1.5 py-1 text-left text-xs font-mono transition ${
          isSelected
            ? 'bg-zinc-800 text-zinc-100 font-semibold'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
        }`}
        title={node.fullPath}
      >
        {getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  return (
    <div
      className={`bg-[#0c0c0e] border-l border-zinc-800/80 flex flex-col h-full select-none shrink-0 transition-all duration-150 z-20 ${
        isExpanded ? 'w-[560px]' : 'w-80 sm:w-96'
      }`}
    >
      {/* Top Header */}
      <div className="h-10 px-3 bg-[#111114] border-b border-zinc-800/70 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 truncate">
          <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-semibold truncate">{activeWorkspace?.name || 'Workspace'}</span>
          <span className="text-[10px] text-zinc-500 font-sans">({fileList.length})</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopyPath}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title={copiedPath ? 'Path copied!' : 'Copy relative path'}
          >
            {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleCopyContent}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title={copied ? 'Content copied!' : 'Copy current file content'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title={isExpanded ? 'Restore standard width' : 'Expand width'}
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

      {/* Hierarchical Explorer Tree */}
      <div className="max-h-48 overflow-y-auto py-1 border-b border-zinc-800/80 bg-[#0e0e11] shrink-0">
        <div className="px-3 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex items-center justify-between">
          <span>PROJECT FILES</span>
          <span className="text-[9px] text-zinc-600">click to inspect</span>
        </div>
        {fileTree.map((rootNode) => renderTreeNode(rootNode, 0))}
      </div>

      {/* Open File Path Header */}
      <div className="px-3 py-1.5 bg-[#09090b] border-b border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span className="truncate text-zinc-400">{selectedFilePath}</span>
        <span className="shrink-0 ml-2">{lines.length} lines</span>
      </div>

      {/* Code Viewer Body */}
      <div className="flex-1 overflow-auto bg-[#070709] text-zinc-300 font-mono text-xs select-text">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-zinc-900/40 leading-relaxed">
                <td className="w-10 px-2 py-0 text-right select-none text-zinc-600 border-r border-zinc-800/60 text-[11px]">
                  {idx + 1}
                </td>
                <td className="px-3 py-0 whitespace-pre text-[12px] font-mono text-zinc-300">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
