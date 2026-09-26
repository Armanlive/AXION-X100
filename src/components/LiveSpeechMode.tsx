import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { VoiceEngine, VoiceState } from '../utils/voiceEngine';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  MessageSquare,
  Settings,
  Sparkles,
  Bot,
  User,
  Radio,
  ArrowRight,
  Hand,
  AlertCircle,
  HelpCircle,
  Layers,
  Check
} from 'lucide-react';
import { VoiceSettingsModal } from './VoiceSettingsModal';

export const LiveSpeechMode: React.FC = () => {
  const {
    speechState,
    setSpeechState,
    speechMode,
    setSpeechMode,
    isMicMuted,
    toggleMicMute,
    executeUserPrompt,
    isWorking,
    selectedAgentId,
    agents,
    isManualMode,
    isBossLocked,
    activeModelId,
    models,
    messages,
    interruptSpeech,
    activeWorkspaceId,
    workspaces,
    voiceSettings
  } = useAxionStore();

  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isEngineSupported, setIsEngineSupported] = useState(true);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);

  const voiceEngineRef = useRef<VoiceEngine | null>(null);
  const isComponentMounted = useRef(true);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeAgent = agents.find((a) => a.id === selectedAgentId);
  const activeModel = models.find((m) => m.id === activeModelId) || models[0];

  // Initialize VoiceEngine instance
  useEffect(() => {
    isComponentMounted.current = true;

    const engine = new VoiceEngine({
      onStateChange: (state: VoiceState) => {
        if (isComponentMounted.current) {
          setSpeechState(state);
        }
      },
      onTranscript: (transcript: string, isFinal: boolean) => {
        if (!isComponentMounted.current) return;

        if (isFinal) {
          setLiveTranscript(transcript);
          setInterimTranscript('');
          setSpeechState('thinking');
          // Trigger Boss Agent workflow
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
          if (err.includes('not supported') || err.includes('not-allowed')) {
            setRuntimeWarning('Microphone or Web Speech API access was denied or is unavailable in this environment.');
          }
        }
      }
    });

    voiceEngineRef.current = engine;

    if (!engine.isRecognitionSupported()) {
      setIsEngineSupported(false);
      setRuntimeWarning(
        'Voice engine unavailable in this runtime. Browser speech recognition requires microphone permissions or an HTTPS/Chromium environment. Normal text chat continues working.'
      );
    } else {
      setIsEngineSupported(true);
      if (!isMicMuted && speechMode === 'speech') {
        engine.startListening();
      }
    }

    return () => {
      isComponentMounted.current = false;
      engine.destroy();
    };
  }, [speechMode]);

  // Handle Mute / Unmute
  useEffect(() => {
    if (!voiceEngineRef.current) return;
    if (isMicMuted) {
      voiceEngineRef.current.stopListening();
    } else if (speechMode === 'speech' && speechState !== 'speaking' && speechState !== 'thinking') {
      voiceEngineRef.current.startListening();
    }
  }, [isMicMuted]);

  // Read latest message via TTS when bot responds in voice mode
  const lastBotMessage = useMemo(() => {
    const last = messages[messages.length - 1];
    return last && (last.sender === 'boss_agent' || last.sender === 'specialist_agent') ? last : null;
  }, [messages]);

  useEffect(() => {
    if (!lastBotMessage || isWorking || speechMode !== 'speech' || isMicMuted) return;

    if (voiceEngineRef.current && voiceSettings.autoSpeak) {
      // Speak the summary or staged task details
      const textToSpeak = lastBotMessage.proposedDiff
        ? `Task ${lastBotMessage.taskId} staged. ${lastBotMessage.proposedDiff.summary}`
        : lastBotMessage.text.slice(0, 160);

      voiceEngineRef.current.speak(textToSpeak, () => {
        if (isComponentMounted.current && !isMicMuted && speechMode === 'speech') {
          voiceEngineRef.current?.startListening();
        }
      });
    }
  }, [lastBotMessage, isWorking]);

  // Manual Interruption (Barge-In)
  const handleInterrupt = () => {
    if (voiceEngineRef.current) {
      voiceEngineRef.current.interrupt();
    }
    interruptSpeech();
  };

  // Conversational Quick Hindi / Hinglish / English Voice Prompts
  const handleVoicePromptClick = (text: string) => {
    setLiveTranscript(text);
    setSpeechState('thinking');
    executeUserPrompt(text, true);
  };

  const sampleVoicePrompts = [
    'Bhai dashboard ka header thoda chota kar do aur date right side kar do',
    'Ek naya StatsCard component banao with glowing trend metrics',
    'Explain the main App component and its dependencies',
    'Simulate build error recovery test'
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] text-zinc-100 select-none overflow-hidden relative font-sans">
      {/* Top Header for Conversational Voice Mode */}
      <div className="h-11 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-[#0d0d10] shrink-0">
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 text-[11px] font-medium">
            <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
            <span>CONVERSATIONAL VOICE MODE</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400 truncate max-w-[140px]">{activeWs.name}</span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-500 hidden sm:inline">
            {isBossLocked ? 'Boss Agent (Autonomous)' : `Specialist: ${activeAgent?.name || 'Manual'}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => setIsVoiceSettingsOpen(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Speech & Voice Configuration"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Return to Chat Mode */}
          <button
            onClick={() => {
              if (voiceEngineRef.current) {
                voiceEngineRef.current.destroy();
              }
              setSpeechMode('chat');
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
            <span>Return to Chat</span>
          </button>
        </div>
      </div>

      {/* Runtime Notice if Speech APIs are not supported */}
      {runtimeWarning && (
        <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{runtimeWarning}</span>
          </div>
          <button
            onClick={() => setRuntimeWarning(null)}
            className="text-[11px] font-mono hover:text-white underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Conversational Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Animated Glowing Voice Visualizer */}
        <div className="relative flex items-center justify-center my-6">
          {/* Outer Pulsing Aura Rings */}
          <div
            className={`absolute rounded-full transition-all duration-700 ${
              speechState === 'speaking'
                ? 'w-72 h-72 bg-emerald-500/15 animate-ping'
                : speechState === 'listening'
                ? 'w-64 h-64 bg-blue-500/10 animate-pulse'
                : speechState === 'thinking' || speechState === 'transcribing'
                ? 'w-64 h-64 bg-amber-500/10 animate-pulse'
                : 'w-48 h-48 bg-zinc-800/20'
            }`}
          />

          {/* Center Orb */}
          <div
            className={`w-44 h-44 rounded-full border flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative z-10 ${
              speechState === 'speaking'
                ? 'bg-emerald-950/50 border-emerald-500/60 shadow-emerald-900/40'
                : speechState === 'listening'
                ? 'bg-blue-950/50 border-blue-500/60 shadow-blue-900/40'
                : speechState === 'thinking' || speechState === 'transcribing'
                ? 'bg-amber-950/40 border-amber-500/60 shadow-amber-900/30'
                : 'bg-zinc-900/90 border-zinc-750 shadow-black'
            }`}
          >
            {speechState === 'speaking' ? (
              <Volume2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            ) : speechState === 'listening' ? (
              <Mic className="w-12 h-12 text-blue-400 animate-pulse" />
            ) : speechState === 'thinking' || speechState === 'transcribing' ? (
              <Sparkles className="w-12 h-12 text-amber-400 animate-spin" />
            ) : (
              <Mic className="w-12 h-12 text-zinc-500" />
            )}

            {/* State Label */}
            <div className="flex items-center gap-1.5 mt-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  speechState === 'speaking'
                    ? 'bg-emerald-400 animate-pulse'
                    : speechState === 'listening'
                    ? 'bg-blue-400 animate-pulse'
                    : speechState === 'thinking' || speechState === 'transcribing'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-600'
                }`}
              />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
                {speechState === 'speaking'
                  ? 'Speaking...'
                  : speechState === 'listening'
                  ? 'Listening...'
                  : speechState === 'transcribing'
                  ? 'Transcribing...'
                  : speechState === 'thinking'
                  ? 'Thinking...'
                  : 'Idle'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Transcript / Subtitle Whisper Display */}
        <div className="max-w-lg w-full text-center px-4 min-h-[52px]">
          {interimTranscript ? (
            <p className="text-sm font-sans text-blue-200 bg-zinc-900/80 border border-blue-500/30 rounded-xl px-4 py-2 animate-in fade-in shadow-lg">
              "{interimTranscript}..."
            </p>
          ) : liveTranscript ? (
            <p className="text-sm font-sans text-white bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-2 animate-in fade-in shadow-lg">
              "{liveTranscript}"
            </p>
          ) : speechState === 'listening' ? (
            <div className="text-xs font-sans text-zinc-400 space-y-1">
              <p>Speak naturally in English, Hindi, or Hinglish...</p>
              <p className="text-[11px] text-zinc-500 font-mono">Barge-in active: speak anytime to interrupt AXION.</p>
            </div>
          ) : speechState === 'speaking' ? (
            <div className="text-xs font-sans text-emerald-400 flex items-center justify-center gap-2">
              <span>AXION is speaking. Click anywhere or speak to interrupt (Barge-in).</span>
            </div>
          ) : (
            <p className="text-xs font-sans text-zinc-500">
              Conversational loop ready. Microphone active.
            </p>
          )}
        </div>

        {/* Interactive Speech Action Controls */}
        <div className="flex items-center gap-3 mt-6 z-10">
          {/* Mute Mic */}
          <button
            onClick={toggleMicMute}
            className={`p-3 rounded-full transition shadow-lg ${
              isMicMuted
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
            title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Interrupt TTS button (Barge-In) */}
          {speechState === 'speaking' && (
            <button
              onClick={handleInterrupt}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition shadow-md animate-pulse"
              title="Interrupt AXION voice"
            >
              <Hand className="w-4 h-4" />
              <span>Interrupt Voice (Barge-In)</span>
            </button>
          )}
        </div>

        {/* Quick Conversational Prompt Pills */}
        <div className="mt-8 max-w-xl w-full">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider text-center mb-2.5">
            Test Hinglish Voice Prompts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sampleVoicePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleVoicePromptClick(prompt)}
                disabled={isWorking}
                className="text-left p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white transition text-xs flex items-center justify-between group disabled:opacity-50"
              >
                <span className="truncate pr-2">{prompt}</span>
                <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Settings Modal */}
      {isVoiceSettingsOpen && (
        <VoiceSettingsModal onClose={() => setIsVoiceSettingsOpen(false)} />
      )}
    </div>
  );
};
