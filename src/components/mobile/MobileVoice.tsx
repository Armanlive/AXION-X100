import React, { useState, useEffect, useRef } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { globalVoiceEngine, VoiceState } from '../../utils/voiceEngine';
import { prepareTextForSpeech } from '../../utils/voiceNormalizer';
import { AxionLivingCore, LivingCoreState } from '../voice/AxionLivingCore';
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

  const isPushToTalk = voiceSettings?.listeningMode === 'push-to-talk';
  const [isPttActive, setIsPttActive] = useState(false);
  const isPttActiveRef = useRef(false);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Push-to-Talk activation handlers for touch / pointer
  const startPtt = (e?: React.PointerEvent) => {
    if (isMicMuted || speechState === 'speaking' || speechState === 'thinking') return;
    if (e && e.currentTarget && 'setPointerCapture' in e.currentTarget) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    isPttActiveRef.current = true;
    setIsPttActive(true);
    globalVoiceEngine.startListening();
    setSpeechState('listening');
  };

  const stopPtt = (e?: React.PointerEvent) => {
    if (e && e.currentTarget && 'releasePointerCapture' in e.currentTarget) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (!isPttActiveRef.current) return;
    isPttActiveRef.current = false;
    setIsPttActive(false);
    globalVoiceEngine.stopListening();
    if (speechState === 'listening') {
      setSpeechState('idle');
    }
  };

  // Ensure window blur or app switch cleanly cancels any active PTT
  useEffect(() => {
    const handleBlur = () => {
      if (isPttActiveRef.current) {
        isPttActiveRef.current = false;
        setIsPttActive(false);
        globalVoiceEngine.stopListening();
        setSpeechState('idle');
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // Initialize Speech Recognition & Engine Event Handlers
  useEffect(() => {
    isMountedRef.current = true;
    setWarningMessage(null);

    // Apply voice settings synthesis
    if (voiceSettings) {
      globalVoiceEngine.synthesisAdapter.setVoiceSettings(
        voiceSettings.voiceName,
        voiceSettings.speed || 1.05
      );
    }

    if (!globalVoiceEngine.isRecognitionSupported()) {
      setWarningMessage('Speech recognition requires microphone permissions or is unsupported in this browser.');
    } else {
      globalVoiceEngine.setEvents({
        onStateChange: (state: VoiceState) => {
          if (isMountedRef.current) setSpeechState(state);
        },
        onAudioLevel: (level: number) => {
          if (isMountedRef.current) setAudioLevel(level);
        },
        onTranscript: (transcript: string, isFinal: boolean) => {
          if (!isMountedRef.current) return;
          if (isFinal) {
            setLiveTranscript(transcript);
            setInterimTranscript('');
            setSpeechState('thinking');
            executeUserPrompt(transcript, true);
          } else {
            setInterimTranscript(transcript);
          }
        },
        onBargeIn: () => {
          if (isMountedRef.current) interruptSpeech();
        },
        onError: (err: string) => {
          if (!isMountedRef.current) return;
          isPttActiveRef.current = false;
          setIsPttActive(false);
          globalVoiceEngine.stopListening();
          setSpeechState('idle');
          if (err.includes('not-allowed') || err.includes('permission') || err.includes('denied')) {
            setWarningMessage('Microphone access was denied. Please grant microphone permission in browser settings.');
          } else {
            setWarningMessage(`Microphone error: ${err}`);
          }
        }
      });

      // Start continuous listening ONLY if not in Push-to-Talk and not muted
      if (!isMicMuted && !isPushToTalk) {
        globalVoiceEngine.startListening();
      }
    }

    return () => {
      isMountedRef.current = false;
      isPttActiveRef.current = false;
      setIsPttActive(false);
      globalVoiceEngine.stopListening();
    };
  }, []);

  // Mode switch listener: Continuous <-> Push-to-Talk
  useEffect(() => {
    if (isPushToTalk) {
      // Continuous -> Push-to-Talk: stop any continuous listening and return to truthful idle
      isPttActiveRef.current = false;
      setIsPttActive(false);
      globalVoiceEngine.stopListening();
      if (speechState === 'listening') {
        setSpeechState('idle');
      }
    } else {
      // Push-to-Talk -> Continuous: start continuous listening only if enabled/unmuted
      isPttActiveRef.current = false;
      setIsPttActive(false);
      if (!isMicMuted && speechState !== 'speaking' && speechState !== 'thinking') {
        globalVoiceEngine.startListening();
      }
    }
  }, [voiceSettings?.listeningMode]);

  // Handle Mute State Changes
  useEffect(() => {
    if (isMicMuted) {
      isPttActiveRef.current = false;
      setIsPttActive(false);
      globalVoiceEngine.stopListening();
      if (speechState === 'listening') {
        setSpeechState('idle');
      }
    } else if (!isPushToTalk && speechState !== 'speaking' && speechState !== 'thinking') {
      globalVoiceEngine.startListening();
    }
  }, [isMicMuted, isPushToTalk]);

  // Read latest message via TTS when bot responds in voice mode
  const lastBotMessage = messages[messages.length - 1];
  const isBotSpeaking = lastBotMessage && (lastBotMessage.sender === 'boss_agent' || lastBotMessage.sender === 'specialist_agent');

  useEffect(() => {
    if (!isBotSpeaking || isWorking || isMicMuted || !audioTtsEnabled) return;

    const cleanToSpeak = prepareTextForSpeech(lastBotMessage.text);
    if (cleanToSpeak) {
      globalVoiceEngine.speak(cleanToSpeak, () => {
        if (isMountedRef.current && !isMicMuted && !isPushToTalk) {
          globalVoiceEngine.startListening();
        }
      });
    }
  }, [lastBotMessage?.text, isWorking]);

  const handleReturnToChat = () => {
    isPttActiveRef.current = false;
    setIsPttActive(false);
    globalVoiceEngine.destroy();
    setSpeechMode('chat');
  };

  const currentDisplaySpeech = interimTranscript || liveTranscript;

  const coreState: LivingCoreState = isPushToTalk
    ? isPttActive
      ? 'listening'
      : speechState === 'thinking' || speechState === 'transcribing'
      ? 'thinking'
      : speechState === 'speaking'
      ? 'speaking'
      : 'idle'
    : speechState === 'listening'
    ? 'listening'
    : speechState === 'thinking' || speechState === 'transcribing'
    ? 'thinking'
    : speechState === 'speaking'
    ? 'speaking'
    : 'idle';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08080a] text-zinc-100 select-none overflow-hidden relative pb-16">
      {/* 1. Minimal Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-zinc-900 bg-[#08080a]/90 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold tracking-wider text-zinc-200">
            AXION VOICE
          </span>
          <span className="text-zinc-600 font-mono">·</span>
          <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[100px]">
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
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-cyan-300 hover:border-cyan-500/40 active:scale-95 transition"
            title="Switch Voice Listening Mode"
            aria-label={`Current mode: ${isPushToTalk ? 'Push-to-Talk' : 'Continuous'}. Tap to switch.`}
          >
            {isPushToTalk ? <Hand className="w-3 h-3 text-cyan-400" /> : <Radio className="w-3 h-3 text-cyan-400" />}
            <span>{isPushToTalk ? 'PTT' : 'Live'}</span>
          </button>

          <button
            onClick={handleReturnToChat}
            className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] text-xs font-medium text-zinc-400 hover:text-white transition"
            aria-label="Return to Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[11px]">Chat</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Visual Focus: Living Core */}
      <main className="flex-1 flex flex-col items-center justify-between px-4 py-4 overflow-hidden relative z-10 max-w-sm mx-auto w-full">
        {warningMessage && (
          <div className="w-full p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-[11px] leading-tight">{warningMessage}</span>
          </div>
        )}

        {/* Hero Living Core Container (Centered, safe scale for 360-430px) */}
        <div className="flex-1 flex flex-col items-center justify-center w-full my-auto">
          <AxionLivingCore
            state={coreState}
            audioLevel={audioLevel}
            size="hero"
            isMuted={isMicMuted}
          />

          {/* Living Core State Label */}
          <div className="mt-4 flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                speechState === 'speaking'
                  ? 'bg-cyan-400 animate-pulse'
                  : speechState === 'thinking' || speechState === 'transcribing'
                  ? 'bg-sky-400 animate-ping'
                  : isPushToTalk
                  ? isPttActive
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-zinc-500'
                  : speechState === 'listening'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="tracking-wide">
              {isMicMuted
                ? 'Muted'
                : speechState === 'speaking'
                ? 'Speaking…'
                : speechState === 'thinking' || speechState === 'transcribing'
                ? 'Thinking…'
                : isPushToTalk
                ? isPttActive
                  ? 'Listening (PTT Active)…'
                  : 'Push-to-Talk (Hold button to speak)'
                : speechState === 'listening'
                ? 'Listening…'
                : 'Ready'}
            </span>
          </div>
        </div>

        {/* 3. Contextual Transcript Area */}
        <div className="w-full min-h-[64px] flex flex-col items-center justify-center text-center px-2 mb-3">
          {currentDisplaySpeech ? (
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
                : 'Listening continuously... Speak in Hindi, Hinglish, or English'}
            </p>
          )}
        </div>

        {/* 4. Large Touch-Friendly Voice Controls */}
        <div className="flex items-center justify-center gap-4 w-full">
          {/* Speaker TTS Readout Toggle */}
          <button
            onClick={toggleAudioTts}
            className={`p-3 min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center border transition ${
              audioTtsEnabled
                ? 'bg-zinc-800 text-cyan-400 border-cyan-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
            aria-label={audioTtsEnabled ? 'Mute speaker' : 'Enable speaker audio'}
          >
            {audioTtsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Primary Big Microphone Control (min 56px) - PTT vs Continuous */}
          {isPushToTalk ? (
            <button
              onPointerDown={startPtt}
              onPointerUp={stopPtt}
              onPointerCancel={stopPtt}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl touch-none select-none active:scale-95 ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-not-allowed'
                  : isPttActive
                  ? 'bg-cyan-400 text-black border-2 border-cyan-200 shadow-cyan-500/50 ring-4 ring-cyan-500/30'
                  : 'bg-zinc-800 text-white border border-zinc-700 hover:border-cyan-500/40'
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
                <Hand className="w-7 h-7 animate-pulse text-black" />
              ) : (
                <Mic className="w-7 h-7 text-cyan-400" />
              )}
            </button>
          ) : (
            <button
              onClick={toggleMicMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : speechState === 'listening'
                  ? 'bg-cyan-500 text-black border border-cyan-300 shadow-cyan-500/40 animate-pulse'
                  : 'bg-zinc-800 text-white border border-zinc-700'
              }`}
              aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
          )}

          {/* Cancel / End Voice Control */}
          <button
            onClick={handleReturnToChat}
            className="p-3 min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 transition"
            aria-label="End voice and return to chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  );
};
