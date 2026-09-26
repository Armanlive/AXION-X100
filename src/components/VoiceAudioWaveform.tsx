import React from 'react';
import { SpeechState } from '../types';

interface VoiceAudioWaveformProps {
  isActive: boolean;
  state: SpeechState;
}

export const VoiceAudioWaveform: React.FC<VoiceAudioWaveformProps> = ({ isActive, state }) => {
  if (!isActive && (state === 'ready' || state === 'idle')) return null;

  // Bar count: compact 7 bars
  const bars = [14, 24, 38, 20, 32, 18, 12];

  const getBarColor = () => {
    switch (state) {
      case 'listening':
        return 'bg-red-500';
      case 'parsing':
      case 'understanding':
        return 'bg-amber-400';
      case 'working':
      case 'thinking':
        return 'bg-blue-400';
      case 'speaking':
        return 'bg-emerald-400';
      default:
        return 'bg-zinc-500';
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening (Hinglish/EN)...';
      case 'understanding':
      case 'parsing':
        return 'Parsing intent...';
      case 'thinking':
      case 'working':
        return 'Synthesizing patch...';
      case 'speaking':
        return 'Speaking...';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono animate-in fade-in duration-200">
      <div className="flex items-center gap-0.5 h-4">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`w-[2px] rounded-full transition-all duration-150 ${getBarColor()}`}
            style={{
              height: isActive
                ? `${Math.max(4, height * (0.4 + (i % 3) * 0.3))}px`
                : '3px',
              animation: isActive ? `pulse 0.8s ease-in-out infinite alternate ${i * 0.1}s` : 'none'
            }}
          />
        ))}
      </div>
      <span className="text-[11px] text-zinc-300 font-medium whitespace-nowrap">
        {getStateLabel()}
      </span>
    </div>
  );
};
