import { useVoiceSession } from '../hooks/useVoiceSession';
import { VoiceActivationControls } from './voice/VoiceActivationControls';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { globalVoiceEngine, VoiceState } from '../utils/voiceEngine';
import { detectSpokenCommand, prepareTextForSpeech } from '../utils/voiceNormalizer';
import { AxionLivingCore, LivingCoreState } from './voice/AxionLivingCore';
import { AxionHologramRing } from './AxionHologramRing';
import { VoiceTranscript } from './voice/VoiceTranscript';
import { VoiceControls } from './voice/VoiceControls';
import { VoiceSettingsModal } from './VoiceSettingsModal';
import {
  MessageSquare,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  Hand,
  Radio
} from 'lucide-react';

export const LiveSpeechMode: React.FC = () => {
  const {
    speechState,
    setSpeechState,
    setSpeechMode,
    isMicMuted,
    toggleMicMute,
    audioTtsEnabled,
    toggleAudioTts,
    executeUserPrompt,
    isWorking,
    selectedAgentId,
    agents,
    messages,
    interruptSpeech,
    activeWorkspaceId,
    workspaces,
    voiceSettings,
    toggleFilePanel,
    toggleTerminal,
    togglePreviewPanel,
    setCurrentTab
  } = useAxionStore();

  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const {liveTranscript,setLiveTranscript,interimTranscript,audioLevel,observedVoiceState,runtimeWarning,isPttActive,isPushToTalk,startPtt,stopPtt,cancelPtt,initializeVoice,activation}=useVoiceSession();
  const isVoiceOutputWarning=!!runtimeWarning&&/voice|speech output/i.test(runtimeWarning)&&!/microphone permission/i.test(runtimeWarning);
  const [sessionSeconds,setSessionSeconds]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>setSessionSeconds(n=>n+1),1000);return()=>clearInterval(timer);},[]);
  const formattedTimer=`${Math.floor(sessionSeconds/60).toString().padStart(2,'0')}:${(sessionSeconds%60).toString().padStart(2,'0')}`;
  const activeWs=workspaces.find(w=>w.id===activeWorkspaceId)||workspaces[0];
  const activeAgent=agents.find(a=>a.id===selectedAgentId);
  const lastBotMessage=messages.filter(m=>m.sender==='boss_agent'||m.sender==='specialist_agent').slice(-1)[0];

  // Manual Interruption (Barge-In)
  const handleInterrupt = () => {
    interruptSpeech();
  };

  // End voice session and return cleanly to Chat
  const handleEndConversation = () => {
    globalVoiceEngine.destroy();
    setSpeechMode('chat');
  };

  // Quick conversation starters
  const quickPrompts = [
    { label: 'Hello AXION', text: 'Hello AXION' },
    { label: 'Explain App', text: 'Explain the main component hierarchy and state flow.' },
    { label: 'Just Chat', text: 'Let\'s just talk for a bit.' },
    { label: 'Open Files', text: 'Open files' }
  ];

  const coreState: LivingCoreState = observedVoiceState === 'speaking' ? 'speaking'
    : isWorking ? 'thinking'
    : !isMicMuted && observedVoiceState === 'listening' ? 'listening' : 'idle';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] text-cyan-100 select-none overflow-hidden relative cyber-grid-bg">
      {/* Background Neural Subtle Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(0,240,255,0.12),rgba(5,5,8,0))] pointer-events-none" />

      {/* Top Minimalist Header */}
      <header className="px-6 py-3.5 flex items-center justify-between border-b border-cyan-500/20 z-20 shrink-0 bg-[#050508]/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">
              AXION<span className="text-[#00f0ff]">-X100</span>
            </span>
          </div>
          <span className="text-cyan-800 font-mono text-xs">|</span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/35 text-[11px] font-mono text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
            <span className="font-semibold tracking-wider">LIVE QUANTUM CONVERSATION</span>
            <span className="text-cyan-400/70 font-mono ml-1">{formattedTimer}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEndConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-cyan-200 hover:text-white hover:bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400 transition shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Switch to Chat</span>
          </button>
        </div>
      </header>

      {/* Main Avatar & Conversational Area */}
      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 overflow-y-auto relative z-10">
        {/* Permission Denied / Warning Banner */}
        {runtimeWarning && (
          <div className="max-w-md w-full p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-xl animate-in fade-in backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{runtimeWarning}</span>
            </div>
            <button
              onClick={isVoiceOutputWarning ? () => setIsVoiceSettingsOpen(true) : initializeVoice}
              className="px-2.5 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-[11px] shrink-0 font-medium transition"
            >
              {isVoiceOutputWarning ? 'Voice settings' : 'Enable / retry mic'}
            </button>
          </div>
        )}

        {/* 1. Center Holographic Visualizer (AXION Response Ring) */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-4">
          <div className="relative flex items-center justify-center py-4">
            <AxionLivingCore
              state={coreState}
              audioLevel={audioLevel}
              size="hero"
            />
          </div>

          {/* State remains readable without relying on the Core color. */}
          <div role="status" aria-live="polite" className="mt-3 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#080e1c]/90 border border-cyan-500/35 text-xs font-mono text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.15)] backdrop-blur-md">
            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${coreState === 'thinking' ? 'bg-[#38bdf8] animate-ping' : coreState === 'listening' ? 'bg-[#00f0ff] animate-ping' : 'bg-cyan-400'}`} />
            <span className="font-semibold tracking-wide uppercase">
              {coreState === 'speaking' ? 'Transmitting Output…' : coreState === 'thinking' ? 'Neural Synthesizer Active…' : coreState === 'listening' ? 'Acoustic Sensor Armed // Listening…' : isMicMuted ? 'Microphone Muted' : isPushToTalk ? 'AXION Ready · Hold to speak' : 'AXION Online & Ready'}
            </span>
          </div>

          {/* Interactive Push-to-Talk Control Button */}
          {isPushToTalk && (
            <div className="mt-3 flex flex-col items-center gap-1.5 animate-in fade-in duration-200">
              <button
                onPointerDown={startPtt}
                onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startPtt(); } }}
                onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stopPtt(); } }}
                onPointerUp={stopPtt}
                onPointerCancel={cancelPtt}
                onContextMenu={(e) => e.preventDefault()}
                className={`px-6 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] flex items-center gap-2 touch-none select-none active:scale-95 ${
                  isPttActive
                    ? 'bg-[#00f0ff] text-[#050508] shadow-[0_0_25px_rgba(0,240,255,0.8)] ring-4 ring-cyan-400/40'
                    : 'bg-[#0a1224] hover:bg-[#0e1932] text-cyan-200 border border-cyan-500/40 hover:border-cyan-400'
                }`}
              >
                <Hand className={`w-4 h-4 ${isPttActive ? 'animate-bounce text-[#050508]' : 'text-[#00f0ff]'}`} />
                <span>{isPttActive ? 'Release to Send' : 'Hold to Speak (or Space)'}</span>
              </button>
              <span className="text-[10px] text-cyan-400/60 font-mono">Tip: Press & hold Spacebar anywhere to speak</span>
            </div>
          )}

          <VoiceActivationControls status={activation} />
          {/* 2. Status & Live Transcript */}
          <VoiceTranscript
            state={speechState}
            liveTranscript={liveTranscript}
            interimTranscript={interimTranscript}
            lastAssistantText={prepareTextForSpeech(lastBotMessage?.text || '')}
            isWorking={isWorking}
          />
        </div>

        {/* 3. Spoken Starters / Conversational Prompts */}
        <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-2 flex-wrap mb-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setLiveTranscript(p.text);
                setSpeechState('thinking');
                executeUserPrompt(p.text, true);
              }}
              className="px-3 py-1 rounded-full bg-[#080e1c]/80 hover:bg-[#0c162c] border border-cyan-500/25 hover:border-cyan-400 text-[11px] font-mono text-cyan-200 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.08)] backdrop-blur-sm"
            >
              <Sparkles className="w-3 h-3 text-[#00f0ff]" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* 4. Minimalist Bottom Voice Controls */}
        <VoiceControls
          state={speechState}
          isMuted={isMicMuted}
          onToggleMute={toggleMicMute}
          audioTtsEnabled={audioTtsEnabled}
          onToggleTts={toggleAudioTts}
          onEndConversation={handleEndConversation}
          onOpenSettings={() => setIsVoiceSettingsOpen(true)}
          onInterrupt={handleInterrupt}
        />
      </main>

      {/* Voice & Language Settings Modal */}
      {isVoiceSettingsOpen && (
        <VoiceSettingsModal onClose={() => setIsVoiceSettingsOpen(false)} />
      )}
    </div>
  );
};
