import React from 'react';
import { SpeechState } from '../types';

interface VoiceAudioWaveformProps {
  isActive: boolean;
  state: SpeechState;
}

export const VoiceAudioWaveform: React.FC<VoiceAudioWaveformProps> = ({ isActive, state }) => {
  if (!isActive && (state === 'ready' || state === 'idle')) return null;

  // Bar count: 9 dynamic acoustic bars
  const bars = [12, 18, 28, 42, 26, 36, 20, 16, 10];

  const getBarColor = () => {
    switch (state) {
      case 'listening':
        return 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]';
      case 'parsing':
      case 'understanding':
        return 'bg-[#38bdf8] shadow-[0_0_6px_#38bdf8]';
      case 'working':
      case 'thinking':
        return 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]';
      case 'speaking':
        return 'bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]';
      default:
        return 'bg-cyan-500/60';
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'LISTENING...';
      case 'understanding':
      case 'parsing':
        return 'UNDERSTANDING...';
      case 'thinking':
      case 'working':
        return 'THINKING...';
      case 'speaking':
        return 'SPEAKING...';
      default:
        return 'AXION READY';
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#070d1c]/90 border border-cyan-500/35 text-xs font-mono shadow-[0_0_20px_rgba(0,240,255,0.2)] backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex items-center gap-1 h-5">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`w-[2.5px] rounded-full transition-all duration-150 ${getBarColor()}`}
            style={{
              height: isActive
                ? `${Math.max(4, height * (0.35 + (i % 4) * 0.22))}px`
                : '4px',
              animation: isActive ? `pulse 0.75s ease-in-out infinite alternate ${i * 0.08}s` : 'none'
            }}
          />
        ))}
      </div>
      <span className="text-[10px] text-cyan-200 font-bold tracking-wider whitespace-nowrap">
        {getStateLabel()}
      </span>
    </div>
  );
};
