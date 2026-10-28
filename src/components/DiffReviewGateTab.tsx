import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { DiffViewer } from './DiffViewer';
import { GitCompare, ShieldCheck } from 'lucide-react';

export const DiffReviewGateTab: React.FC = () => {
  const { activeDiff, messages } = useAxionStore();

  const recentDiffMessages = messages.filter((m) => m.proposedDiff);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] cyber-grid-bg overflow-y-auto p-6 space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-mono">
            <GitCompare className="w-4 h-4 text-[#00f0ff] animate-pulse" />
            <span className="text-[#00f0ff] uppercase tracking-wider">SAFETY GATE</span> // Pre-Approval Diff Verification
          </h2>
          <p className="text-xs text-cyan-200/60 mt-0.5">
            Strict verification policy: AI proposes. User approves. Native layer enforces.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#00f0ff] bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
          <ShieldCheck className="w-4 h-4 text-[#00f0ff]" />
          <span>Zero Silent Writes Invariant Active</span>
        </div>
      </div>

      {activeDiff ? (
        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#00f0ff] font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
            Active Pending Diff (Awaiting User Signature)
          </h3>
          <DiffViewer diff={activeDiff} />
        </div>
      ) : (
        <div className="p-8 text-center text-cyan-400/50 text-xs font-mono rounded-xl border border-dashed border-cyan-500/20 bg-[#080d1a]/50 backdrop-blur-md">
          No pending diffs awaiting approval right now. Submit a modification in Workspace Chat to stage a patch.
        </div>
      )}

      {recentDiffMessages.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-cyan-500/20">
          <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400/70 font-semibold">
            Recent Task Diffs History
          </h3>
          <div className="space-y-3">
            {recentDiffMessages.map((msg) =>
              msg.proposedDiff && msg.proposedDiff.id !== activeDiff?.id ? (
                <div key={msg.proposedDiff.id}>
                  <DiffViewer diff={msg.proposedDiff} />
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
};
