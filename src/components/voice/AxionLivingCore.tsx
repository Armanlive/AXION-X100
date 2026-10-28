import React, { useId } from 'react';
import './AxionLivingCore.css';

export type LivingCoreState = 'idle' | 'listening' | 'thinking' | 'speaking';
export interface AxionLivingCoreProps {
  state: LivingCoreState;
  /** Normalized real microphone or streamed-output level. Device TTS remains state-only. */
  audioLevel?: number;
  size?: 'sm' | 'md' | 'lg' | 'welcome' | 'hero';
  className?: string;
  isMuted?: boolean;
  onClick?: () => void;
  interactive?: boolean;
}

// Deterministic quantum geometry
const dust = Array.from({ length: 48 }, (_, i) => {
  const angle = i * 2.39996;
  const radius = 135 + (i * 23 % 75);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r: i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.1 : .6 };
});

const filaments = Array.from({ length: 18 }, (_, i) => {
  const points = Array.from({ length: 97 }, (_, j) => {
    const a = j / 96 * Math.PI * 2;
    const r = 118 + Math.sin(a * 5 + i * .7) * (6 + i % 4) + Math.cos(a * 9 - i) * 2.5;
    return `${j ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r * (.88 + i % 4 * .035)).toFixed(2)}`;
  });
  return points.join(' ') + 'Z';
});

// Telemetry caliper ticks (36 ticks at 10-degree increments)
const caliperTicks = Array.from({ length: 36 }, (_, i) => {
  const deg = i * 10;
  const isMajor = i % 9 === 0;
  const isMid = i % 3 === 0 && !isMajor;
  const r1 = 208;
  const r2 = isMajor ? 222 : isMid ? 216 : 212;
  const rad = (deg * Math.PI) / 180;
  return {
    x1: (Math.cos(rad) * r1).toFixed(2),
    y1: (Math.sin(rad) * r1).toFixed(2),
    x2: (Math.cos(rad) * r2).toFixed(2),
    y2: (Math.sin(rad) * r2).toFixed(2),
    isMajor,
    isMid,
  };
});

