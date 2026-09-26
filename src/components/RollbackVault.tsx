import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  History,
  RotateCcw,
  CheckCircle2,
  FileCode2,
  ShieldCheck,
  Clock
} from 'lucide-react';

export const RollbackVault: React.FC = () => {
  const { snapshots, rollbackTask } = useAxionStore();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            Task-Bound Snapshots & 1-Click Rollback Vault
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Every approved task captures an atomic pre-modification snapshot. Revert safely at any time.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Snapshots Captured: <strong className="text-white">{snapshots.length}</strong></span>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-2.5">
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs rounded-xl border border-dashed border-zinc-800 bg-[#121214]">
            No snapshots captured yet. Submit and approve a diff in the Workspace Chat to create a task snapshot.
          </div>
        ) : (
          snapshots.map((snap) => (
            <div
              key={snap.taskId}
              className={`p-4 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                snap.reverted
                  ? 'bg-zinc-900/30 border-zinc-800/60 opacity-60'
                  : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                    {snap.taskId}
                  </span>
                  <span className="font-medium text-xs text-white">{snap.title}</span>
                  {snap.reverted && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Reverted / Rolled Back
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-400">{snap.filePath}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition ${
                    snap.reverted
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 shadow-sm'
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
    </div>
  );
};
