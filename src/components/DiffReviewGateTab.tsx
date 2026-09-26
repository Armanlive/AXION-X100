import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { DiffViewer } from './DiffViewer';
import { GitCompare, ShieldCheck } from 'lucide-react';

export const DiffReviewGateTab: React.FC = () => {
  const { activeDiff, messages } = useAxionStore();

  const recentDiffMessages = messages.filter((m) => m.proposedDiff);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-y-auto p-6 space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-zinc-400" />
            Pre-Approval Diff Safety Gate
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Strict verification policy: AI proposes. User approves. Native layer enforces.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero Silent Writes Invariant Active</span>
        </div>
      </div>

      {activeDiff ? (
        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Active Pending Diff (Awaiting User Signature)
          </h3>
          <DiffViewer diff={activeDiff} />
        </div>
      ) : (
        <div className="p-8 text-center text-zinc-500 text-xs rounded-xl border border-dashed border-zinc-800 bg-[#121214]">
          No pending diffs awaiting approval right now. Submit a modification in Workspace Chat to stage a patch.
        </div>
      )}

      {recentDiffMessages.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-zinc-800">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
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
