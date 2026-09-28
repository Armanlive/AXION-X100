import React from 'react';
import { VoiceState } from '../../utils/voiceEngine';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  X,
  Volume2,
  VolumeX,
  Settings,
  Hand
} from 'lucide-react';

interface VoiceControlsProps {
  state: VoiceState;
  isMuted: boolean;
  onToggleMute: () => void;
  audioTtsEnabled: boolean;
  onToggleTts: () => void;
  onEndConversation: () => void;
  onOpenSettings: () => void;
  onInterrupt?: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  state,
  isMuted,
  onToggleMute,
  audioTtsEnabled,
  onToggleTts,
  onEndConversation,
  onOpenSettings,
  onInterrupt
}) => {
  const isSpeaking = state === 'speaking';

  return (
    <div className="flex items-center justify-center gap-3 md:gap-4 p-4 z-20 select-none">
      {/* 1. Barge-In Interruption Button (Visible when AXION is speaking) */}
      {isSpeaking && onInterrupt && (
        <button
          onClick={onInterrupt}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold shadow-lg transition-all animate-bounce"
          title="Interrupt AXION and speak"
        >
          <Hand className="w-3.5 h-3.5" />
          <span>Interrupt</span>
        </button>
      )}

      {/* 2. Speaker Audio Readout Toggle */}
      <button
        onClick={onToggleTts}
        className={`p-3 rounded-full transition-all border ${
          audioTtsEnabled
            ? 'bg-zinc-850 hover:bg-zinc-800 text-cyan-400 border-cyan-500/30 shadow-md shadow-cyan-500/5'
            : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-500 border-zinc-800'
        }`}
        title={audioTtsEnabled ? 'Speaker Output ON' : 'Speaker Output Muted (Text Only)'}
      >
        {audioTtsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      {/* 3. Primary Microphone Mute / Unmute Button */}
      <button
        onClick={onToggleMute}
        className={`p-4 rounded-full transition-all border shadow-xl flex items-center justify-center ${
          isMuted
            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 shadow-rose-500/10'
            : state === 'listening'
            ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-300 shadow-cyan-500/30 animate-pulse'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
        }`}
        title={isMuted ? 'Unmute Microphone (Start Listening)' : 'Mute Microphone (Pause Listening)'}
      >
        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>

      {/* 4. End Conversation & Return to Chat */}
      <button
        onClick={onEndConversation}
        className="p-3 rounded-full bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 border border-zinc-800 hover:border-rose-800/60 transition-all shadow-md"
        title="End Voice Conversation (Preserves all history in Chat)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 5. Voice Settings Trigger */}
      <button
        onClick={onOpenSettings}
        className="p-3 rounded-full bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-all shadow-md"
        title="Voice & Language Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
};
