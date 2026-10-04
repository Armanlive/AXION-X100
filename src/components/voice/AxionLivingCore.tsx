import React, { useMemo, useEffect, useRef } from 'react';

export type LivingCoreState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface AxionLivingCoreProps {
  state: LivingCoreState;
  audioLevel?: number; // Real 0.0 - 1.0 amplitude if available
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  isMuted?: boolean;
  onClick?: () => void;
  interactive?: boolean;
}

/**
 * AXION Living Core
 *
 * An abstract, organic computational energy nucleus animation using GPU-accelerated
 * CSS transforms. Incorporates four explicit states: IDLE, LISTENING, THINKING, SPEAKING.
 *
 * Visual Architecture:
 * - Center: Luminous hot energy singularity with multi-stop radial gradient mantle.
 * - Shells: Layered translucent energy shells with soft volumetric breathing glow.
 * - Orbital Rings: 3 asymmetric, non-coplanar tilted rings (-26°, 34°, 72°) with quantum nodes.
 * - Radial Lines: Subtle computational flux lines with dashed harmonic rhythms.
 * - Accent: Restrained warm amber/gold nodes against deep cool electric blue & cyan.
 * - Motion: 100% GPU-accelerated CSS transforms (scale, rotate, translate, opacity).
 */
export const AxionLivingCore: React.FC<AxionLivingCoreProps> = ({
  state = 'idle',
  audioLevel = 0,
  size = 'md',
  className = '',
  isMuted = false,
  onClick,
  interactive = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const smoothedAudioRef = useRef(0);

  // Smoothly damp real audio levels when supplied (prevents visual jitter)
  useEffect(() => {
    let frameId: number;
    const updateAudio = () => {
      const target = isMuted ? 0 : Math.max(0, Math.min(1, audioLevel));
      smoothedAudioRef.current += (target - smoothedAudioRef.current) * 0.25;

      if (containerRef.current) {
        containerRef.current.style.setProperty('--core-audio', smoothedAudioRef.current.toFixed(3));
      }
      frameId = requestAnimationFrame(updateAudio);
    };

    frameId = requestAnimationFrame(updateAudio);
    return () => cancelAnimationFrame(frameId);
  }, [audioLevel, isMuted]);

  // Scaled dimensions map
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm':
        return { box: 56, viewBox: 120 };
      case 'md':
        return { box: 140, viewBox: 260 };
      case 'lg':
        return { box: 220, viewBox: 320 };
      case 'hero':
      default:
        return { box: 270, viewBox: 360 };
    }
  }, [size]);

  // Dynamic visual configurations
  const stateMeta = useMemo(() => {
    switch (state) {
      case 'listening':
        return {
          label: 'Listening',
          statusColor: '#00e5ff',
          outerGlow: 'from-cyan-500/25 via-sky-600/10 to-transparent',
          amberAccent: '#f59e0b'
        };
      case 'thinking':
        return {
          label: 'Thinking',
          statusColor: '#38bdf8',
          outerGlow: 'from-sky-500/30 via-indigo-600/15 to-transparent',
          amberAccent: '#fbbf24'
        };
      case 'speaking':
        return {
          label: 'Speaking',
          statusColor: '#00f0ff',
          outerGlow: 'from-cyan-500/30 via-blue-600/15 to-transparent',
          amberAccent: '#f59e0b'
        };
      case 'idle':
      default:
        return {
          label: 'Idle',
          statusColor: '#38bdf8',
          outerGlow: 'from-sky-500/15 via-blue-900/5 to-transparent',
          amberAccent: '#d97706'
        };
    }
  }, [state]);

  const hasRealAudio = audioLevel > 0.02 && !isMuted;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`AXION Living Core: ${stateMeta.label}`}
      onClick={interactive ? onClick : undefined}
      style={
        {
          '--core-audio': '0',
          width: `${dimensions.box}px`,
          height: `${dimensions.box}px`
        } as React.CSSProperties
      }
      className={`relative flex items-center justify-center select-none shrink-0 axion-living-core core-state-${state} ${
        interactive ? 'cursor-pointer hover:opacity-95' : ''
      } ${className}`}
    >
      {/* 1. Volumetric Ambient Aura (Controlled soft radial backdrop, clamped to avoid page overflow) */}
      <div
        className={`absolute inset-[-10%] rounded-full bg-gradient-to-r ${stateMeta.outerGlow} blur-2xl pointer-events-none transition-opacity duration-700 opacity-70`}
        style={{
          transform: `scale(${1 + (hasRealAudio ? audioLevel * 0.18 : 0)})`,
          willChange: 'transform, opacity'
        }}
      />

      {/* 2. Vector Organic Core Architecture */}
      <svg
        viewBox={`0 0 ${dimensions.viewBox} ${dimensions.viewBox}`}
        className="w-full h-full relative z-10 overflow-visible drop-shadow-[0_0_24px_rgba(0,180,255,0.22)]"
        aria-hidden="true"
      >
        <defs>
          {/* Nucleus Core Linear & Radial Gradients */}
          <radialGradient id="axNucleusGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="25%" stopColor="#cffafe" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#00e5ff" stopOpacity="0.8" />
            <stop offset="85%" stopColor="#0284c7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="axRingGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="axRingGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#0369a1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.6" />
          </linearGradient>

          {/* Translucent Energy Shell Gradient */}
          <radialGradient id="axShellGrad" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.22" />
            <stop offset="65%" stopColor="#0369a1" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>

          {/* Ambient Glow Filter */}
          <filter id="axCoreGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          transform={`translate(${dimensions.viewBox / 2}, ${dimensions.viewBox / 2})`}
          className="core-root-group"
        >
          {/* Subtle Radial Energy Flux Lines (8 Hairline Rays with Inward Pulsing Flux) */}
          <g className="radial-energy-flux" opacity={state === 'thinking' ? 0.45 : 0.22}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <line
                key={i}
                x1={0}
                y1={0}
                x2={dimensions.viewBox * 0.44 * Math.cos((angle * Math.PI) / 180)}
                y2={dimensions.viewBox * 0.44 * Math.sin((angle * Math.PI) / 180)}
                stroke="#00e5ff"
                strokeWidth="0.6"
                strokeDasharray="2 8"
                className="flux-line"
              />
            ))}
          </g>

          {/* Computational Horizon Grids */}
          <g opacity={state === 'thinking' ? 0.35 : 0.18} className="horizon-grid">
            <circle
              r={dimensions.viewBox * 0.38}
              fill="none"
              stroke="#00e5ff"
              strokeWidth="0.75"
              strokeDasharray="2 8"
              className="ring-horizon-outer"
            />
            <circle
              r={dimensions.viewBox * 0.28}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.5"
              strokeDasharray="1 12"
              className="ring-horizon-inner"
            />
          </g>

          {/* Asymmetric Orbital Ring 3 (Deep computational horizon, tilted ~72deg) */}
          <g className="orbital-ring-3">
            <ellipse
              rx={dimensions.viewBox * 0.42}
              ry={dimensions.viewBox * 0.18}
              transform="rotate(72)"
              fill="none"
              stroke="url(#axRingGrad2)"
              strokeWidth="1"
              strokeDasharray="4 6 12 6"
              opacity="0.5"
            />
          </g>

          {/* Asymmetric Orbital Ring 2 (Counter-tilted ~34deg with restrained amber node) */}
          <g className="orbital-ring-2">
            <ellipse
              rx={dimensions.viewBox * 0.36}
              ry={dimensions.viewBox * 0.22}
              transform="rotate(34)"
              fill="none"
              stroke="url(#axRingGrad1)"
              strokeWidth="1.2"
              opacity="0.65"
            />
            {/* Restrained Amber/Gold Accent Quantum Node */}
            <circle
              cx={dimensions.viewBox * 0.34}
              cy="0"
              r="2.5"
              transform="rotate(34)"
              fill={stateMeta.amberAccent}
              className="drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]"
            />
          </g>

          {/* Asymmetric Orbital Ring 1 (Primary tilted ~-26deg with cyan quantum beads) */}
          <g className="orbital-ring-1">
            <ellipse
              rx={dimensions.viewBox * 0.32}
              ry={dimensions.viewBox * 0.16}
              transform="rotate(-26)"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="1.4"
              opacity={state === 'thinking' ? 0.9 : 0.75}
            />
            {/* Cyan Energy Quanta Beads */}
            <circle
              cx={-dimensions.viewBox * 0.31}
              cy="0"
              r="2.8"
              transform="rotate(-26)"
              fill="#cffafe"
              className="drop-shadow-[0_0_8px_rgba(0,229,255,0.9)]"
            />
            <circle
              cx={dimensions.viewBox * 0.22}
              cy={dimensions.viewBox * 0.11}
              r="2"
              transform="rotate(-26)"
              fill="#38bdf8"
              opacity="0.8"
            />
          </g>

          {/* Layered Translucent Energy Shells (Organic computational breathing layers) */}
          <g className="energy-shells">
            {/* Outer Mantle Shell */}
            <circle
              r={dimensions.viewBox * 0.22}
              fill="url(#axShellGrad)"
              filter="url(#axCoreGlow)"
              className="shell-outer"
            />

            {/* Middle Responsive Shell */}
            <circle
              r={dimensions.viewBox * 0.15}
              fill="url(#axShellGrad)"
              stroke="#00e5ff"
              strokeWidth="0.8"
              strokeOpacity="0.4"
              className="shell-inner"
            />
          </g>

          {/* Central Energy Nucleus (Pure Luminous Fused Hot-Point) */}
          <g className="nucleus-group">
            {/* Deep Volumetric Azure Corona */}
            <circle
              r={dimensions.viewBox * 0.11}
              fill="url(#axNucleusGrad)"
              filter="url(#axCoreGlow)"
            />

            {/* Bright Electric Blue Inner Core */}
            <circle
              r={dimensions.viewBox * 0.07}
              fill="#00e5ff"
              opacity="0.85"
              className="nucleus-inner drop-shadow-[0_0_12px_rgba(0,229,255,0.9)]"
            />

            {/* Pure Hot Center Singularity */}
            <circle
              r={dimensions.viewBox * 0.035}
              fill="#ffffff"
              opacity="0.95"
              className="drop-shadow-[0_0_8px_#ffffff]"
            />
          </g>
        </g>
      </svg>

      {/* GPU Keyframe CSS Styles strictly using CSS Transforms */}
      <style>{`
        /* Base Transform Origins */
        .core-root-group,
        .orbital-ring-1,
        .orbital-ring-2,
        .orbital-ring-3,
        .energy-shells,
        .shell-outer,
        .shell-inner,
        .nucleus-group,
        .ring-horizon-outer,
        .ring-horizon-inner {
          transform-origin: center;
          will-change: transform, opacity;
        }

        /* --------------------------------------------------
           STATE: IDLE (Slow breathing, subtle heartbeat, slow orbits)
           -------------------------------------------------- */
        .core-state-idle .orbital-ring-1 {
          animation: axSpin 32s linear infinite;
        }
        .core-state-idle .orbital-ring-2 {
          animation: axSpinReverse 46s linear infinite;
        }
        .core-state-idle .orbital-ring-3 {
          animation: axSpin 64s linear infinite;
        }
        .core-state-idle .nucleus-group {
          animation: axHeartbeat 4.5s ease-in-out infinite;
        }
        .core-state-idle .shell-outer {
          animation: axBreathe 4.5s ease-in-out infinite;
        }
        .core-state-idle .shell-inner {
          animation: axBreathe 3.8s ease-in-out infinite reverse;
        }
        .core-state-idle .ring-horizon-outer {
          animation: axSpin 70s linear infinite;
        }
        .core-state-idle .ring-horizon-inner {
          animation: axSpinReverse 55s linear infinite;
        }

        /* --------------------------------------------------
           STATE: LISTENING (Heightened radiance, responsive rings)
           -------------------------------------------------- */
        .core-state-listening .orbital-ring-1 {
          animation: axSpin 16s linear infinite;
        }
        .core-state-listening .orbital-ring-2 {
          animation: axSpinReverse 22s linear infinite;
        }
        .core-state-listening .orbital-ring-3 {
          animation: axSpin 32s linear infinite;
        }
        .core-state-listening .nucleus-group {
          animation: axListeningPulse 2.4s ease-in-out infinite;
          transform: scale(calc(1.04 + var(--core-audio, 0) * 0.4));
        }
        .core-state-listening .shell-outer {
          animation: axBreathe 2.4s ease-in-out infinite;
          transform: scale(calc(1.02 + var(--core-audio, 0) * 0.25));
        }
        .core-state-listening .shell-inner {
          animation: axBreathe 2.0s ease-in-out infinite reverse;
          transform: scale(calc(1.03 + var(--core-audio, 0) * 0.3));
        }

        /* --------------------------------------------------
           STATE: THINKING (Controlled acceleration, inward energy flux)
           -------------------------------------------------- */
        .core-state-thinking .orbital-ring-1 {
          animation: axSpin 5.5s linear infinite;
        }
        .core-state-thinking .orbital-ring-2 {
          animation: axSpinReverse 7.5s linear infinite;
        }
        .core-state-thinking .orbital-ring-3 {
          animation: axSpin 11s linear infinite;
        }
        .core-state-thinking .nucleus-group {
          animation: axThinkingPulse 1.4s ease-in-out infinite;
        }
        .core-state-thinking .shell-outer {
          animation: axInwardFlux 2.2s ease-in-out infinite;
        }
        .core-state-thinking .shell-inner {
          animation: axInwardFlux 1.8s ease-in-out infinite reverse;
        }
        .core-state-thinking .radial-energy-flux {
          animation: axFluxPulse 1.5s ease-in-out infinite;
        }

        /* --------------------------------------------------
           STATE: SPEAKING (Rhythmic vocal resonance)
           -------------------------------------------------- */
        .core-state-speaking .orbital-ring-1 {
          animation: axSpin 11s linear infinite;
        }
        .core-state-speaking .orbital-ring-2 {
          animation: axSpinReverse 16s linear infinite;
        }
        .core-state-speaking .orbital-ring-3 {
          animation: axSpin 24s linear infinite;
        }
        .core-state-speaking .nucleus-group {
          animation: axSpeakingRhythm 2.0s ease-in-out infinite;
          transform: scale(calc(1.05 + var(--core-audio, 0) * 0.5));
        }
        .core-state-speaking .shell-outer {
          animation: axBreathe 2.0s ease-in-out infinite;
          transform: scale(calc(1.03 + var(--core-audio, 0) * 0.3));
        }
        .core-state-speaking .shell-inner {
          animation: axBreathe 1.8s ease-in-out infinite reverse;
          transform: scale(calc(1.04 + var(--core-audio, 0) * 0.35));
        }

        /* --------------------------------------------------
           GPU Keyframe Transformations
           -------------------------------------------------- */
        @keyframes axSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes axSpinReverse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }

        @keyframes axHeartbeat {
          0%, 100% { transform: scale(0.97); opacity: 0.92; }
          45% { transform: scale(1.03); opacity: 1; }
          55% { transform: scale(0.99); opacity: 0.95; }
          65% { transform: scale(1.02); opacity: 0.98; }
        }

        @keyframes axBreathe {
          0%, 100% { transform: scale(0.95); opacity: 0.75; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        @keyframes axListeningPulse {
          0%, 100% { transform: scale(1.0); opacity: 0.95; }
          50% { transform: scale(1.07); opacity: 1; }
        }

        @keyframes axThinkingPulse {
          0%, 100% { transform: scale(0.94); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        @keyframes axInwardFlux {
          0% { transform: scale(1.1); opacity: 0.7; }
          50% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0.7; }
        }

        @keyframes axFluxPulse {
          0%, 100% { opacity: 0.2; transform: scale(0.98); }
          50% { opacity: 0.55; transform: scale(1.04); }
        }

        @keyframes axSpeakingRhythm {
          0%, 100% { transform: scale(0.96); opacity: 0.92; }
          25% { transform: scale(1.08); opacity: 1; }
          50% { transform: scale(1.01); opacity: 0.96; }
          75% { transform: scale(1.07); opacity: 1; }
        }

        /* Accessibility: Prefers Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .axion-living-core *,
          .core-root-group *,
          .orbital-ring-1,
          .orbital-ring-2,
          .orbital-ring-3,
          .nucleus-group,
          .shell-outer,
          .shell-inner,
          .ring-horizon-outer,
          .ring-horizon-inner,
          .radial-energy-flux {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};
