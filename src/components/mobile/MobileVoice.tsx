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
  AlertCircle
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
    activeWorkspace
  } = useAxionStore();

  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Initialize Speech Recognition
  useEffect(() => {
    isMountedRef.current = true;
    setWarningMessage(null);

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
          if (isMountedRef.current && (err.includes('not-allowed') || err.includes('denied'))) {
            setWarningMessage('Microphone access denied. Please grant permission in browser settings.');
          }
        }
      });

      if (!isMicMuted) {
        globalVoiceEngine.startListening();
      }
    }

    return () => {
      isMountedRef.current = false;
      globalVoiceEngine.stopListening();
    };
  }, []);

  // Handle Mute State Change
  useEffect(() => {
    if (isMicMuted) {
      globalVoiceEngine.stopListening();
    } else if (speechState !== 'speaking' && speechState !== 'thinking') {
      globalVoiceEngine.startListening();
    }
  }, [isMicMuted]);

  // Read latest message via TTS when bot responds in voice mode
  const lastBotMessage = messages[messages.length - 1];
  const isBotSpeaking = lastBotMessage && (lastBotMessage.sender === 'boss_agent' || lastBotMessage.sender === 'specialist_agent');

  useEffect(() => {
    if (!isBotSpeaking || isWorking || isMicMuted || !audioTtsEnabled) return;

    const cleanToSpeak = prepareTextForSpeech(lastBotMessage.text);
    if (cleanToSpeak) {
      globalVoiceEngine.speak(cleanToSpeak, () => {
        if (isMountedRef.current && !isMicMuted) {
          globalVoiceEngine.startListening();
        }
      });
    }
  }, [lastBotMessage?.text, isWorking]);

  const handleReturnToChat = () => {
    globalVoiceEngine.destroy();
    setSpeechMode('chat');
  };

  const currentDisplaySpeech = interimTranscript || liveTranscript;

  const coreState: LivingCoreState =
    speechState === 'listening'
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
          <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px]">
            {activeWorkspace ? activeWorkspace.name : 'Phase 1'}
          </span>
        </div>

        <button
          onClick={handleReturnToChat}
          className="flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] text-xs font-medium text-zinc-400 hover:text-white transition"
          aria-label="Return to Chat"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[11px]">Chat</span>
        </button>
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
              {isMicMuted ? 'Microphone paused' : 'Listening... Speak in Hindi, Hinglish, or English'}
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

          {/* Primary Big Microphone Control (min 56px) */}
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
