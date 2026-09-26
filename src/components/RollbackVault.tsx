import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  History,
  RotateCcw,
  CheckCircle2,
  FileCode2,
  ShieldCheck,
  Clock,
  ArrowRight
} from 'lucide-react';

export const RollbackVault: React.FC = () => {
  const { snapshots, rollbackTask } = useAxionStore();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1c2940]">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            Task-Bound Snapshots & 1-Click Rollback Vault
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every approved task captures an atomic pre-modification snapshot. Revert safely at any time.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-[#121c2e] px-3 py-1.5 rounded-lg border border-[#20304c]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Snapshots Captured: <strong>{snapshots.length}</strong></span>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs rounded-xl border border-dashed border-[#233554] bg-[#0c1322]">
            No snapshots captured yet. Submit and approve a diff in the Engineering Chat to create a task snapshot.
          </div>
        ) : (
          snapshots.map((snap) => (
            <div
              key={snap.taskId}
              className={`p-4 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                snap.reverted
                  ? 'bg-slate-900/30 border-slate-800 opacity-60'
                  : 'bg-[#0f172a] border-[#1d2d47] hover:border-slate-600'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {snap.taskId}
                  </span>
                  <span className="font-semibold text-xs text-white">{snap.title}</span>
                  {snap.reverted && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Reverted / Rolled Back
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{snap.filePath}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{snap.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Exit code: {snap.exitCode}</span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  disabled={snap.reverted}
                  onClick={() => rollbackTask(snap.taskId)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition ${
                    snap.reverted
                      ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                      : 'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 shadow-sm'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {snap.reverted ? 'Already Reverted' : '1-Click Rollback'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rollback Safety Invariant */}
      <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e2e4a] text-xs text-slate-300 space-y-2">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          Isolated Atomic Rollback Guarantee
        </h4>
        <p className="leading-relaxed text-slate-400">
          Rolling back a task restores the exact snapshot byte buffer saved at the moment prior to approval. AXION-X100 updates the local file on disk and verifies with the native terminal build pipeline to ensure zero orphan AST mutations.
        </p>
      </div>
    </div>
  );
};
