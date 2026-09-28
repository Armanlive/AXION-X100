import React, { useEffect, useState, useRef, useMemo } from 'react';
import { VoiceState } from '../../utils/voiceEngine';

interface AxionFaceProps {
  state: VoiceState;
  audioLevel?: number; // 0.0 to 1.0
  isMuted?: boolean;
}

export const AxionFace: React.FC<AxionFaceProps> = ({
  state,
  audioLevel = 0,
  isMuted = false
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [neuralTick, setNeuralTick] = useState(0);

  // Smooth smoothed audio level for fluid animations
  const smoothedLevelRef = useRef(0);
  const [smoothedLevel, setSmoothedLevel] = useState(0);

  // Periodic natural blinking
  useEffect(() => {
    let blinkTimeout: any;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        const nextBlinkDelay = 3500 + Math.random() * 4000;
        blinkTimeout = setTimeout(triggerBlink, nextBlinkDelay);
      }, 160);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(blinkTimeout);
  }, []);

  // Neural animation loop for state dynamics
  useEffect(() => {
    let animId: number;
    const updateNeural = () => {
      // Linear interpolation smoothing for audio level
      const target = audioLevel;
      smoothedLevelRef.current += (target - smoothedLevelRef.current) * 0.25;
      setSmoothedLevel(smoothedLevelRef.current);
      setNeuralTick((prev) => (prev + 0.03) % (Math.PI * 2));
      animId = requestAnimationFrame(updateNeural);
    };

    animId = requestAnimationFrame(updateNeural);
    return () => cancelAnimationFrame(animId);
  }, [audioLevel]);

  // Derive dynamic color schemes according to state
  const stateTheme = useMemo(() => {
    switch (state) {
      case 'speaking':
        return {
          glow: 'from-cyan-500/30 via-blue-600/15 to-transparent',
          neonColor: '#00f0ff',
          secondaryNeon: '#3b82f6',
          ringBorder: 'border-cyan-400/40',
          ringPulse: 'animate-pulse',
          statusText: 'Speaking',
          dotColor: 'bg-cyan-400'
        };
      case 'thinking':
        return {
          glow: 'from-indigo-500/30 via-purple-600/15 to-transparent',
          neonColor: '#818cf8',
          secondaryNeon: '#c084fc',
          ringBorder: 'border-indigo-400/40',
          ringPulse: 'animate-spin',
          statusText: 'Thinking',
          dotColor: 'bg-indigo-400'
        };
      case 'transcribing':
      case 'listening':
        return {
          glow: 'from-emerald-500/25 via-cyan-600/15 to-transparent',
          neonColor: '#10b981',
          secondaryNeon: '#06b6d4',
          ringBorder: 'border-emerald-400/40',
          ringPulse: 'animate-pulse',
          statusText: 'Listening',
          dotColor: 'bg-emerald-400'
        };
      case 'paused':
        return {
          glow: 'from-amber-500/20 via-orange-600/10 to-transparent',
          neonColor: '#f59e0b',
          secondaryNeon: '#d97706',
          ringBorder: 'border-amber-400/30',
          ringPulse: '',
          statusText: 'Paused',
          dotColor: 'bg-amber-400'
        };
      case 'error':
        return {
          glow: 'from-rose-500/20 via-pink-600/10 to-transparent',
          neonColor: '#f43f5e',
          secondaryNeon: '#e11d48',
          ringBorder: 'border-rose-400/30',
          ringPulse: '',
          statusText: 'Notice',
          dotColor: 'bg-rose-400'
        };
      default: // idle
        return {
          glow: 'from-cyan-500/15 via-blue-600/10 to-transparent',
          neonColor: '#38bdf8',
          secondaryNeon: '#60a5fa',
          ringBorder: 'border-cyan-500/20',
          ringPulse: '',
          statusText: 'Idle',
          dotColor: 'bg-cyan-400'
        };
    }
  }, [state]);

  // Audio reactivity offsets
  const mouthScaleY = state === 'speaking'
    ? Math.max(0.2, smoothedLevel * 2.8)
    : state === 'listening'
    ? Math.max(0.1, smoothedLevel * 1.5)
    : 0.1;

  const eyeGlowIntensity = state === 'speaking' || state === 'listening'
    ? 0.7 + smoothedLevel * 0.3
    : 0.5;

  const auraRadius = 140 + smoothedLevel * 30 + Math.sin(neuralTick) * 6;

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-6">
      {/* Outer Radial Ambient Aura */}
      <div
        style={{
          width: `${auraRadius * 2.4}px`,
          height: `${auraRadius * 2.4}px`,
          filter: 'blur(45px)',
          transition: 'width 0.2s ease-out, height 0.2s ease-out'
        }}
        className={`absolute rounded-full bg-gradient-to-r ${stateTheme.glow} pointer-events-none transition-all duration-300`}
      />

      {/* Orbital Neural Resonance Rings */}
      <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
        {/* Outer Tech Ring */}
        <div
          style={{
            transform: `rotate(${neuralTick * (state === 'thinking' ? 40 : 10)}deg)`,
            borderColor: stateTheme.neonColor,
            opacity: 0.25 + smoothedLevel * 0.4
          }}
          className="absolute inset-0 rounded-full border border-dashed transition-opacity duration-300 pointer-events-none"
        />

        {/* Inner Counter-Rotating Ring */}
        <div
          style={{
            transform: `rotate(${-neuralTick * 15}deg)`,
            borderColor: stateTheme.secondaryNeon,
            opacity: 0.15 + smoothedLevel * 0.3
          }}
          className="absolute inset-4 rounded-full border border-dotted transition-opacity duration-300 pointer-events-none"
        />

        {/* Central Vector Stylized Face (SVG Digital Mesh) */}
        <svg
          viewBox="0 0 320 320"
          className="w-full h-full relative z-10 drop-shadow-[0_0_20px_rgba(0,240,255,0.25)]"
          aria-label="AXION Digital AI Avatar"
        >
          <defs>
            {/* Cyan/Blue Neon Gradient */}
            <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={stateTheme.neonColor} stopOpacity="0.9" />
              <stop offset="100%" stopColor={stateTheme.secondaryNeon} stopOpacity="0.7" />
            </linearGradient>

            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={stateTheme.neonColor} stopOpacity={eyeGlowIntensity} />
              <stop offset="100%" stopColor={stateTheme.secondaryNeon} stopOpacity="0" />
            </radialGradient>

            <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Symmetrical Head Silhouette & Cyber Contour Mesh */}
          <g filter="url(#neonBlur)">
            {/* Outer Head Contour */}
            <path
              d="M 100 80 C 130 50, 190 50, 220 80 C 240 105, 245 150, 235 195 C 225 240, 190 270, 160 275 C 130 270, 95 240, 85 195 C 75 150, 80 105, 100 80 Z"
              fill="none"
              stroke="url(#neonGrad)"
              strokeWidth="1.6"
              strokeDasharray="4 2"
              opacity="0.6"
            />

            {/* Jawline & Chin Structure */}
            <path
              d="M 95 190 L 130 240 L 160 252 L 190 240 L 225 190"
              fill="none"
              stroke={stateTheme.neonColor}
              strokeWidth="1.4"
              opacity="0.5"
            />

            {/* Forehead Cyber Nodes & Neural Grid Lines */}
            <path
              d="M 120 75 L 160 95 L 200 75 M 160 95 L 160 135"
              fill="none"
              stroke={stateTheme.secondaryNeon}
              strokeWidth="1.2"
              opacity="0.45"
            />
            <circle cx="160" cy="95" r="3" fill={stateTheme.neonColor} opacity="0.8" />
            <circle cx="120" cy="75" r="2.2" fill={stateTheme.secondaryNeon} opacity="0.7" />
            <circle cx="200" cy="75" r="2.2" fill={stateTheme.secondaryNeon} opacity="0.7" />

            {/* Temple & Cheek Nodes */}
            <circle cx="88" cy="155" r="2.5" fill={stateTheme.neonColor} opacity="0.6" />
            <circle cx="232" cy="155" r="2.5" fill={stateTheme.neonColor} opacity="0.6" />
            <line x1="88" y1="155" x2="115" y2="165" stroke={stateTheme.neonColor} strokeWidth="1" opacity="0.3" />
            <line x1="232" y1="155" x2="205" y2="165" stroke={stateTheme.neonColor} strokeWidth="1" opacity="0.3" />

            {/* Cyber Brow Line */}
            <path
              d="M 108 128 Q 128 120 148 128 M 172 128 Q 192 120 212 128"
              fill="none"
              stroke={stateTheme.neonColor}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Left Eye & Luminous Iris */}
            <g transform="translate(128, 142)">
              {/* Eye Socket Arc */}
              <path
                d="M -16 0 Q 0 -8 16 0 Q 0 8 -16 0 Z"
                fill="rgba(5, 15, 25, 0.8)"
                stroke={stateTheme.neonColor}
                strokeWidth="1.2"
              />
              {/* Eye Iris / Pupil (with natural blink compression) */}
              {!isBlinking ? (
                <>
                  <circle cx="0" cy="0" r="7" fill="url(#eyeGlow)" />
                  <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.9" />
                  <circle cx="0" cy="0" r="1.2" fill={stateTheme.neonColor} />
                </>
              ) : (
                <line x1="-14" y1="0" x2="14" y2="0" stroke={stateTheme.neonColor} strokeWidth="2" />
              )}
            </g>

            {/* Right Eye & Luminous Iris */}
            <g transform="translate(192, 142)">
              {/* Eye Socket Arc */}
              <path
                d="M -16 0 Q 0 -8 16 0 Q 0 8 -16 0 Z"
                fill="rgba(5, 15, 25, 0.8)"
                stroke={stateTheme.neonColor}
                strokeWidth="1.2"
              />
              {/* Eye Iris / Pupil (with natural blink compression) */}
              {!isBlinking ? (
                <>
                  <circle cx="0" cy="0" r="7" fill="url(#eyeGlow)" />
                  <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.9" />
                  <circle cx="0" cy="0" r="1.2" fill={stateTheme.neonColor} />
                </>
              ) : (
                <line x1="-14" y1="0" x2="14" y2="0" stroke={stateTheme.neonColor} strokeWidth="2" />
              )}
            </g>

            {/* Nose Bridge Coordinate Matrix */}
            <path
              d="M 160 135 L 160 178 L 152 186 L 168 186"
              fill="none"
              stroke={stateTheme.secondaryNeon}
              strokeWidth="1.2"
              opacity="0.5"
            />
            <circle cx="160" cy="186" r="1.5" fill={stateTheme.neonColor} />

            {/* Audio-Reactive Cyber Mouth & Resonator Waveform Bars */}
            <g transform="translate(160, 218)">
              {/* Symmetrical 9-Bar Soundwave Resonator at Mouth Position */}
              {[-32, -24, -16, -8, 0, 8, 16, 24, 32].map((xOffset, idx) => {
                const centerWeight = 1 - Math.abs(xOffset) / 40;
                const barHeight = Math.max(
                  2,
                  mouthScaleY * 18 * centerWeight + Math.sin(neuralTick * 4 + idx) * (state === 'speaking' ? 4 : 1)
                );
                return (
                  <rect
                    key={idx}
                    x={xOffset - 1.5}
                    y={-barHeight / 2}
                    width="3"
                    height={barHeight}
                    rx="1.5"
                    fill={stateTheme.neonColor}
                    opacity={0.3 + centerWeight * 0.6 + smoothedLevel * 0.3}
                  />
                );
              })}

              {/* Underlying Clean Lip Contour */}
              <path
                d={`M -28 0 Q 0 ${mouthScaleY * 8} 28 0`}
                fill="none"
                stroke={stateTheme.secondaryNeon}
                strokeWidth="1"
                opacity="0.4"
              />
            </g>
          </g>
        </svg>

        {/* State Floating Beacon / Badge */}
        <div className="absolute -bottom-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950/80 border border-zinc-800 backdrop-blur-md shadow-lg">
          <span className={`w-2 h-2 rounded-full ${stateTheme.dotColor} ${state !== 'idle' ? 'animate-ping' : ''}`} />
          <span className="text-[11px] font-mono tracking-wider font-semibold uppercase text-zinc-300">
            {isMuted ? 'Muted' : stateTheme.statusText}
          </span>
        </div>
      </div>
    </div>
  );
};
