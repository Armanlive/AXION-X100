import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  CheckCircle2,
  Play,
  Award,
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
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner & Overall Score Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-zinc-400" />
            Quality Suite & Pilot Evaluation Log
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            50-Point Quality Metric + Binary Gates Verification (from PILOT_LOG.md)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[#121214] rounded-lg border border-zinc-800">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block font-semibold">
                Score
              </span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {totalScore} / {maxPossible}
              </span>
            </div>
            <div className="h-5 w-[1px] bg-zinc-800" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block font-semibold">
                Gates
              </span>
              <span className="text-sm font-mono font-bold text-zinc-200">
                {passedCount} / {pilotTasks.length} PASS
              </span>
            </div>
          </div>

          <button
            onClick={() => runAllPilotTasks()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition"
          >
            <Play className="w-3.5 h-3.5" />
            Run All Pilot Tests
          </button>
        </div>
      </div>

      {/* 10 Pilot Tasks List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500 uppercase font-semibold">
          <span>10 Core Pilot Tasks Tracker</span>
          <span>Quality Standard: 50-Point Rubric</span>
        </div>

        <div className="space-y-2">
          {pilotTasks.map((task) => (
            <div
              key={task.id}
              className="p-3.5 rounded-xl bg-[#121214] border border-zinc-800/80 hover:border-zinc-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Task {task.id.toString().padStart(2, '0')}
                  </span>
                  <h4 className="text-xs font-semibold text-white">{task.title}</h4>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      task.status === 'passed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : task.status === 'running'
                        ? 'bg-blue-500/10 text-blue-400 animate-pulse'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    ● {task.status.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{task.description}</p>

                <div className="pt-1 flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-500">
                  <span>Scenario: <strong className="text-zinc-400">{task.targetScenario}</strong></span>
                  <span>•</span>
                  <span>Terminal Build: <strong className="text-emerald-400">{task.binaryGates.terminalBuild}</strong></span>
                  <span>•</span>
                  <span>Rollback Verified: <strong className="text-zinc-300">{task.binaryGates.rollbackTested}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.voicePromptHinglish && (
                  <button
                    onClick={() => {
                      executeUserPrompt(task.voicePromptHinglish!, true);
                      setCurrentTab('workspace');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 bg-zinc-800/60 text-zinc-300 hover:text-white text-xs font-mono transition"
                    title="Run via Hinglish Voice Command in Chat"
                  >
                    <Mic className="w-3 h-3 text-zinc-400" />
                    <span>Test Voice</span>
                  </button>
                )}

                <button
                  disabled={task.status === 'running'}
                  onClick={() => runPilotTask(task.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
                >
                  <Play className="w-3 h-3" />
                  <span>{task.status === 'passed' ? 'Re-run' : 'Execute'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
