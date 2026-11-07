import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Cpu, Sparkles, Check } from 'lucide-react';
import { useAxionStore } from '../store/useAxionStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useProfileStore } from '../store/useProfileStore';

/** Providers that can actually answer chat (speech-only engines don't count). */
const SPEECH_ONLY = new Set(['fishaudio']);

const card = 'rounded-2xl border border-cyan-500/35 bg-[#070c18] p-5 shadow-[0_0_40px_rgba(0,240,255,0.18)] space-y-3 text-sm text-slate-300';
const primary = 'rounded-lg bg-cyan-500/90 hover:bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#041018]';
const ghost = 'rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900';

/** Where an element marked data-tour="<id>" is on screen, tracked while the tour shows it. */
function useTarget(id: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!id) { setRect(null); return; }
    const measure = () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)).find((e) => e.offsetParent !== null);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const timer = setInterval(measure, 500);
    window.addEventListener('resize', measure);
    return () => { clearInterval(timer); window.removeEventListener('resize', measure); };
  }, [id]);
  return rect;
}

const Steps: React.FC<{ step: number }> = ({ step }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-400/80">
    {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-6 rounded-full ${n <= step ? 'bg-cyan-400' : 'bg-slate-700'}`} />)}
    <span className="ml-1">Step {step} of 3</span>
  </div>
);

/**
 * First run: a three-step tour to Cloud Brain until a brain is connected, then an
 * invitation to "Meet AXION". Every step can be skipped; both are remembered.
 */
export const FirstRunTour: React.FC<{ checked: boolean }> = ({ checked }) => {
  const providers = useAxionStore((s) => s.cloudProviders);
  const currentTab = useAxionStore((s) => s.currentTab);
  const setCurrentTab = useAxionStore((s) => s.setCurrentTab);
  const { tour, tourStep, meet, meetOpen, nextTourStep, finishTour, openMeet, closeMeet } = useOnboardingStore();
  const profileSaved = useProfileStore((s) => s.saved);
  const hasBrain = providers.some((p) => p.configured && !SPEECH_ONLY.has(p.type));
  const [firstCheck, setFirstCheck] = useState(true);

  // Someone who already has a brain on first launch of this version needs no tour.
  useEffect(() => {
    if (!checked || !firstCheck) return;
    setFirstCheck(false);
    if (hasBrain && tour !== 'done') finishTour();
  }, [checked, firstCheck, hasBrain, tour, finishTour]);
  // Opening Cloud Brain (from the tour or by hand) moves the tour on to the provider step.
  useEffect(() => { if (tour !== 'done' && tourStep < 2 && (currentTab === 'cloud_brain' || currentTab === 'router')) useOnboardingStore.setState({ tourStep: 2 }); }, [currentTab, tour, tourStep]);

  const touring = checked && tour !== 'done' && !hasBrain;
  const target = useTarget(touring && tourStep === 1 ? 'cloud-brain' : null);
  if (!checked || meetOpen) return null;

  if (hasBrain) {
    if (meet || profileSaved) return null;
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="meet-invite-title">
        <div className={`${card} w-full max-w-md`}>
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono"><Check className="w-4 h-4" /> Brain connected</div>
          <h2 id="meet-invite-title" className="text-lg font-semibold text-cyan-100 flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#00f0ff]" /> AXION is ready to meet you</h2>
          <p>AXION will introduce itself, ask which language you prefer, and get to know you by voice. Speaking is easier than typing, and you can type whenever you like.</p>
          <div className="flex gap-3 pt-1">
            <button autoFocus onClick={() => { finishTour(); openMeet(); }} className={`flex-1 ${primary}`}>Meet AXION</button>
            <button onClick={() => { finishTour(); closeMeet('later'); }} className={ghost}>Not now</button>
          </div>
        </div>
      </div>
    );
  }
  if (!touring) return null;

  const skip = <button onClick={finishTour} className="text-xs text-slate-400 underline hover:text-slate-200">Skip tour</button>;

  if (tourStep === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className={`${card} w-full max-w-md`}>
          <Steps step={1} />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center"><Cpu className="w-5 h-5 text-[#00f0ff]" /></div>
            <h2 id="tour-title" className="text-lg font-semibold text-cyan-100">Welcome to AXION</h2>
          </div>
          <p>To think, talk and code, AXION needs a brain: an AI model. Let's connect one together. It takes about a minute, and Google Gemini and Groq both offer free keys.</p>
          <ul className="text-xs text-slate-400 space-y-1 list-disc pl-5">
            <li>Keys are stored encrypted on this device.</li>
            <li>Paid models are never used unless you allow them.</li>
            <li>Prefer fully local? Choose Ollama.</li>
          </ul>
          <div className="flex items-center gap-3 pt-1">
            <button autoFocus onClick={nextTourStep} className={`flex-1 ${primary}`}>Start</button>
            {skip}
          </div>
        </div>
      </div>
    );
  }

  if (tourStep === 1) {
    const open = () => { setCurrentTab('cloud_brain'); useOnboardingStore.setState({ tourStep: 2 }); };
    const pad = 6;
    const tipTop = target ? Math.min(window.innerHeight - 200, Math.max(16, target.top - 10)) : undefined;
    const tipLeft = target ? Math.min(window.innerWidth - 336, target.right + 18) : undefined;
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none" role="dialog" aria-modal="false" aria-labelledby="tour-step2">
        {target && (() => {
          const box = { top: target.top - pad, left: target.left - pad, width: target.width + pad * 2, height: target.height + pad * 2 };
          return <>
            {/* Steady dim around the target; only the ring pulses. */}
            <div className="absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]" style={box} />
            <div className="absolute rounded-xl ring-2 ring-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.6)] animate-pulse" style={box} />
          </>;
        })()}
        <div className={`${card} absolute w-80 pointer-events-auto ${target ? '' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'}`} style={target ? { top: tipTop, left: tipLeft } : undefined}>
          <Steps step={2} />
          <h2 id="tour-step2" className="font-semibold text-cyan-100">Open Cloud Brain</h2>
          <p>{target ? 'This is where AXION\'s brain lives. Click the highlighted Cloud Brain button.' : 'Cloud Brain is where AXION\'s brain lives.'}</p>
          <div className="flex items-center gap-3"><button onClick={open} className={primary}>Open Cloud Brain</button>{skip}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 max-w-[calc(100%-2rem)]" role="dialog" aria-modal="false" aria-labelledby="tour-step3">
      <div className={card}>
        <Steps step={3} />
        <h2 id="tour-step3" className="font-semibold text-cyan-100">Connect a provider</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Pick a provider. <b>Google Gemini</b> is free: get a key at aistudio.google.com.</li>
          <li>Paste the key and save it.</li>
          <li>Add as many providers as you like. AXION switches between them automatically.</li>
        </ol>
        <p className="text-xs text-slate-400">Keys are saved in the AXION desktop app's encrypted vault, so connect providers there (a plain web browser cannot store them safely). AXION will greet you as soon as one is connected.</p>
        <div className="flex items-center gap-3">
          {currentTab !== 'cloud_brain' && currentTab !== 'router' && <button onClick={() => setCurrentTab('cloud_brain')} className={primary}>Back to Cloud Brain</button>}
          {skip}
        </div>
      </div>
    </div>
  );
};