/** Modern Quantum Holographic Living Core: Desktop and Mobile Voice */
export const AxionLivingCore: React.FC<AxionLivingCoreProps> = ({
  state = 'idle', audioLevel = 0, size = 'md', className = '', isMuted = false, onClick, interactive = false
}) => {
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;
  const level = (state === 'speaking' || (state === 'listening' && !isMuted)) && Number.isFinite(audioLevel)
    ? Math.min(1, Math.max(0, audioLevel)) : 0;
  const label = `AXION Quantum Core: ${state.charAt(0).toUpperCase() + state.slice(1)}`;

  return (
    <div
      className={`axion-living-core ax-core-${size} core-state-${state} ${className}`}
      role={interactive ? 'button' : 'img'}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(); }
      } : undefined}
    >
      <svg viewBox="-230 -230 460 460" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-atmosphere`}>
            <stop offset=".2" stopColor="var(--ax-blue)" stopOpacity=".22" />
            <stop offset=".55" stopColor="var(--ax-cyan)" stopOpacity=".1" />
            <stop offset="1" stopColor="var(--ax-blue)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-warmAtmosphere`}>
            <stop stopColor="var(--ax-amber)" stopOpacity=".28" />
            <stop offset=".45" stopColor="var(--ax-amber)" stopOpacity=".09" />
            <stop offset="1" stopColor="var(--ax-amber)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-sphere`} cx="35%" cy="28%" r="74%">
            <stop stopColor="var(--ax-cyan)" stopOpacity=".65" />
            <stop offset=".22" stopColor="#04162e" />
            <stop offset=".52" stopColor="#020814" />
            <stop offset=".8" stopColor="#041428" />
            <stop offset=".94" stopColor="var(--ax-blue)" stopOpacity=".8" />
            <stop offset="1" stopColor="var(--ax-cyan)" stopOpacity=".95" />
          </radialGradient>
          <radialGradient id={`${id}-chamber`}>
            <stop stopColor="#020712" />
            <stop offset=".6" stopColor="#020a1a" stopOpacity=".96" />
            <stop offset=".86" stopColor="var(--ax-blue)" stopOpacity=".15" />
            <stop offset="1" stopColor="var(--ax-cyan)" stopOpacity=".3" />
          </radialGradient>
          <radialGradient id={`${id}-singularity`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="25%" stopColor="var(--ax-cyan)" stopOpacity=".9" />
            <stop offset="60%" stopColor="var(--ax-blue)" stopOpacity=".5" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-stream`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--ax-cyan)" stopOpacity="0" />
            <stop offset=".25" stopColor="var(--ax-blue)" />
            <stop offset=".5" stopColor="#ffffff" />
            <stop offset=".75" stopColor="var(--ax-cyan)" />
            <stop offset="1" stopColor="var(--ax-blue)" stopOpacity=".1" />
          </linearGradient>
          <linearGradient id={`${id}-warm`} x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="var(--ax-amber)" stopOpacity=".08" />
            <stop offset=".35" stopColor="var(--ax-amber)" />
            <stop offset=".65" stopColor="#ffffff" />
            <stop offset="1" stopColor="var(--ax-amber)" stopOpacity=".2" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id={`${id}-mesh`} width="10" height="9" patternUnits="userSpaceOnUse">
            <path d="M0 9L5 0L10 9M0 9H10" fill="none" stroke="var(--ax-cyan)" strokeWidth=".35" opacity=".45" />
            <circle cx="5" cy="0" r=".7" fill="var(--ax-cyan)" />
          </pattern>
          <radialGradient id={`${id}-meshFade`}>
            <stop offset=".35" stopColor="white" stopOpacity="0" />
            <stop offset=".85" stopColor="white" stopOpacity=".85" />
            <stop offset="1" stopColor="white" stopOpacity=".1" />
          </radialGradient>
          <radialGradient id={`${id}-frontFade`}>
            <stop offset="0" stopColor="black" />
            <stop offset=".65" stopColor="black" />
            <stop offset="1" stopColor="white" />
          </radialGradient>
          <mask id={`${id}-frontMask`}>
            <rect x="-230" y="-230" width="460" height="460" fill="white" />
            <circle r="95" fill={ref('frontFade')} />
          </mask>
          <mask id={`${id}-meshMask`}>
            <circle r="120" fill={ref('meshFade')} />
          </mask>
        </defs>

        {/* Outer Radiant Ambient Aura */}
        <g className="ax-horizon" fill="none">
          <ellipse cy="189" rx="148" ry="16" stroke={ref('stream')} strokeWidth=".7" opacity=".45" />
          <ellipse cy="189" rx="106" ry="7" stroke={ref('warm')} strokeWidth="1" opacity=".65" />
          <path d="M-170 189H-125M125 189H170" stroke="var(--ax-cyan)" opacity=".3" />
        </g>
        <circle r="228" fill={ref('atmosphere')} className="ax-atmosphere" />
        <g className="ax-corona" aria-hidden="true">
          <ellipse cx="-72" cy="-36" rx="145" ry="165" fill={ref('atmosphere')} />
          <g className="ax-warm"><ellipse cx="92" cy="30" rx="125" ry="150" fill={ref('warmAtmosphere')} /></g>
        </g>

        {/* Outer Precision Telemetry Calipers */}
        <g className="ax-calipers" stroke="var(--ax-cyan)" strokeLinecap="round" opacity=".5">
          <circle r="218" fill="none" stroke="var(--ax-cyan)" strokeWidth=".6" strokeDasharray="3 9 1 9" opacity=".4" />
          <circle r="206" fill="none" stroke="var(--ax-blue)" strokeWidth=".5" opacity=".25" />
          {caliperTicks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              strokeWidth={t.isMajor ? 1.6 : t.isMid ? 1.0 : 0.5}
              opacity={t.isMajor ? 0.9 : t.isMid ? 0.6 : 0.3}
            />
          ))}
        </g>

        {/* Counter-Rotating Gyro & Stream Bands */}
        <g fill="none" className="ax-back-field">
          <circle r="188" stroke="var(--ax-blue)" strokeWidth=".8" strokeDasharray="2 10 4 14" opacity=".6" />
          <circle r="172" stroke="var(--ax-cyan)" strokeWidth=".75" strokeDasharray="110 30 12 45 160 120" opacity=".65" />
          <ellipse rx="212" ry="70" transform="rotate(-17)" stroke={ref('stream')} strokeWidth="1.3" />
          <ellipse rx="192" ry="76" transform="rotate(49)" stroke={ref('stream')} strokeWidth="2.2" />
          <g className="ax-warm">
            <ellipse rx="210" ry="80" transform="rotate(21)" stroke={ref('warm')} strokeWidth="2.2" />
            <circle r="198" stroke={ref('warm')} strokeWidth="1" strokeDasharray="80 90 3 8" />
          </g>
        </g>

        {/* Quantum Dust Constellation */}
        <g className="ax-dust" fill="var(--ax-cyan)">
          {dust.map((p, i) => (
            <circle
              key={i}
              className={i % 4 === 0 ? 'ax-spark' : undefined}
              style={{ animationDelay: `${-i * .33}s` }}
              cx={p.x}
              cy={p.y}
              r={p.r}
              opacity={.28 + (i % 4) * .18}
            />
          ))}
        </g>

        {/* Main Quantum Containment Core */}
        <g className="ax-input-response" style={{ transform: `scale(${1 + level * .04})` }}>
          <g className="ax-shell">
            <circle r="124" fill={ref('sphere')} stroke="var(--ax-cyan)" strokeWidth="1" filter={ref('glow')} />
            <circle r="121" fill={ref('mesh')} mask={ref('meshMask')} />
            <ellipse rx="105" ry="122" transform="rotate(-26)" fill="none" stroke="var(--ax-cyan)" strokeWidth=".7" opacity=".35" />
            <ellipse rx="76" ry="121" transform="rotate(34)" fill="none" stroke="var(--ax-blue)" strokeWidth=".8" opacity=".5" />
            
            {/* Plasma Filaments */}
            <g className="ax-filaments" fill="none" filter={ref('glow')}>
              {filaments.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  className={i % 4 === 0 ? 'ax-warm' : undefined}
                  stroke={ref(i % 4 === 0 ? 'warm' : 'stream')}
                  strokeWidth={i % 5 === 0 ? 1.4 : .65}
                  opacity={i % 3 === 0 ? .85 : .45}
                  transform={`rotate(${i * 19})`}
                />
              ))}
            </g>

            <g className="ax-warm" fill="none" filter={ref('glow')}>
              <path d="M-83 91C-144 31-102-98-23-119C54-139 137-54 116 31" stroke={ref('warm')} strokeWidth="3.2" />
              <path d="M-96 74C-17 153 101 116 120 15" stroke={ref('warm')} strokeWidth="1.8" />
            </g>

            {/* Inner Singularity Chamber */}
            <circle r="78" fill={ref('chamber')} stroke="var(--ax-cyan)" strokeWidth=".6" opacity=".9" />
            {/* Optical iris: broken crystal facets, with a clear dark central cavity. */}
            <g className="ax-iris" fill="none" stroke={ref('stream')}>
              {[0,60,120,180,240,300].map((angle) => (
                <path key={angle} transform={`rotate(${angle})`} d="M-29-69L23-74L49-47L39-38L19-61Z" fill="var(--ax-blue)" fillOpacity=".09" strokeWidth=".7" />
              ))}
              <circle r="61" strokeWidth="1.2" strokeDasharray="58 30 4 30" />
            </g>
            <g className="ax-lensing" fill="none" stroke={ref('warm')} strokeWidth="1.3">
              <ellipse rx="95" ry="29" transform="rotate(-30)" opacity=".65" />
              <path d="M-68 42Q0 83 74 24" strokeWidth="2" />
            </g>
            <g fill="none" filter={ref('glow')} stroke="var(--ax-cyan)" strokeLinecap="round">
              <path d="M-112-37C-97-88-74-102-41-112M47 107C82 94 107 67 116 32" strokeWidth="2.8" />
              <path d="M-119 10C-120-12-117-25-111-39M80-84L92-75" strokeWidth="1.2" />
            </g>

            {/* Quantum Singularity Nucleus */}
            <g className="ax-nucleus" filter={ref('glow')}>
              <circle r="42" fill={ref('singularity')} opacity={.3 + level * .3} />
              <circle r="14" fill="var(--ax-blue)" opacity=".2" />
              <circle r="6" fill="var(--ax-cyan)" opacity=".7" />
              <circle r="2.8" fill="#ffffff" />
            </g>
          </g>
        </g>

        {size === 'welcome' && (
          <text x="0" y="7" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700" letterSpacing="4" className="ax-wordmark">
            AXION
          </text>
        )}

        {/* Luminous Foreground Energy Streams */}
        <g fill="none" filter={ref('glow')} className="ax-front-streams" mask={ref('frontMask')}>
          <path d="M-143-120C-196-185-72-135 56 9S172 161 137 98" stroke={ref('stream')} strokeWidth="3.2" />
          <path d="M-149-115C-183-159-52-109 66 22S170 148 151 108" stroke={ref('stream')} strokeWidth="1" />
          <path d="M-196 43C-215 107-50 83 76 15S206-72 158-80" stroke={ref('stream')} strokeWidth="1.4" />
          <g className="ax-warm">
            <path d="M-197-39C-158-113 7-45 138 40S174 112 94 78" stroke={ref('warm')} strokeWidth="3.2" />
            <path d="M-200-29C-129-93 23-32 140 48S179 108 122 91" stroke={ref('warm')} strokeWidth="1" />
          </g>
        </g>

        {/* Kinetic Current Highlight Pulses */}
        <g className="ax-current-field" fill="none" strokeLinecap="round" filter={ref('glow')} mask={ref('frontMask')}>
          <path className="ax-current" pathLength="100" strokeDasharray="4 96" d="M-143-120C-196-185-72-135 56 9S172 161 137 98" stroke="#ffffff" strokeWidth="3.4" />
          <path className="ax-current ax-current-reverse" pathLength="100" strokeDasharray="3 97" d="M-196 43C-215 107-50 83 76 15S206-72 158-80" stroke="var(--ax-cyan)" strokeWidth="2.6" />
          <g className="ax-warm">
            <path className="ax-current ax-current-warm" pathLength="100" strokeDasharray="5 95" d="M-197-39C-158-113 7-45 138 40S174 112 94 78" stroke="#fff4db" strokeWidth="3.2" />
          </g>
        </g>

        {/* Tactical Coordinates & Node Calipers */}
        <g className="ax-nodes" fill="var(--ax-cyan)" filter={ref('glow')}>
          <circle cx="-166" cy="-60" r="3" />
          <circle cx="149" cy="102" r="2.5" />
          <path d="M100-160l9 15-15-3Z M-153 101l-11 13 18 3Z M169-33l13 9-4-19Z" fill="none" stroke="var(--ax-cyan)" strokeWidth="1" />
          <g className="ax-warm" fill="var(--ax-amber)">
            <circle cx="-183" cy="-39" r="3.2" />
            <path d="M134-123l8-12 5 16Z M-125 134l-6 13 17-4Z" />
          </g>
        </g>

        {/* Dynamic Harmonic Acoustic Waveforms */}
        <g className="ax-wave-response" style={{ transform: `scale(${1 + level * .15})`, opacity: .75 + level * .25 }}>
          {[0, 90, 180, 270].map((angle, side) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <g className={`ax-waves ${side % 2 ? 'ax-warm' : ''}`} stroke={side % 2 ? 'var(--ax-amber)' : 'var(--ax-cyan)'} strokeLinecap="round" filter={ref('glow')}>
                {Array.from({ length: 15 }, (_, i) => {
                  const height = 10 + (7 - Math.abs(i - 7)) * 8 + (i % 3) * 4;
                  return (
                    <path
                      key={i}
                      className="ax-wave-strand"
                      style={{ animationDelay: `${-(i * .17 + side * .41)}s` }}
                      d={`M${(i - 7) * 4.2} -136v-${height}`}
                      strokeWidth={i === 7 ? 2.0 : 0.9}
                    />
                  );
                })}
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

