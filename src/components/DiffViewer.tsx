import React from 'react';
import { DiffHunk } from '../types';
import { useAxionStore } from '../store/useAxionStore';
import { Check, X, ShieldAlert, FileCode2, Split, Rows } from 'lucide-react';

interface DiffViewerProps {
  diff: DiffHunk;
  onApprove?: () => void;
  onReject?: () => void;
  isModal?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  onApprove,
  onReject,
  isModal = false
}) => {
  const { diffViewMode, setDiffViewMode, approveDiff, rejectDiff } = useAxionStore();

  const handleApprove = () => {
    if (onApprove) onApprove();
    else approveDiff(diff.id);
  };

  const handleReject = () => {
    if (onReject) onReject();
    else rejectDiff(diff.id);
  };

  const oldLines = diff.oldContent.split('\n');
  const newLines = diff.newContent.split('\n');

  // Simple line diff calculation
  const maxLines = Math.max(oldLines.length, newLines.length);

  return (
    <div
      className={`rounded-xl border border-[#22324f] bg-[#0c1322] flex flex-col overflow-hidden shadow-2xl ${
        isModal ? 'max-h-[82vh]' : 'my-3'
      }`}
    >
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-[#10192b] border-b border-[#202f4a] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-blue-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            {diff.filePath}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {diff.taskId}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {diff.timestamp}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-[#172238] rounded-lg p-0.5 border border-[#243552]">
            <button
              onClick={() => setDiffViewMode('side-by-side')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                diffViewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Split className="w-3 h-3" />
              Side-by-Side
            </button>
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                diffViewMode === 'unified'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rows className="w-3 h-3" />
              Unified
            </button>
          </div>

          {/* Status Badge */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium ${
              diff.status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : diff.status === 'rejected'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {diff.status === 'pending_approval' ? 'Pending Approval' : diff.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Summary Prompt Description */}
      <div className="px-4 py-2 bg-[#0e1628] border-b border-[#1b273d] text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-blue-400">Proposed Change:</span>
          <span>{diff.summary}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-amber-400">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Native write protected</span>
        </div>
      </div>

      {/* Diff Code View Body */}
      <div className="flex-1 overflow-auto max-h-[460px] font-mono text-[11px] leading-relaxed select-text">
        {diffViewMode === 'side-by-side' ? (
          <div className="grid grid-cols-2 divide-x divide-[#1d2b45] min-w-[700px]">
            {/* Original Column */}
            <div className="bg-[#090e1a]/80">
              <div className="px-3 py-1 bg-[#10182a] text-[10px] uppercase font-semibold text-slate-400 sticky top-0 border-b border-[#1a263c]">
                Original (Disk)
              </div>
              <table className="w-full">
                <tbody>
                  {Array.from({ length: maxLines }).map((_, i) => {
                    const line = oldLines[i];
                    const isDiff = line !== newLines[i];
                    return (
                      <tr
                        key={i}
                        className={
                          isDiff
                            ? 'bg-red-950/30 hover:bg-red-950/40 text-red-200'
                            : 'hover:bg-slate-900/40 text-slate-400'
                        }
                      >
                        <td className="w-8 px-2 py-0.5 text-right select-none text-slate-400 border-r border-[#1a253a]">
                          {line !== undefined ? i + 1 : ''}
                        </td>
                        <td className="px-3 py-0.5 whitespace-pre font-mono">
                          {line !== undefined ? line : ' '}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Proposed Column */}
            <div className="bg-[#0b1222]">
              <div className="px-3 py-1 bg-[#121c30] text-[10px] uppercase font-semibold text-emerald-400 sticky top-0 border-b border-[#1a263c] flex items-center justify-between">
                <span>Proposed (AI Patch)</span>
                <span className="text-[10px] text-slate-400">Zero-Cost Free Tier</span>
              </div>
              <table className="w-full">
                <tbody>
                  {Array.from({ length: maxLines }).map((_, i) => {
                    const line = newLines[i];
                    const isDiff = line !== oldLines[i];
                    return (
                      <tr
                        key={i}
                        className={
                          isDiff
                            ? 'bg-emerald-950/35 hover:bg-emerald-950/50 text-emerald-200 font-medium'
                            : 'hover:bg-slate-900/40 text-slate-300'
                        }
                      >
                        <td className="w-8 px-2 py-0.5 text-right select-none text-slate-400 border-r border-[#1a253a]">
                          {line !== undefined ? i + 1 : ''}
                        </td>
                        <td className="px-3 py-0.5 whitespace-pre font-mono">
                          {line !== undefined ? line : ' '}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Unified View */
          <div className="bg-[#090f1d] min-w-[500px]">
            <table className="w-full">
              <tbody>
                {newLines.map((line, idx) => {
                  const isAdded = !oldLines.includes(line);
                  return (
                    <tr
                      key={idx}
                      className={
                        isAdded
                          ? 'bg-emerald-950/30 text-emerald-200'
                          : 'text-slate-300 hover:bg-slate-900/40'
                      }
                    >
                      <td className="w-10 px-2 py-0.5 text-right select-none text-slate-400 border-r border-[#1a253a]">
                        {idx + 1}
                      </td>
                      <td className="w-6 px-1 text-center font-bold">
                        {isAdded ? '+' : ' '}
                      </td>
                      <td className="px-3 py-0.5 whitespace-pre font-mono">
                        {line}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Approval Gate Footer */}
      {diff.status === 'pending_approval' && (
        <div className="p-3 bg-[#0d1526] border-t border-[#1e2c45] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-white">Safety Gate:</span>
            <span>Approve to execute native disk write & trigger build test.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition"
            >
              <X className="w-3.5 h-3.5" />
              Reject & Abort
            </button>

            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/20 transition"
            >
              <Check className="w-3.5 h-3.5" />
              Approve & Apply to Disk
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
