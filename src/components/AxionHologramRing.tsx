import React, { useId, useMemo, useEffect, useState } from 'react';

export type AxionVisualizerState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'rendering';

export interface AxionHologramRingProps {
  state?: AxionVisualizerState;
  /** Audio amplitude level normalized 0 to 1 */
  audioLevel?: number;
  /** Size variant */
  size?: 'header' | 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  showTelemetry?: boolean;
  isMuted?: boolean;
}

export const AxionHologramRing: React.FC<AxionHologramRingProps> = ({
  state = 'idle',
  audioLevel = 0,
  size = 'header',
  className = '',
  interactive = false,
  onClick,
  showTelemetry = false,
  isMuted = false,
}) => {
  const rawId = useId().replace(/:/g, '');
  const id = `axion-holo-${rawId}`;

  // Smooth audio reaction
  const safeLevel = Math.min(1, Math.max(0, audioLevel));

  // Pulse wave animation counter for kinetic shockwaves
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (state === 'idle') return;
    const interval = setInterval(() => {
      setPulseCount((prev) => (prev + 1) % 100);
    }, state === 'thinking' ? 600 : state === 'listening' ? 450 : 500);
    return () => clearInterval(interval);
  }, [state]);

  // Dimensions based on size variant
  const sizeConfig = useMemo(() => {
    switch (size) {
      case 'header':
        return { px: 46, viewBox: 280, scale: 1 };
      case 'sm':
        return { px: 72, viewBox: 280, scale: 1 };
      case 'md':
        return { px: 130, viewBox: 280, scale: 1 };
      case 'lg':
        return { px: 220, viewBox: 280, scale: 1 };
      case 'hero':
      default:
        return { px: 340, viewBox: 280, scale: 1 };
    }
  }, [size]);

  // Number of radial frequency bars
  const barCount = 44;
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const angle = (i / barCount) * Math.PI * 2;
      const deg = (i / barCount) * 360;
      return { index: i, angle, deg };
    });
  }, [barCount]);

  // Speed modifiers depending on state
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking' || state === 'rendering';

  const outerSpeed = isThinking ? '6s' : isListening ? '10s' : isSpeaking ? '8s' : '22s';
  const innerSpeed = isThinking ? '4.5s' : isListening ? '7s' : isSpeaking ? '6s' : '15s';
  const radarSpeed = isThinking ? '2.2s' : isListening ? '3.5s' : '6s';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer group' : ''
      } ${className}`}
      style={{ width: sizeConfig.px, height: sizeConfig.px }}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : 'img'}
      aria-label={`AXION Holographic Visualizer - ${state}`}
      tabIndex={interactive ? 0 : undefined}
    >
      {/* Background radial lens glow */}
      <div
        className={`absolute inset-0 rounded-full pointer-events-none transition-all duration-500 ${
          isListening
            ? 'bg-cyan-500/20 shadow-[0_0_35px_rgba(0,240,255,0.45)]'
            : isThinking
            ? 'bg-sky-500/20 shadow-[0_0_30px_rgba(56,189,248,0.4)]'
            : isSpeaking
            ? 'bg-cyan-400/25 shadow-[0_0_40px_rgba(0,240,255,0.5)]'
            : 'bg-cyan-500/10 shadow-[0_0_20px_rgba(0,240,255,0.15)] group-hover:bg-cyan-500/15'
        }`}
      />

      <svg
        viewBox="-140 -140 280 280"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Holographic Glowing Filters */}
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={size === 'header' ? '1.5' : '2.5'} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={`${id}-deep-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={size === 'header' ? '2.5' : '4.5'} result="blur1" />
            <feGaussianBlur stdDeviation={size === 'header' ? '1' : '1.8'} result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Radar Sweep Gradient */}
          <radialGradient id={`${id}-radar-grad`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#00f0ff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>

          {/* Central Reactor Core Gradient */}
          <radialGradient id={`${id}-core-grad`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="35%" stopColor="#e0f7ff" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#00f0ff" stopOpacity="0.8" />
            <stop offset="88%" stopColor="#0284c7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#050508" stopOpacity="0" />
          </radialGradient>

          {/* Ring Arc Linear Gradient */}
          <linearGradient id={`${id}-arc-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* 1. KINETIC SHOCKWAVE PULSE RINGS (Expands during listening/thinking/rendering) */}
        {(isListening || isThinking || isSpeaking) && (
          <g className="kinetic-shockwaves" aria-hidden="true">
            <circle
              r="75"
              fill="none"
              stroke="#00f0ff"
              strokeWidth="1.2"
              opacity="0.8"
              className="animate-axion-pulse"
            />
            <circle
              r="95"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.8"
              opacity="0.5"
              style={{
                animation: 'axion-shockwave 2.4s cubic-bezier(0.1, 0.8, 0.3, 1) infinite',
                animationDelay: '0.4s',
                transformOrigin: '0 0'
              }}
            />
          </g>
        )}

        {/* 2. OUTER COMPASS HUD RING (Rotating Clockwise) */}
        <g
          style={{
            animation: `axion-spin-cw ${outerSpeed} linear infinite`,
            transformOrigin: '0 0',
          }}
          filter={`url(#${id}-glow)`}
        >
          {/* Base outer fine ring */}
          <circle
            r="126"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="0.75"
            strokeOpacity="0.4"
            strokeDasharray="6 3 1 3"
          />

          {/* Outer Segmented Targeting Brackets */}
          <circle
            r="131"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="1.8"
            strokeDasharray="42 48 30 60 70 30"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />

          {/* Compass Ticks */}
          {Array.from({ length: 24 }).map((_, i) => {
            const rot = i * 15;
            const isMajor = i % 6 === 0;
            return (
              <line
                key={i}
                x1="0"
                y1={isMajor ? "-122" : "-125"}
                x2="0"
                y2="-129"
                stroke={isMajor ? "#00f0ff" : "#38bdf8"}
                strokeWidth={isMajor ? "1.5" : "0.6"}
                strokeOpacity={isMajor ? "0.9" : "0.45"}
                transform={`rotate(${rot})`}
              />
            );
          })}
        </g>

        {/* 3. DUAL-ARC SEGMENTED CALIBRATION RING (Rotating Counter-Clockwise) */}
        <g
          style={{
            animation: `axion-spin-ccw ${innerSpeed} linear infinite`,
            transformOrigin: '0 0',
          }}
          filter={`url(#${id}-glow)`}
        >
          {/* High-intensity neon arc segments */}
          <circle
            r="112"
            fill="none"
            stroke={`url(#${id}-arc-grad)`}
            strokeWidth="2.4"
            strokeDasharray="80 32 40 24 110 34"
            strokeLinecap="round"
          />

          {/* Dashed coordinate marker ring */}
          <circle
            r="104"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeDasharray="2 8"
            strokeOpacity="0.6"
          />
        </g>

        {/* 4. RADAR SWEEP LINE / SCANNER BEAM */}
        <g
          style={{
            animation: `axion-radar-sweep ${radarSpeed} linear infinite`,
            transformOrigin: '0 0',
          }}
          opacity={isThinking ? 0.85 : isListening ? 0.65 : 0.35}
        >
          {/* Sweeping laser arc beam */}
          <path
            d="M 0 0 L 105 -35 A 110 110 0 0 1 110 0 Z"
            fill={`url(#${id}-radar-grad)`}
          />
          <line
            x1="0"
            y1="0"
            x2="110"
            y2="0"
            stroke="#00f0ff"
            strokeWidth="1.2"
            strokeOpacity="0.8"
            filter={`url(#${id}-glow)`}
          />
        </g>

        {/* 5. RADIAL ACOUSTIC SOUNDWAVE FREQUENCY BARS (Reaction to Audio / Thinking / Output) */}
        <g filter={`url(#${id}-glow)`}>
          {bars.map(({ index, angle, deg }) => {
            // Dynamic bar height
            let height = 6;
            if (isListening) {
              const audioInfluence = safeLevel * 20;
              const wave = Math.sin(index * 0.7 + pulseCount * 0.8) * 8;
              height = Math.max(4, 8 + wave + audioInfluence);
            } else if (isThinking) {
              const pulse = Math.sin(index * 1.2 + pulseCount * 1.5) * 10;
              height = Math.max(3, 7 + Math.abs(pulse));
            } else if (isSpeaking) {
              const acoustic = Math.sin(index * 0.5 + pulseCount * 1.1) * 14;
              height = Math.max(4, 9 + Math.abs(acoustic));
            } else {
              // Ambient gentle wave oscillation
              const ambient = Math.sin(index * 0.4 + (index % 3)) * 3;
              height = Math.max(3, 5 + ambient);
            }

            const r1 = 80;
            const r2 = r1 + height;
            const x1 = Math.cos(angle) * r1;
            const y1 = Math.sin(angle) * r1;
            const x2 = Math.cos(angle) * r2;
            const y2 = Math.sin(angle) * r2;

            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={index % 4 === 0 ? "#00f0ff" : "#38bdf8"}
                strokeWidth={index % 6 === 0 ? "1.6" : "0.9"}
                strokeOpacity={isListening || isSpeaking ? 0.95 : 0.6}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* 6. INNER GYRO RING & TELEMETRY RETICLE */}
        <g
          style={{
            animation: `axion-spin-cw ${isThinking ? '7s' : '18s'} linear infinite`,
            transformOrigin: '0 0',
          }}
        >
          {/* Inner circle with hex marks */}
          <circle
            r="66"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="1.2"
            strokeDasharray="14 6 4 6"
            strokeOpacity="0.75"
          />

          {/* 4 Quadrant Crosshair Nodes */}
          <circle cx="66" cy="0" r="2.2" fill="#00f0ff" />
          <circle cx="-66" cy="0" r="2.2" fill="#00f0ff" />
          <circle cx="0" cy="66" r="2.2" fill="#38bdf8" />
          <circle cx="0" cy="-66" r="2.2" fill="#38bdf8" />
        </g>

        {/* Inner Counter Reticle */}
        <g
          style={{
            animation: `axion-spin-ccw ${isThinking ? '5s' : '14s'} linear infinite`,
            transformOrigin: '0 0',
          }}
        >
          <circle
            r="50"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.9"
            strokeDasharray="24 12 6 12"
            strokeOpacity="0.6"
          />
        </g>

        {/* 7. ARC-REACTOR CENTRAL CORE (Pulsating Fusion Chamber) */}
        <g
          className="animate-axion-core"
          style={{ transformOrigin: '0 0' }}
          filter={`url(#${id}-deep-glow)`}
        >
          {/* Outer glow sphere */}
          <circle
            r={isListening ? 36 + safeLevel * 8 : 34}
            fill={`url(#${id}-core-grad)`}
            stroke="#00f0ff"
            strokeWidth="1.2"
            strokeOpacity="0.8"
          />

          {/* Tri-Blade Reactor Hub (Rotating Kinetic Blades) */}
          <g
            style={{
              animation: `axion-spin-cw ${isThinking ? '3s' : '8s'} linear infinite`,
              transformOrigin: '0 0',
            }}
          >
            {[0, 120, 240].map((deg) => (
              <path
                key={deg}
                d="M 0 -7 L 16 -18 A 22 22 0 0 1 20 -4 L 6 0 Z"
                fill="#00f0ff"
                fillOpacity="0.75"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>

          {/* Inner iris ring */}
          <circle
            r="16"
            fill="#050508"
            stroke="#00f0ff"
            strokeWidth="1.4"
          />

          {/* Hot incandescent center light */}
          <circle
            r={isListening ? 7 + safeLevel * 3 : 6.5}
            fill="#ffffff"
            filter={`url(#${id}-glow)`}
          />
          <circle
            r="2.5"
            fill="#e0f7ff"
          />
        </g>
      </svg>

      {/* Optional Mini HUD Telemetry Tag */}
      {showTelemetry && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono tracking-widest uppercase text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-[#050508]/80 border border-cyan-500/30">
          {state}
        </div>
      )}
    </div>
  );
};
