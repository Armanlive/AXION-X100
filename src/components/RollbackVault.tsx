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
    <div className="flex-1 flex flex-col h-full bg-[#050508] cyber-grid-bg overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-mono tracking-wide">
            <History className="w-4 h-4 text-[#00f0ff] animate-pulse" />
            <span className="text-[#00f0ff] uppercase tracking-wider">SECURE VAULT</span> // Task-Bound Snapshots & 1-Click Rollback
          </h2>
          <p className="text-xs text-cyan-200/60 mt-0.5">
            Every approved task captures an atomic pre-modification snapshot. Revert safely at any quantum state.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-[#080d1a]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00f0ff]" />
          <span>Snapshots Captured: <strong className="text-white font-bold ml-1">{snapshots.length}</strong></span>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-cyan-400/50 text-xs rounded-xl border border-dashed border-cyan-500/20 bg-[#080d1a]/60 backdrop-blur-md">
            No snapshots captured yet. Submit and approve a diff in the Workspace Chat to create a task snapshot.
          </div>
        ) : (
          snapshots.map((snap) => (
            <div
              key={snap.taskId}
              className={`p-4 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                snap.reverted
                  ? 'bg-[#080d1a]/40 border-cyan-500/10 opacity-60'
                  : 'bg-[#080d1a]/80 backdrop-blur-md border-cyan-500/25 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.12)]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950/60 text-[#00f0ff] border border-cyan-500/30">
                    {snap.taskId}
                  </span>
                  <span className="font-medium text-xs text-white">{snap.title}</span>
                  {snap.reverted && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Reverted / Rolled Back
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-cyan-300/50">
                  <div className="flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span className="text-cyan-200/80">{snap.filePath}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400/60" />
                    <span>{snap.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#00f0ff]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Exit code: {snap.exitCode}</span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  disabled={snap.reverted}
                  onClick={() => rollbackTask(snap.taskId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
                    snap.reverted
                      ? 'bg-cyan-950/30 text-cyan-600 cursor-not-allowed border border-cyan-900/30'
                      : 'bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
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
