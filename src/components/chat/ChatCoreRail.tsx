import React, { useEffect, useRef, useState } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { AxionLivingCore, type LivingCoreState } from '../voice/AxionLivingCore';

// Chat column (max-w-4xl, 896px) plus a 320px rail on each side.
const MIN_PANEL_WIDTH = 1120;

/**
 * Right-hand rail for wide screens: AXION's living core and its state (listening,
 * working, speaking). Internal routing details stay out of view; replies live in the
 * chat. Hidden where the chat column needs the room.
 */
export const ChatCoreRail: React.FC = () => {
  const probe = useRef<HTMLSpanElement | null>(null);
  const [roomy, setRoomy] = useState(false);
  // Measure the chat panel itself, not the window: Files/Terminal/Preview panes shrink it.
  useEffect(() => {
    const panel = probe.current?.parentElement;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setRoomy(entry.contentRect.width >= MIN_PANEL_WIDTH));
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);
  const { isWorking, speechState, activeWorkspace } = useAxionStore();
  const state: LivingCoreState =
    speechState === 'speaking' ? 'speaking' : isWorking ? 'thinking' : speechState === 'listening' ? 'listening' : 'idle';

  const label = { idle: 'Standing by', listening: 'Listening', thinking: 'Working on it', speaking: 'Speaking' }[state];

  if (!roomy) return <span ref={probe} hidden />;
  return (
    <aside
      ref={probe as unknown as React.Ref<HTMLElement>}
      aria-label="AXION activity"
      className="flex absolute right-3 top-24 bottom-28 w-60 flex-col items-center gap-4 pointer-events-none select-none z-10"
    >
      <AxionLivingCore state={state} size="lg" />
      <div className="text-center font-mono">
        <div className="text-[11px] font-bold tracking-widest text-[#00f0ff] uppercase">{label}</div>
        {activeWorkspace && <div className="text-[10px] text-cyan-400/60 truncate max-w-[16rem]">{activeWorkspace.name}</div>}
      </div>

    </aside>
  );
};
