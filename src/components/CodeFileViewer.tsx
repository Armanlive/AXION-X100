import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { FileCode, FolderGit2, CheckCircle2 } from 'lucide-react';

export const CodeFileViewer: React.FC = () => {
  const { files, selectedFilePath, selectFile } = useAxionStore();

  const fileList = Object.keys(files);
  const activeContent = files[selectedFilePath] || files[fileList[0]] || '';

  return (
    <div className="w-80 bg-[#080d19] border-l border-[#19243a] flex flex-col h-full select-none shrink-0">
      {/* File Tree Header */}
      <div className="p-3 bg-[#0c1322] border-b border-[#1b263b] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300">
          <FolderGit2 className="w-4 h-4 text-blue-400" />
          <span>Local Filesystem</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">
          In Sync
        </span>
      </div>

      {/* File Tabs / List */}
      <div className="p-2 border-b border-[#19243a] space-y-1">
        {fileList.map((filePath) => {
          const isSelected = selectedFilePath === filePath;
          return (
            <button
              key={filePath}
              onClick={() => selectFile(filePath)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition ${
                isSelected
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111a2c]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{filePath}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Code Content View */}
      <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-slate-300 bg-[#070b14] select-text">
        <div className="text-[10px] text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between mb-2">
          <span>{selectedFilePath}</span>
          <span>{activeContent.split('\n').length} lines</span>
        </div>
        <pre className="whitespace-pre">
          {activeContent}
        </pre>
      </div>
    </div>
  );
};
