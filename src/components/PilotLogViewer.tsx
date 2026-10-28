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
    <div className="flex-1 flex flex-col h-full bg-[#050508] cyber-grid-bg overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner & Overall Score Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-mono">
            <Award className="w-4 h-4 text-[#00f0ff] animate-pulse" />
            <span className="text-[#00f0ff] uppercase tracking-wider">DIAGNOSTIC MATRIX</span> // Quality Suite & Pilot Evaluation Log
          </h2>
          <p className="text-xs text-cyan-200/60 mt-0.5">
            50-Point Quality Metric + Binary Gates Verification (from PILOT_LOG.md)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[#080d1a]/80 backdrop-blur-md rounded-lg border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-cyan-400 block font-semibold tracking-wider">
                Score
              </span>
              <span className="text-sm font-mono font-bold text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
                {totalScore} / {maxPossible}
              </span>
            </div>
            <div className="h-5 w-[1px] bg-cyan-500/30" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-cyan-400 block font-semibold tracking-wider">
                Gates
              </span>
              <span className="text-sm font-mono font-bold text-white">
                {passedCount} / {pilotTasks.length} PASS
              </span>
            </div>
          </div>

          <button
            onClick={() => runAllPilotTasks()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all duration-200"
          >
            <Play className="w-3.5 h-3.5 fill-[#050508]" />
            RUN ALL PILOT TESTS
          </button>
        </div>
      </div>

      {/* 10 Pilot Tasks List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-cyan-400 uppercase font-semibold tracking-wider">
          <span>10 Core Pilot Tasks Tracker</span>
          <span className="text-cyan-300/60">Quality Standard: 50-Point Rubric</span>
        </div>

        <div className="space-y-2.5">
          {pilotTasks.map((task) => (
            <div
              key={task.id}
              className="p-3.5 rounded-xl bg-[#080d1a]/70 backdrop-blur-md border border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.12)] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950/80 text-[#00f0ff] border border-cyan-500/30">
                    Task {task.id.toString().padStart(2, '0')}
                  </span>
                  <h4 className="text-xs font-semibold text-white tracking-wide">{task.title}</h4>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      task.status === 'passed'
                        ? 'bg-cyan-500/20 text-[#00f0ff] border border-cyan-400/30'
                        : task.status === 'running'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40 animate-pulse'
                        : 'bg-cyan-950/40 text-cyan-500/70 border border-cyan-900/30'
                    }`}
                  >
                    ● {task.status.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-cyan-200/70 leading-relaxed">{task.description}</p>

                <div className="pt-1 flex flex-wrap items-center gap-3 text-xs font-mono text-cyan-400/50">
                  <span>Scenario: <strong className="text-cyan-200">{task.targetScenario}</strong></span>
                  <span>•</span>
                  <span>Terminal Build: <strong className="text-[#00f0ff]">{task.binaryGates.terminalBuild}</strong></span>
                  <span>•</span>
                  <span>Rollback Verified: <strong className="text-cyan-200">{task.binaryGates.rollbackTested}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.voicePromptHinglish && (
                  <button
                    onClick={() => {
                      executeUserPrompt(task.voicePromptHinglish!, true);
                      setCurrentTab('workspace');
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/40 text-cyan-300 hover:text-white text-xs font-mono transition shadow-sm"
                    title="Run as a voice command in chat"
                  >
                    <Mic className="w-3 h-3 text-[#00f0ff]" />
                    <span>Test Voice</span>
                  </button>
                )}

                <button
                  disabled={task.status === 'running'}
                  onClick={() => runPilotTask(task.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-cyan-500/40 hover:border-cyan-400 text-[#00f0ff] text-xs font-mono font-medium transition shadow-[0_0_10px_rgba(0,240,255,0.1)]"
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
