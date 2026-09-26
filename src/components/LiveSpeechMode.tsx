import React, { useState, useEffect, useRef } from 'react';
import { useAxionStore } from '../store/useAxionStore';
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
  Hand
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
    activeModelId,
    models,
    messages,
    interruptSpeech,
    activeWorkspaceId,
    workspaces
  } = useAxionStore();

  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const isComponentMounted = useRef(true);

  const activeSpecialist = agents.find((a) => a.id === selectedAgentId);
  const activeModel = models.find((m) => m.id === activeModelId);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  // Initialize Web Speech API Recognition
  useEffect(() => {
    isComponentMounted.current = true;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && !isMicMuted && speechMode === 'speech') {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN'; // Multi-language fallback supports Hindi + Hinglish + English
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => {
          if (isComponentMounted.current && speechState !== 'speaking' && speechState !== 'thinking') {
            setSpeechState('listening');
          }
        };

        recognition.onresult = (event: any) => {
          // If AI is speaking and user speaks, interrupt TTS!
          if (speechState === 'speaking') {
            interruptSpeech();
          }

          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const finalTranscript = event.results[i][0].transcript.trim();
              if (finalTranscript) {
                setLiveTranscript('');
                setSpeechState('understanding');
                executeUserPrompt(finalTranscript, true);
              }
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          if (currentInterim) {
            setLiveTranscript(currentInterim);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error/pause', e);
        };

        recognition.onend = () => {
          // Restart listening automatically if speech mode is active and not muted
          if (isComponentMounted.current && speechMode === 'speech' && !isMicMuted && speechState !== 'speaking') {
            try {
              recognition.start();
            } catch (err) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Could not launch speech recognition', err);
      }
    }

    return () => {
      isComponentMounted.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {}
      }
    };
  }, [speechMode, isMicMuted]);

  // Fallback simulator for browser preview if no microphone hardware is available
  const triggerSimulationUtterance = (text: string) => {
    setLiveTranscript(text);
    setSpeechState('understanding');
    setTimeout(() => {
      setLiveTranscript('');
      executeUserPrompt(text, true);
    }, 600);
  };

  const sampleSpeechPrompts = [
    'Bhai is project me login page kaha bana hua hai?',
    'Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de',
    'Explain the main App component and its dependencies',
    'Ek naya StatsCard component banao with glowing trend metrics'
  ];

  const recentMessages = messages.slice(-4);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] text-zinc-100 select-none overflow-hidden relative">
      {/* Top Bar for Speech Mode */}
      <div className="h-11 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-[#0d0d10] shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 text-[11px]">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>LIVE CONVERSATIONAL SPEECH</span>
          </span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400">{activeWs?.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => setIsVoiceSettingsOpen(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Speech & Audio Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Return to Chat Mode */}
          <button
            onClick={() => setSpeechMode('chat')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
            <span>Return to Chat</span>
          </button>
        </div>
      </div>

      {/* Main Conversational Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Glowing Dynamic Sound Sphere Visualizer */}
        <div className="relative flex items-center justify-center my-6">
          {/* Pulsing Aura Rings */}
          <div
            className={`absolute rounded-full transition-all duration-700 ${
              speechState === 'speaking'
                ? 'w-64 h-64 bg-emerald-500/15 animate-ping'
                : speechState === 'listening'
                ? 'w-56 h-56 bg-blue-500/10 animate-pulse'
                : speechState === 'thinking' || speechState === 'understanding'
                ? 'w-60 h-60 bg-amber-500/10 animate-pulse'
                : 'w-48 h-48 bg-zinc-800/20'
            }`}
          />

          <div
            className={`w-40 h-40 rounded-full border flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative z-10 ${
              speechState === 'speaking'
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-emerald-900/30'
                : speechState === 'listening'
                ? 'bg-blue-950/40 border-blue-500/50 shadow-blue-900/30'
                : speechState === 'thinking' || speechState === 'understanding'
                ? 'bg-amber-950/30 border-amber-500/50 shadow-amber-900/20'
                : 'bg-zinc-900/80 border-zinc-700/60 shadow-black'
            }`}
          >
            {speechState === 'speaking' ? (
              <Volume2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            ) : speechState === 'listening' ? (
              <Mic className="w-10 h-10 text-blue-400 animate-pulse" />
            ) : speechState === 'thinking' || speechState === 'understanding' ? (
              <Sparkles className="w-10 h-10 text-amber-400 animate-spin" />
            ) : (
              <Mic className="w-10 h-10 text-zinc-500" />
            )}

            {/* State Label */}
            <span className="text-[11px] font-mono mt-2 font-semibold uppercase tracking-wider text-zinc-300">
              {speechState === 'speaking'
                ? 'Speaking...'
                : speechState === 'listening'
                ? 'Listening...'
                : speechState === 'understanding'
                ? 'Understanding...'
                : speechState === 'thinking'
                ? 'Thinking...'
                : 'Ready'}
            </span>
          </div>
        </div>

        {/* Live Transcript / Feedback Whisper */}
        <div className="max-w-md w-full text-center px-4 min-h-[44px]">
          {liveTranscript ? (
            <p className="text-sm font-sans text-white bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2 animate-in fade-in">
              "{liveTranscript}"
            </p>
          ) : speechState === 'listening' ? (
            <p className="text-xs font-sans text-zinc-400">
              Speak naturally in Hindi, Hinglish, or English...
            </p>
          ) : speechState === 'speaking' ? (
            <p className="text-xs font-sans text-emerald-400 flex items-center justify-center gap-1.5">
              <span>AXION is speaking. Click anywhere or speak to interrupt.</span>
            </p>
          ) : null}
        </div>

        {/* Interactive Speech Action Controls */}
        <div className="flex items-center gap-3 mt-4 z-10">
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

          {/* Interrupt / Stop Speaking Button */}
          {speechState === 'speaking' && (
            <button
              onClick={interruptSpeech}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold border border-amber-600/40 shadow-lg transition"
              title="Interrupt speech synthesis"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Interrupt</span>
            </button>
          )}
        </div>

        {/* Quick Voice Simulation Triggers for Browser Sandbox Testing */}
        <div className="mt-8 max-w-lg w-full">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 text-center mb-2">
            Hinglish & English Voice Simulator Presets:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {sampleSpeechPrompts.map((prompt, idx) => (
              <button
                key={idx}
                disabled={isWorking}
                onClick={() => triggerSimulationUtterance(prompt)}
                className="text-left px-3 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-300 transition flex items-center justify-between group"
              >
                <span className="truncate pr-2">{prompt}</span>
                <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Context Info Footer */}
      <div className="h-8 px-4 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 bg-[#0d0d10] shrink-0">
        <div>
          <span>Agent: </span>
          <span className="text-zinc-300">
            {isManualMode && activeSpecialist ? activeSpecialist.name : 'Boss Agent (Autonomous)'}
          </span>
          <span className="mx-2">•</span>
          <span>Router: </span>
          <span className="text-zinc-300">{activeModel?.name || 'Gemini 2.0 Flash'} ($0.00)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Zero Silent Writes Guaranteed</span>
        </div>
      </div>

      {/* Voice Settings Modal */}
      {isVoiceSettingsOpen && (
        <VoiceSettingsModal onClose={() => setIsVoiceSettingsOpen(false)} />
      )}
    </div>
  );
};
