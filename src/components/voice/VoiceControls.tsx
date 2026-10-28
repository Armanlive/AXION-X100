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
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cyan-950/80 hover:bg-cyan-900/80 text-[#00f0ff] border border-cyan-400/50 text-xs font-mono font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all animate-bounce"
          title="Interrupt AXION and speak"
        >
          <Hand className="w-4 h-4 text-[#00f0ff]" />
          <span>INTERRUPT</span>
        </button>
      )}

      {/* 2. Speaker Audio Readout Toggle */}
      <button
        onClick={onToggleTts}
        className={`p-3 rounded-full transition-all border backdrop-blur-md ${
          audioTtsEnabled
            ? 'bg-cyan-950/80 hover:bg-cyan-900/80 text-[#00f0ff] border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
            : 'bg-[#080e1c] hover:bg-[#0c162c] text-cyan-600 border-cyan-500/20'
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
            ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border-rose-500/40 shadow-rose-500/20'
            : state === 'listening'
            ? 'bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] border-cyan-200 shadow-[0_0_30px_rgba(0,240,255,0.7)] animate-pulse'
            : 'bg-[#0a1224] hover:bg-[#0e1932] text-white border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]'
        }`}
        title={isMuted ? 'Unmute Microphone (Start Listening)' : 'Mute Microphone (Pause Listening)'}
      >
        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>

      {/* 4. End Conversation & Return to Chat */}
      <button
        onClick={onEndConversation}
        className="p-3 rounded-full bg-[#080e1c] hover:bg-rose-950/60 text-cyan-300 hover:text-rose-300 border border-cyan-500/25 hover:border-rose-500/40 transition-all shadow-md"
        title="End Voice Conversation (Preserves all history in Chat)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 5. Voice Settings Trigger */}
      <button
        onClick={onOpenSettings}
        className="p-3 rounded-full bg-[#080e1c] hover:bg-[#0c162c] text-cyan-300 hover:text-white border border-cyan-500/25 hover:border-cyan-400 transition-all shadow-md"
        title="Voice & Language Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
};
