import {VoiceSettingsModal} from '../VoiceSettingsModal';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { VoiceActivationControls } from '../voice/VoiceActivationControls';
import React, { useState, useEffect, useRef } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { globalVoiceEngine, VoiceState } from '../../utils/voiceEngine';
import { prepareTextForSpeech } from '../../utils/voiceNormalizer';
import { AxionHologramRing } from '../AxionHologramRing';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  MessageSquare,
  AlertCircle,
  Hand,
  Radio
} from 'lucide-react';

export const MobileVoice: React.FC = () => {
  const [showVoiceSettings,setShowVoiceSettings]=useState(false);
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
    messages,
    interruptSpeech,
    activeWorkspace,
    voiceSettings,
    updateVoiceSettings
  } = useAxionStore();

  const {liveTranscript,interimTranscript,audioLevel,observedVoiceState,runtimeWarning:warningMessage,isPttActive,isPushToTalk,startPtt,stopPtt,cancelPtt,activation}=useVoiceSession();
  const lastBotMessage=messages[messages.length-1];
  const isBotSpeaking=lastBotMessage&&(lastBotMessage.sender==='boss_agent'||lastBotMessage.sender==='specialist_agent');

  const handleReturnToChat = () => {
    globalVoiceEngine.destroy();
    setSpeechMode('chat');
  };

  const currentDisplaySpeech = interimTranscript || liveTranscript;

  const visualizerState = observedVoiceState === 'speaking' ? 'speaking'
    : isWorking ? 'thinking'
    : !isMicMuted && observedVoiceState === 'listening' ? 'listening' : 'idle';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] cyber-grid-bg text-cyan-100 select-none overflow-hidden relative pb-16">
      {/* 1. Minimal Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-cyan-500/20 bg-[#080d1a]/90 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
          <span className="text-xs font-mono font-semibold tracking-wider text-white">
            AXION VOICE // QUANTUM
          </span>
          <span className="text-cyan-600 font-mono">·</span>
          <span className="text-[10px] font-mono text-cyan-400 truncate max-w-[100px]">
            {activeWorkspace ? activeWorkspace.name : 'Phase 1'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Listening Mode Switcher */}
          <button
            onClick={() =>
              updateVoiceSettings({
                listeningMode: isPushToTalk ? 'continuous' : 'push-to-talk'
              })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 active:scale-95 transition"
            title="Switch Voice Listening Mode"
            aria-label={`Current mode: ${isPushToTalk ? 'Push-to-Talk' : 'Continuous'}. Tap to switch.`}
          >
            {isPushToTalk ? <Hand className="w-3 h-3 text-[#00f0ff]" /> : <Radio className="w-3 h-3 text-[#00f0ff]" />}
            <span>{isPushToTalk ? 'PTT' : voiceSettings.listeningMode==='wake-word' ? 'Wake' : 'Live'}</span>
          </button>

          <button
            onClick={handleReturnToChat}
            className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] text-xs font-mono text-cyan-300 hover:text-white transition"
            aria-label="Return to Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-[11px]">Chat</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Visual Focus: Living Core */}
      <main className="flex-1 flex flex-col items-center justify-between px-4 py-4 overflow-y-auto relative z-10 max-w-sm mx-auto w-full">
        {warningMessage && (
          <div className="w-full p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-[11px] leading-tight">{warningMessage}</span>
          </div>
        )}

        {/* Hero Hologram Ring Container */}
        <div className="flex-1 flex flex-col items-center justify-center w-full my-auto py-2">
          <AxionHologramRing
            state={visualizerState}
            audioLevel={audioLevel}
            size="hero"
            isMuted={isMicMuted}
          />

          {/* State remains readable */}
          <div role="status" aria-live="polite" className="mt-3 flex items-center gap-2 px-3 py-1 rounded-full bg-[#080d1a]/90 border border-cyan-500/30 text-xs font-mono text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
            <span>{visualizerState === 'speaking' ? 'Speaking…' : visualizerState === 'thinking' ? 'Thinking…' : visualizerState === 'listening' ? 'Listening…' : isMicMuted ? 'Muted' : isPushToTalk ? 'Ready · Hold to speak' : 'Ready'}</span>
          </div>
        </div>

        <button onClick={()=>setShowVoiceSettings(true)} className="text-xs font-mono text-[#00f0ff] underline">Voice settings</button>
        <VoiceActivationControls status={activation} />
        {/* 3. Contextual Transcript Area */}
        <div className="w-full min-h-[64px] flex flex-col items-center justify-center text-center px-2 mb-3">
          {!isWorking && isBotSpeaking && lastBotMessage.text ? (
            <p className="text-xs text-zinc-200 max-h-24 overflow-y-auto bg-zinc-900/60 px-3 py-2 rounded-xl border border-zinc-800"><span className="text-cyan-300">AXION: </span>{lastBotMessage.text}</p>
          ) : currentDisplaySpeech ? (
            <p className="text-sm font-medium text-white line-clamp-2">
              <span className="text-cyan-400 font-mono text-[10px] uppercase mr-1.5">YOU:</span>
              <span>"{currentDisplaySpeech}"</span>
            </p>
          ) : speechState === 'speaking' && isBotSpeaking ? (
            <p className="text-xs text-zinc-300 line-clamp-2 italic bg-zinc-900/60 px-3 py-1.5 rounded-xl border border-zinc-800">
              "{lastBotMessage.text}"
            </p>
          ) : (
            <p className="text-xs text-zinc-500 font-mono">
              {isMicMuted
                ? 'Microphone muted'
                : isPushToTalk
                ? isPttActive
                  ? 'Listening... Release to send speech'
                  : 'Press & hold mic button below to talk'
                : activation.micOn ? 'Speak in any language' : 'Microphone is paused'}
            </p>
          )}
        </div>

        {/* 4. Large Touch-Friendly Voice Controls */}
        <div className="flex items-center justify-center gap-4 w-full">
          {/* Speaker TTS Readout Toggle */}
          <button
            onClick={toggleAudioTts}
            className={`p-3 min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center border transition-all ${
              audioTtsEnabled
                ? 'bg-cyan-950/60 text-[#00f0ff] border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'bg-[#080d1a] text-cyan-700 border-cyan-900/40'
            }`}
            aria-label={audioTtsEnabled ? 'Mute speaker' : 'Enable speaker audio'}
          >
            {audioTtsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Primary Big Microphone Control (min 56px) - PTT vs Continuous */}
          {isPushToTalk ? (
            <button
              onPointerDown={startPtt}
              onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startPtt();}}}
              onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();stopPtt();}}}
              onPointerUp={stopPtt}
              onPointerCancel={cancelPtt}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] touch-none select-none active:scale-95 ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-not-allowed'
                  : isPttActive
                  ? 'bg-[#00f0ff] text-[#050508] border-2 border-white shadow-[0_0_30px_#00f0ff] ring-4 ring-cyan-500/40 animate-pulse'
                  : 'bg-[#080d1a] text-[#00f0ff] border-2 border-cyan-500/40 hover:border-cyan-400'
              }`}
              aria-label={
                isMicMuted
                  ? 'Microphone muted'
                  : isPttActive
                  ? 'Release to send speech'
                  : 'Press and hold to talk (Push-to-Talk)'
              }
            >
              {isMicMuted ? (
                <MicOff className="w-7 h-7" />
              ) : isPttActive ? (
                <Hand className="w-7 h-7 animate-pulse text-[#050508]" />
              ) : (
                <Mic className="w-7 h-7 text-[#00f0ff]" />
              )}
            </button>
          ) : (
            <button
              onClick={toggleMicMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : visualizerState === 'listening'
                  ? 'bg-[#00f0ff] text-[#050508] border-2 border-white shadow-[0_0_30px_#00f0ff] animate-pulse'
                  : 'bg-[#080d1a] text-[#00f0ff] border-2 border-cyan-500/40'
              }`}
              aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
          )}

          {/* Cancel / End Voice Control */}
          <button
            onClick={handleReturnToChat}
            className="p-3 min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center bg-[#080d1a] text-cyan-400 hover:text-white border border-cyan-500/30 hover:border-cyan-400 transition"
            aria-label="End voice and return to chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </main>
      {showVoiceSettings&&<VoiceSettingsModal onClose={()=>setShowVoiceSettings(false)}/>}
    </div>
  );
};
