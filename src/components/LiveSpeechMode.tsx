import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { globalVoiceEngine, VoiceState } from '../utils/voiceEngine';
import { detectSpokenCommand, prepareTextForSpeech } from '../utils/voiceNormalizer';
import { AxionLivingCore, LivingCoreState } from './voice/AxionLivingCore';
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
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);

  const isPushToTalk = voiceSettings?.listeningMode === 'push-to-talk';
  const [isPttActive, setIsPttActive] = useState(false);
  const isPttActiveRef = useRef(false);

  // Push-to-Talk activation handlers
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

  // Keyboard Spacebar & window blur listener for Push-to-Talk
  useEffect(() => {
    if (!isPushToTalk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        startPtt();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        stopPtt();
      }
    };

    const handleBlur = () => {
      if (isPttActiveRef.current) {
        stopPtt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPushToTalk, isMicMuted, speechState]);

  // Live session timer (e.g. 01:45)
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const isComponentMounted = useRef(true);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeAgent = agents.find((a) => a.id === selectedAgentId);

  // Session timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(sessionSeconds / 60);
    const secs = sessionSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [sessionSeconds]);

  // Initialize Voice Engine & Listeners
  const initializeVoice = () => {
    setIsPermissionDenied(false);
    setRuntimeWarning(null);

    // Apply speech synthesis settings
    if (voiceSettings) {
      globalVoiceEngine.synthesisAdapter.setVoiceSettings(
        voiceSettings.voiceName,
        voiceSettings.speed || 1.05
      );
    }

    if (!globalVoiceEngine.isRecognitionSupported()) {
      setIsPermissionDenied(true);
      setRuntimeWarning(
        'Speech recognition is unavailable or requires microphone permission in this browser. You can still use the prompt starters or switch to Chat mode.'
      );
      return;
    }

    globalVoiceEngine.setEvents({
      onStateChange: (state: VoiceState) => {
        if (isComponentMounted.current) {
          setSpeechState(state);
        }
      },
      onAudioLevel: (level: number) => {
        if (isComponentMounted.current) {
          setAudioLevel(level);
        }
      },
      onTranscript: (transcript: string, isFinal: boolean) => {
        if (!isComponentMounted.current) return;

        if (isFinal) {
          setLiveTranscript(transcript);
          setInterimTranscript('');

          // 1. Check for spoken application commands (e.g. "Files kholo", "Terminal kholo")
          const cmd = detectSpokenCommand(transcript);
          if (cmd.isCommand) {
            handleSpokenCommand(cmd);
            return;
          }

          // 2. Regular prompt -> send to Boss Agent
          setSpeechState('thinking');
          executeUserPrompt(transcript, true);
        } else {
          setInterimTranscript(transcript);
        }
      },
      onBargeIn: () => {
        if (isComponentMounted.current) {
          interruptSpeech();
        }
      },
      onError: (err: string) => {
        if (isComponentMounted.current) {
          console.warn('[VoiceEngine error]', err);
          isPttActiveRef.current = false;
          setIsPttActive(false);
          globalVoiceEngine.stopListening();
          setSpeechState('idle');
          if (err.includes('not-allowed') || err.includes('permission') || err.includes('denied')) {
            setIsPermissionDenied(true);
            setRuntimeWarning('Microphone access was denied. Please allow microphone permissions in your browser.');
          } else {
            setRuntimeWarning(`Microphone error: ${err}`);
          }
        }
      }
    });

    if (!isMicMuted && !isPushToTalk) {
      globalVoiceEngine.startListening();
    }
  };

  // Handle Spoken App Commands while keeping Voice session active
  const handleSpokenCommand = (cmd: ReturnType<typeof detectSpokenCommand>) => {
    if (cmd.commandType === 'OPEN_FILES') {
      toggleFilePanel(true);
    } else if (cmd.commandType === 'OPEN_TERMINAL') {
      toggleTerminal(true);
    } else if (cmd.commandType === 'OPEN_PREVIEW') {
      togglePreviewPanel(true);
    } else if (cmd.commandType === 'OPEN_WORKSPACE') {
      setCurrentTab('local_workspace');
    } else if (cmd.commandType === 'OPEN_AGENT_LAB') {
      setCurrentTab('agents');
    } else if (cmd.commandType === 'OPEN_CLOUD_BRAIN') {
      setCurrentTab('cloud_brain');
    }

    if (cmd.confirmationSpeech && audioTtsEnabled) {
      globalVoiceEngine.speak(cmd.confirmationSpeech, () => {
        if (isComponentMounted.current && !isMicMuted && !isPushToTalk) {
          globalVoiceEngine.startListening();
        }
      });
    }
  };

  useEffect(() => {
    isComponentMounted.current = true;
    initializeVoice();

    return () => {
      isComponentMounted.current = false;
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

  // Handle Mute / Unmute
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
  const lastBotMessage = useMemo(() => {
    const last = messages[messages.length - 1];
    return last && (last.sender === 'boss_agent' || last.sender === 'specialist_agent') ? last : null;
  }, [messages]);

  useEffect(() => {
    if (!lastBotMessage || isWorking || isMicMuted || !audioTtsEnabled) return;

    // Speak natural sanitized conversational response
    const cleanToSpeak = prepareTextForSpeech(lastBotMessage.text);

    if (cleanToSpeak) {
      globalVoiceEngine.speak(cleanToSpeak, () => {
        if (isComponentMounted.current && !isMicMuted && !isPushToTalk) {
          globalVoiceEngine.startListening();
        }
      });
    }
  }, [lastBotMessage?.text, isWorking]);

  // Manual Interruption (Barge-In)
  const handleInterrupt = () => {
    globalVoiceEngine.interrupt();
    interruptSpeech();
  };

  // End voice session and return cleanly to Chat
  const handleEndConversation = () => {
    globalVoiceEngine.destroy();
    setSpeechMode('chat');
  };

  // Quick Conversational Hindi / Hinglish / English Prompts
  const quickPrompts = [
    { label: 'Scan Project', text: 'Bhai mera current project scan karke batao issue kaha hai.' },
    { label: 'Explain App', text: 'Explain the main component hierarchy and state flow.' },
    { label: 'Check Build', text: 'Check the project and run terminal build diagnostics.' },
    { label: 'Open Files', text: 'Bhai project files kholo.' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08080a] text-zinc-200 select-none overflow-hidden relative">
      {/* Background Neural Subtle Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,240,255,0.08),rgba(255,255,255,0))] pointer-events-none" />

      {/* Top Minimalist Header */}
      <header className="px-6 py-3.5 flex items-center justify-between border-b border-zinc-900 z-20 shrink-0 bg-[#08080a]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-zinc-100 uppercase">
              AXION-X100
            </span>
          </div>
          <span className="text-zinc-700 font-mono text-xs">|</span>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE CONVERSATION</span>
            <span className="text-zinc-500 font-mono ml-1">{formattedTimer}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEndConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 border border-zinc-800 transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Switch to Chat</span>
          </button>
        </div>
      </header>

      {/* Main Avatar & Conversational Area */}
      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 overflow-hidden relative z-10">
        {/* Permission Denied / Warning Banner */}
        {runtimeWarning && (
          <div className="max-w-md w-full p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{runtimeWarning}</span>
            </div>
            <button
              onClick={initializeVoice}
              className="px-2 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white text-[11px] shrink-0 font-medium transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Center Living Core (Abstract Energy Nucleus) */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-4">
          <AxionLivingCore
            state={
              isPushToTalk
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
                : 'idle'
            }
            audioLevel={audioLevel}
            size="hero"
            isMuted={isMicMuted}
          />

          {/* Living Core State Label */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                speechState === 'speaking'
                  ? 'bg-cyan-400 animate-pulse'
                  : speechState === 'thinking' || speechState === 'transcribing'
                  ? 'bg-sky-400 animate-ping'
                  : isPttActive || speechState === 'listening'
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
                : isPttActive || speechState === 'listening'
                ? isPushToTalk
                  ? 'Listening (PTT Active)…'
                  : 'Listening…'
                : isPushToTalk
                ? 'Push-to-Talk (Hold Space or Button to Speak)'
                : 'Continuous (Real-time Listening)'}
            </span>
          </div>

          {/* Interactive Push-to-Talk Control Button */}
          {isPushToTalk && (
            <div className="mt-3 flex flex-col items-center gap-1.5 animate-in fade-in duration-200">
              <button
                onPointerDown={startPtt}
                onPointerUp={stopPtt}
                onPointerCancel={stopPtt}
                onContextMenu={(e) => e.preventDefault()}
                className={`px-6 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-lg flex items-center gap-2 touch-none select-none active:scale-95 ${
                  isPttActive
                    ? 'bg-cyan-400 text-black shadow-cyan-500/40 ring-4 ring-cyan-500/30'
                    : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 hover:border-cyan-500/40'
                }`}
              >
                <Hand className={`w-4 h-4 ${isPttActive ? 'animate-bounce' : 'text-cyan-400'}`} />
                <span>{isPttActive ? 'Release to Send' : 'Hold to Speak (or Space)'}</span>
              </button>
              <span className="text-[10px] text-zinc-500 font-mono">Tip: Press & hold Spacebar anywhere to speak</span>
            </div>
          )}

          {/* 2. Status & Live Transcript */}
          <VoiceTranscript
            state={speechState}
            liveTranscript={liveTranscript}
            interimTranscript={interimTranscript}
            lastAssistantText={speechState === 'speaking' ? prepareTextForSpeech(lastBotMessage?.text || '') : undefined}
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
              className="px-2.5 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-cyan-500/40 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
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
