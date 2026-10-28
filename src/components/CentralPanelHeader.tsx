import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { AxionHologramRing, AxionVisualizerState } from './AxionHologramRing';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  Plus,
  Radio,
  ChevronDown,
  Layers,
  Cpu,
  Zap,
  Maximize2,
  Folder,
  GitBranch
} from 'lucide-react';

interface CentralPanelHeaderProps {
  isRecording?: boolean;
  audioLevel?: number;
  onToggleVoiceRecording?: () => void;
  onOpenModelMenu?: () => void;
  onOpenAgentMenu?: () => void;
}

export const CentralPanelHeader: React.FC<CentralPanelHeaderProps> = ({
  isRecording = false,
  audioLevel = 0,
  onToggleVoiceRecording,
  onOpenModelMenu,
  onOpenAgentMenu,
}) => {
  const {
    isWorking,
    speechState,
    speakingMessageId,
    speechMode,
    setSpeechMode,
    selectedAgentId,
    agents,
    isBossLocked,
    isManualMode,
    models,
    activeModelId,
    audioTtsEnabled,
    toggleAudioTts,
    isMicMuted,
    toggleMicMute,
    createNewChat,
    setCurrentTab,
    activeChatId,
    chatSessions,
    activeWorkspace,
    activeWorkspaceId,
    workspaces
  } = useAxionStore();

  const [showHoloModal, setShowHoloModal] = useState(false);

  // Currently bound local project/branch for this chat session
  const boundSession = chatSessions.find((s) => s.id === activeChatId);
  const boundId = boundSession?.workspaceId || activeWorkspaceId;
  const boundWs =
    (activeWorkspace && activeWorkspace.id === boundId ? activeWorkspace : null) ||
    workspaces.find((w) => w.id === boundId) ||
    activeWorkspace;
  const boundBranch: string = !boundWs
    ? ''
    : ('gitBranch' in boundWs ? boundWs.gitBranch : boundWs.branch) || 'main';

  // Compute live visualizer state
  const visualizerState: AxionVisualizerState = isRecording || speechState === 'listening'
    ? 'listening'
    : isWorking || speechState === 'thinking' || speechState === 'working' || speechState === 'understanding'
    ? 'thinking'
    : speechState === 'speaking'
    ? 'speaking'
    : speakingMessageId !== null
    ? 'rendering'
    : 'idle';

  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const activeModel = models.find((m) => m.id === activeModelId) || models[0];

  const getStatusText = () => {
    switch (visualizerState) {
      case 'listening':
        return 'LISTENING';
      case 'thinking':
        return 'THINKING';
      case 'rendering':
      case 'speaking':
        return 'SPEAKING';
      case 'idle':
      default:
        return 'READY';
    }
  };

  const getStatusColor = () => {
    switch (visualizerState) {
      case 'listening':
        return 'text-[#00f0ff]';
      case 'thinking':
        return 'text-[#38bdf8]';
      case 'rendering':
      case 'speaking':
        return 'text-[#00f0ff]';
      case 'idle':
      default:
        return 'text-cyan-400/80';
    }
  };

  return (
    <>
      <div className="h-14 bg-[#050508]/90 backdrop-blur-xl border-b border-cyan-500/20 px-4 flex items-center justify-between select-none shrink-0 z-20 shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
        {/* Left: AXION Live Hologram Visualizer & HUD Telemetry */}
        <div className="flex items-center gap-3">
          {/* Live Holographic / Kinetic Pulse Ring */}
          <div
            onClick={() => setShowHoloModal(true)}
            title="Click to inspect holographic reactor"
            className="cursor-pointer group flex items-center justify-center relative"
          >
            <AxionHologramRing
              state={visualizerState}
              audioLevel={isRecording ? audioLevel || 0.6 : 0}
              size="header"
              interactive={true}
            />
            <div className="absolute -inset-1 rounded-full border border-cyan-500/0 group-hover:border-cyan-400/40 group-hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all pointer-events-none" />
          </div>

          {/* Telemetry Readouts */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-wider text-white">
                AXION<span className="text-[#00f0ff]">-X100</span>
              </span>
              <span className="text-zinc-600 font-mono text-[10px]">/</span>
              <span className="text-[9px] font-mono tracking-widest uppercase text-cyan-300/70 hidden sm:inline">
                HOLOGRAPHIC HUD
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[9px] font-mono text-[#00f0ff] tracking-tight">
                432.0 Hz
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  visualizerState === 'idle'
                    ? 'bg-cyan-400 shadow-[0_0_6px_#00f0ff]'
                    : 'bg-[#00f0ff] animate-ping'
                }`}
              />
              <span className={`text-[10px] font-mono font-semibold tracking-wide ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Bound Project Badge + Agent & Model HUD Pills */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Bound Local Project / Branch Badge */}
          {boundWs ? (
            <button
              onClick={() => setCurrentTab('local_workspace')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1020]/80 hover:bg-[#0e172e] border border-cyan-500/30 hover:border-cyan-400/60 text-xs font-mono transition shadow-[0_0_10px_rgba(0,240,255,0.1)] max-w-[240px]"
              title={`Chat bound to ${boundWs.name} · branch ${boundBranch}\nClick to switch project`}
            >
              <Folder className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
              <span className="text-[11px] font-semibold text-white truncate">
                {boundWs.name}
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[9px] text-cyan-300 shrink-0">
                <GitBranch className="w-2.5 h-2.5 text-[#00f0ff]" />
                <span className="max-w-[70px] truncate">{boundBranch}</span>
              </span>
            </button>
          ) : (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1020]/50 border border-dashed border-cyan-700/40 text-[11px] font-mono text-cyan-500/60"
              title="No local project is bound to this chat yet"
            >
              <Folder className="w-3.5 h-3.5 shrink-0" />
              No project bound
            </span>
          )}

          <div className="hidden md:flex items-center gap-2">
          {/* Specialist Persona Button */}
          <button
            onClick={onOpenAgentMenu}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1020]/80 hover:bg-[#0e172e] border border-cyan-500/25 hover:border-cyan-400/50 text-xs font-mono text-cyan-200 transition shadow-[0_0_10px_rgba(0,240,255,0.06)]"
            title="Change active agent persona"
          >
            <span aria-label="Supreme Core" role="img">👑</span>
            <span className="text-[11px] font-medium text-white max-w-[120px] truncate">
              {isManualMode ? activeAgent.name : 'Supreme Core'}
            </span>
            <ChevronDown className="w-3 h-3 text-cyan-400/70" />
          </button>

          {/* Model Selector Pill */}
          <button
            onClick={onOpenModelMenu}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1020]/80 hover:bg-[#0e172e] border border-cyan-500/25 hover:border-cyan-400/50 text-xs font-mono text-cyan-200 transition shadow-[0_0_10px_rgba(0,240,255,0.06)]"
            title="Change active AI intelligence model"
          >
            <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="text-[11px] text-cyan-300 max-w-[140px] truncate">
              {activeModel.name}
            </span>
            <ChevronDown className="w-3 h-3 text-cyan-400/70" />
          </button>
          </div>
        </div>

        {/* Right: Quick Holographic Control Deck */}
        <div className="flex items-center gap-1.5">
          {/* Quick Voice Mode Switch */}
          <button
            onClick={() => setSpeechMode('speech')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-950/60 to-sky-950/60 hover:from-cyan-900/60 hover:to-sky-900/60 border border-cyan-500/35 hover:border-cyan-400 text-xs font-mono text-[#00f0ff] transition shadow-[0_0_12px_rgba(0,240,255,0.15)] group"
            title="Launch Fullscreen Voice Hologram Mode"
          >
            <Radio className="w-3.5 h-3.5 text-[#00f0ff] animate-pulse" />
            <span className="text-[11px] font-semibold hidden sm:inline">Voice Mode</span>
          </button>

          {/* Inline Voice Recording Trigger */}
          {onToggleVoiceRecording && (
            <button
              onClick={onToggleVoiceRecording}
              className={`p-1.5 rounded-lg border transition ${
                isRecording
                  ? 'bg-cyan-500/25 text-[#00f0ff] border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.4)] animate-pulse'
                  : 'bg-[#0a1020]/80 text-zinc-400 hover:text-cyan-200 border-cyan-500/20 hover:border-cyan-500/40'
              }`}
              title={isRecording ? 'Stop voice recording' : 'Start voice recording'}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          {/* Audio TTS toggle */}
          <button
            onClick={toggleAudioTts}
            className={`p-1.5 rounded-lg border transition ${
              audioTtsEnabled
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30'
                : 'bg-[#0a1020]/60 text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
            title={audioTtsEnabled ? 'Speech Output: Enabled' : 'Speech Output: Muted'}
          >
            {audioTtsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* New Chat Session */}
          <button
            onClick={() => createNewChat()}
            className="p-1.5 rounded-lg bg-[#0a1020]/80 hover:bg-[#0e172e] text-zinc-400 hover:text-[#00f0ff] border border-cyan-500/20 hover:border-cyan-500/40 transition"
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Magnified AXION Hologram Inspection Modal */}
      {showHoloModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowHoloModal(false)}
        >
          <div
            className="bg-[#050508]/95 border border-cyan-500/40 rounded-3xl p-8 max-w-lg w-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(0,240,255,0.25)] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top HUD Header */}
            <div className="w-full flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
                <span className="text-xs font-mono font-bold text-white tracking-widest uppercase">
                  AXION HOLOGRAPHIC RESPONSE RING
                </span>
              </div>
              <button
                onClick={() => setShowHoloModal(false)}
                className="text-xs font-mono text-cyan-400 hover:text-white px-2 py-1 rounded border border-cyan-500/30 hover:border-cyan-400"
              >
                CLOSE [ESC]
              </button>
            </div>

            {/* Giant Live Hologram Ring */}
            <div className="py-4">
              <AxionHologramRing
                state={visualizerState}
                audioLevel={isRecording ? audioLevel || 0.75 : 0.3}
                size="hero"
              />
            </div>

            {/* Telemetry Details */}
            <div className="w-full grid grid-cols-3 gap-2 pt-6 border-t border-cyan-500/20 text-center font-mono">
              <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                <div className="text-[10px] text-cyan-400/70">CORE STATUS</div>
                <div className="text-xs font-bold text-white uppercase mt-1">{visualizerState}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                <div className="text-[10px] text-cyan-400/70">NEURAL HARMONICS</div>
                <div className="text-xs font-bold text-[#00f0ff] mt-1">432.00 MHz</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                <div className="text-[10px] text-cyan-400/70">AI ENGINE</div>
                <div className="text-xs font-bold text-white truncate mt-1">{activeModel.name}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
