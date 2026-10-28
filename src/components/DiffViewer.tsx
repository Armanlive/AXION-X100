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
    approveDiff(diff.id);
    if (onApprove) onApprove();
  };

  const handleReject = () => {
    rejectDiff(diff.id);
    if (onReject) onReject();
  };

  const oldLines = diff.oldContent.split('\n');
  const newLines = diff.newContent.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  return (
    <div
      className={`rounded-2xl border border-cyan-500/25 bg-[#070c18] flex flex-col overflow-hidden shadow-[0_0_25px_rgba(0,240,255,0.1)] ${
        isModal ? 'max-h-[82vh]' : 'my-2'
      }`}
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-[#0a1224] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-[#00f0ff]" />
          <span className="font-mono text-xs font-semibold text-white">
            {diff.filePath}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
            {diff.taskId}
          </span>
          <span className="text-[10px] text-cyan-400/60 font-mono hidden sm:inline">
            {diff.timestamp}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-[#080d1a] rounded-lg p-0.5 border border-cyan-500/25">
            <button
              onClick={() => setDiffViewMode('side-by-side')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium flex items-center gap-1 transition ${
                diffViewMode === 'side-by-side'
                  ? 'bg-cyan-950/80 text-[#00f0ff] border border-cyan-500/40 shadow-sm'
                  : 'text-cyan-400/60 hover:text-white'
              }`}
            >
              <Split className="w-3 h-3" />
              Side-by-Side
            </button>
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium flex items-center gap-1 transition ${
                diffViewMode === 'unified'
                  ? 'bg-cyan-950/80 text-[#00f0ff] border border-cyan-500/40 shadow-sm'
                  : 'text-cyan-400/60 hover:text-white'
              }`}
            >
              <Rows className="w-3 h-3" />
              Unified
            </button>
          </div>

          {/* Status Badge */}
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold ${
              diff.status === 'approved'
                ? 'bg-cyan-950/80 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : diff.status === 'rejected'
                ? 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                : 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
            }`}
          >
            {diff.status === 'pending_approval' ? 'Pending Approval' : diff.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Summary Prompt Description */}
      <div className="px-3.5 py-1.5 bg-[#080e1c] border-b border-cyan-500/15 text-xs text-cyan-200 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2 truncate">
          <span className="font-medium text-zinc-400">Patch Summary:</span>
          <span className="truncate text-zinc-200">{diff.summary}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-500 shrink-0 ml-2">
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>Protected Sandbox</span>
        </div>
      </div>

      {/* Diff Code View Body */}
      <div className="flex-1 overflow-auto max-h-[460px] font-mono text-[11px] leading-relaxed select-text">
        {diffViewMode === 'side-by-side' ? (
          <div className="grid grid-cols-2 divide-x divide-zinc-800 min-w-[640px]">
            {/* Original Column */}
            <div className="bg-[#09090b]">
              <div className="px-3 py-1 bg-[#101014] text-[10px] uppercase font-semibold text-zinc-500 sticky top-0 border-b border-zinc-800">
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
                            ? 'bg-rose-950/20 text-rose-300'
                            : 'hover:bg-zinc-900/40 text-zinc-400'
                        }
                      >
                        <td className="w-8 px-2 py-0.5 text-right select-none text-zinc-600 border-r border-zinc-800/60">
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
            <div className="bg-[#0b0b0e]">
              <div className="px-3 py-1 bg-[#101014] text-[10px] uppercase font-semibold text-emerald-400 sticky top-0 border-b border-zinc-800 flex items-center justify-between">
                <span>Proposed AST Patch</span>
                <span className="text-[10px] text-zinc-500 font-normal">Zero-Cost Tier</span>
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
                            ? 'bg-emerald-950/25 text-emerald-200 font-medium'
                            : 'hover:bg-zinc-900/40 text-zinc-300'
                        }
                      >
                        <td className="w-8 px-2 py-0.5 text-right select-none text-zinc-600 border-r border-zinc-800/60">
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
          <div className="bg-[#09090b] min-w-[500px]">
            <table className="w-full">
              <tbody>
                {newLines.map((line, idx) => {
                  const isAdded = !oldLines.includes(line);
                  return (
                    <tr
                      key={idx}
                      className={
                        isAdded
                          ? 'bg-emerald-950/25 text-emerald-200'
                          : 'text-zinc-300 hover:bg-zinc-900/40'
                      }
                    >
                      <td className="w-10 px-2 py-0.5 text-right select-none text-zinc-600 border-r border-zinc-800/60">
                        {idx + 1}
                      </td>
                      <td className="w-6 px-1 text-center font-bold text-emerald-400">
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
        <div className="p-3 bg-[#080d1a] border-t border-cyan-500/25 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
            <span className="font-bold text-white">Diff Gate:</span>
            <span>Approve to execute native disk write and verify build.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-xs font-mono font-medium transition"
            >
              <X className="w-3.5 h-3.5" />
              Reject Patch
            </button>

            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)] transition"
            >
              <Check className="w-3.5 h-3.5" />
              Approve & Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
