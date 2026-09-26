import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Award,
  ShieldCheck,
  FileCheck,
  Mic,
  Cpu
} from 'lucide-react';

export const PilotLogViewer: React.FC = () => {
  const {
    pilotTasks,
    runPilotTask,
    runAllPilotTasks,
    executeUserPrompt,
    setCurrentTab
  } = useAxionStore();

  const totalScore = pilotTasks.reduce((acc, t) => acc + (t.score || 0), 0);
  const maxPossible = pilotTasks.length * 50;
  const passedCount = pilotTasks.filter((t) => t.status === 'passed').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner & Overall Score Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1c2940]">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Phase 15 — Real User Pilot Evaluation Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            50-Point Quality Metric + Binary Gates Verification (from PILOT_LOG.md)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-[#121c2e] rounded-xl border border-[#20304c]">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">
                Overall Quality
              </span>
              <span className="text-base font-mono font-bold text-emerald-400">
                {totalScore} / {maxPossible}
              </span>
            </div>
            <div className="h-6 w-[1px] bg-slate-700" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">
                Binary Gates
              </span>
              <span className="text-base font-mono font-bold text-blue-400">
                {passedCount} / {pilotTasks.length} PASS
              </span>
            </div>
          </div>

          <button
            onClick={() => runAllPilotTasks()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
          >
            <Play className="w-4 h-4" />
            Run All Pilot Tests
          </button>
        </div>
      </div>

      {/* 10 Pilot Tasks Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase font-semibold">
          <span>10 Core Pilot Tasks Tracker</span>
          <span>Quality Standard: 50-Point Rubric</span>
        </div>

        <div className="space-y-2.5">
          {pilotTasks.map((task) => (
            <div
              key={task.id}
              className="p-4 rounded-xl bg-[#0f172a] border border-[#1e2e4a] hover:border-slate-600 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Task {task.id.toString().padStart(2, '0')}
                  </span>
                  <h4 className="text-xs font-bold text-white">{task.title}</h4>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      task.status === 'passed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : task.status === 'running'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}
                  >
                    ● {task.status.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {task.description}
                </p>

                {task.voicePromptHinglish && (
                  <div className="flex items-center gap-1.5 text-[11px] text-sky-400 font-mono">
                    <Mic className="w-3 h-3 text-red-400" />
                    <span>Hinglish Prompt: <em>"{task.voicePromptHinglish}"</em></span>
                  </div>
                )}

                {/* Score Breakdown Pill */}
                {task.breakdown && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-slate-400">
                    <span className="bg-[#141f33] px-1.5 py-0.5 rounded border border-[#233552]">
                      Understanding: {task.breakdown.requirementUnderstanding}/10
                    </span>
                    <span className="bg-[#141f33] px-1.5 py-0.5 rounded border border-[#233552]">
                      Context: {task.breakdown.contextFileSelection}/10
                    </span>
                    <span className="bg-[#141f33] px-1.5 py-0.5 rounded border border-[#233552]">
                      Diff Quality: {task.breakdown.diffQuality}/10
                    </span>
                    <span className="bg-[#141f33] px-1.5 py-0.5 rounded border border-[#233552]">
                      Safety Gate: {task.breakdown.safetyPermissionGate}/10
                    </span>
                    <span className="bg-[#141f33] px-1.5 py-0.5 rounded border border-[#233552]">
                      Time Saved: {task.breakdown.timeSaved}/10
                    </span>
                  </div>
                )}
              </div>

              {/* Right Scores & Execution CTA */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {task.score || 0} / 50
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Build: <strong className="text-emerald-400">{task.binaryGates.terminalBuild}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setCurrentTab('workspace');
                      executeUserPrompt(task.suggestedPrompt, !!task.voicePromptHinglish);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#141e33] hover:bg-[#1a2947] border border-[#233657] text-slate-200 text-xs font-semibold transition"
                    title="Send prompt to Engineering Chat"
                  >
                    Open in Chat
                  </button>

                  <button
                    disabled={task.status === 'running'}
                    onClick={() => runPilotTask(task.id)}
                    className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs transition"
                    title="Re-run verification gate"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
