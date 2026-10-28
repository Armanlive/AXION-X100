import React, { useState } from 'react';
import { Cpu, X } from 'lucide-react';
import { useAxionStore } from '../store/useAxionStore';

/** Providers that can actually answer chat (speech-only engines don't count). */
const SPEECH_ONLY = new Set(['fishaudio']);

/**
 * First thing a new user sees: AXION can't think, talk or code without an AI model,
 * so until one is connected it asks them to set up Cloud Brain. "Later" hides it for
 * this launch only; once any chat provider is saved it never shows again.
 */
export const CloudBrainWelcome: React.FC<{ checked: boolean }> = ({ checked }) => {
  const providers = useAxionStore((s) => s.cloudProviders);
  const setCurrentTab = useAxionStore((s) => s.setCurrentTab);
  const [dismissed, setDismissed] = useState(false);
  const hasBrain = providers.some((p) => p.configured && !SPEECH_ONLY.has(p.type));
  if (!checked || hasBrain || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="brain-welcome-title">
      <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/35 bg-[#070c18] p-6 shadow-[0_0_40px_rgba(0,240,255,0.18)] space-y-4">
        <button onClick={() => setDismissed(true)} aria-label="Close" className="absolute right-3 top-3 text-slate-400 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-[#00f0ff]" />
          </div>
          <h2 id="brain-welcome-title" className="text-lg font-semibold text-cyan-100">Connect a Cloud Brain</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">
          Welcome to AXION. To talk with you, understand your projects and write code, AXION needs an AI model.
          Connect one in about a minute. Google Gemini and Groq both offer free API keys.
        </p>
        <ul className="text-xs text-slate-400 space-y-1 list-disc pl-5">
          <li>Your key is stored encrypted on this device.</li>
          <li>Paid models are never used unless you allow them.</li>
          <li>Prefer fully local? Choose Ollama in Cloud Brain.</li>
        </ul>
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => { setCurrentTab('cloud_brain'); setDismissed(true); }}
            className="flex-1 rounded-lg bg-cyan-500/90 hover:bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#041018]"
          >
            Connect Cloud Brain
          </button>
          <button onClick={() => setDismissed(true)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900">
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
