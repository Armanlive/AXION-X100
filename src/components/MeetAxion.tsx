import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, X, SkipForward } from 'lucide-react';
import { AxionLivingCore, type LivingCoreState } from './voice/AxionLivingCore';
import { useAxionStore } from '../store/useAxionStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useProfileStore } from '../store/useProfileStore';
import { globalVoiceEngine } from '../utils/voiceEngine';
import { answerMeet, builtInQuestions, describePreference, startMeet, translateQuestions, type MeetQuestions, type MeetState } from '../utils/meetAxionFlow';
import { preferenceLocale, saveLanguagePreference, voiceSettingFor } from '../utils/languagePreference';
import { saveAlertSettings } from '../services/proactiveAlerts';
import { buildModelPool, getFallbackChain, loadPaidPoolConsent } from '../utils/providerRouting';
import { requestProvider } from '../services/providerService';

/** One short request to the connected brain (used to translate the questions). */
async function askBrainOnce(prompt: string): Promise<string> {
  const s = useAxionStore.getState();
  const pool = buildModelPool(s.models, s.cloudProviders, loadPaidPoolConsent());
  const chain = getFallbackChain(pool.find((m) => m.id === s.activeModelId), pool, s.cloudProviders).slice(0, 3);
  let last: unknown = new Error('No AI model is connected.');
  for (const c of chain) {
    try { return await requestProvider(c.provider.type, c.modelId, 'You are a careful translator. Output only what is asked.', [{ role: 'user', parts: [{ text: prompt }] }], 30); }
    catch (e) { last = e; }
  }
  throw last;
}

const STAGE_LABEL: Record<MeetState['stage'], string> = {
  language: 'Language', hindiScript: 'Hindi style', name: 'Your name', role: 'Your work', projects: 'Current work', help: 'Where to help', style: 'Reply style', done: 'Done',
};

/** The spoken first conversation, shown once a brain is connected and the user taps "Meet AXION". */
export const MeetAxion: React.FC = () => {
  const open = useOnboardingStore((s) => s.meetOpen);
  return open ? <MeetAxionSession /> : null;
};

const MeetAxionSession: React.FC = () => {
  const closeMeet = useOnboardingStore((s) => s.closeMeet);
  const updateVoiceSettings = useAxionStore((s) => s.updateVoiceSettings);
  const [line, setLine] = useState('');
  const [stage, setStage] = useState<MeetState['stage']>('language');
  const [core, setCore] = useState<LivingCoreState>('idle');
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  // A ref, not state: listen() runs from callbacks created in earlier renders.
  const voiceIn = useRef(true);
  const state = useRef<MeetState>(startMeet().state);
  const questions = useRef<MeetQuestions | undefined>(undefined);
  const rec = useRef<any>(null);
  const alive = useRef(true);
  const busy = useRef(false);

  const stopListening = () => { try { rec.current?.abort(); } catch { /* already stopped */ } rec.current = null; };

  const finish = () => {
    const s = state.current;
    if (s.name) saveAlertSettings({ title: s.name });
    useProfileStore.getState().applyInterview({ name: s.name, ...s.answers });
    closeMeet('done');
  };

  const listen = () => {
    if (!alive.current || !voiceIn.current) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { voiceIn.current = false; setNote('Voice input is not available here. Please type your answer below.'); return; }
    stopListening();
    const r = new Recognition();
    rec.current = r;
    r.lang = state.current.pref ? preferenceLocale(state.current.pref) : 'en-IN';
    r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onresult = (event: any) => {
      let text = '', final = false;
      for (let i = event.resultIndex; i < event.results.length; i++) { text += event.results[i][0].transcript; final ||= event.results[i].isFinal; }
      setHeard(text.trim());
      if (final && text.trim()) { stopListening(); void handle(text.trim()); }
    };
    r.onerror = (event: any) => {
      if (event.error === 'aborted') return;
      setNote(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone permission was denied. You can type your answers below, or allow the microphone and tap the mic.'
        : event.error === 'no-speech' ? 'I did not hear anything. Tap the mic and speak, or type below.' : `Voice input stopped (${event.error}). Tap the mic to try again, or type below.`);
    };
    r.onend = () => { if (rec.current === r) rec.current = null; setCore((c) => (c === 'listening' ? 'idle' : c)); };
    try { r.start(); setCore('listening'); setNote(''); } catch { setNote('Could not start the microphone. Type your answer below.'); }
  };

  const say = (text: string, then: () => void) => {
    setLine(text); setHeard(''); setCore('speaking');
    void globalVoiceEngine.speak(text, () => { if (!alive.current) return; setCore('idle'); then(); }, false);
  };

  const handle = async (text: string) => {
    if (busy.current || !text.trim()) return;
    busy.current = true;
    try {
      setHeard(text);
      const result = answerMeet(state.current, text, questions.current);
      state.current = result.state;
      setStage(result.state.stage);
      if (result.needsQuestions && result.state.pref) {
        const pref = result.state.pref;
        saveLanguagePreference(pref);
        updateVoiceSettings({ language: voiceSettingFor(pref) });
        setCore('thinking'); setLine(`Setting up ${describePreference(pref)}…`);
        questions.current = builtInQuestions(pref) ?? await translateQuestions(pref, askBrainOnce);
        if (!alive.current) return;
        say(questions.current.name, listen);
        return;
      }
      if (result.state.stage === 'done') { say(result.say, finish); return; }
      if (result.say) say(result.say, listen);
    } finally { busy.current = false; }
  };

  useEffect(() => {
    alive.current = true;
    const t = setTimeout(() => say(startMeet().say, listen), 400);
    return () => { alive.current = false; clearTimeout(t); stopListening(); globalVoiceEngine.interrupt(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitTyped = (e: React.FormEvent) => { e.preventDefault(); const t = typed.trim(); if (!t) return; setTyped(''); stopListening(); void handle(t); };
  const profileStage = ['role', 'projects', 'help', 'style'].includes(stage);
  const position = ['language', 'hindiScript', 'name', 'role', 'projects', 'help', 'style', 'done'].indexOf(stage);

  return (
    <div className="fixed inset-0 z-[70] bg-[#03050b]/95 backdrop-blur flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="meet-axion-title">
      <button onClick={() => closeMeet('later')} aria-label="Close Meet AXION" className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
      <div className="w-full max-w-xl flex flex-col items-center text-center gap-5">
        <h2 id="meet-axion-title" className="sr-only">Meet AXION</h2>
        <AxionLivingCore state={core} size="lg" interactive={false} />
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-cyan-400/80">
          <span>{STAGE_LABEL[stage]}</span>
          <span className="flex gap-1">{Array.from({ length: 7 }, (_, i) => <span key={i} className={`h-1 w-4 rounded-full ${i < position ? 'bg-cyan-400' : i === position ? 'bg-cyan-300 animate-pulse' : 'bg-slate-700'}`} />)}</span>
        </div>
        <p className="text-lg leading-relaxed text-cyan-50 min-h-[3.5rem]" aria-live="polite">{line}</p>
        <p className="text-sm text-slate-400 min-h-[1.25rem]">{heard ? `You: “${heard}”` : core === 'listening' ? 'Listening…' : ''}</p>
        {note && <p className="text-xs text-amber-300" role="status">{note}</p>}
        <form onSubmit={submitTyped} className="w-full flex items-center gap-2">
          <button type="button" aria-label={core === 'listening' ? 'Stop listening' : 'Speak'} disabled={core === 'speaking' || core === 'thinking'}
            onClick={() => { if (core === 'listening') { stopListening(); setCore('idle'); } else { voiceIn.current = true; listen(); } }}
            className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center disabled:opacity-40 ${core === 'listening' ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10'}`}>
            {core === 'listening' ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={1200} placeholder="Or type your answer…" aria-label="Your answer"
            className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400" />
          <button type="submit" aria-label="Send answer" className="shrink-0 w-11 h-11 rounded-full bg-cyan-500/90 hover:bg-cyan-400 text-[#041018] flex items-center justify-center"><Send className="w-4 h-4" /></button>
        </form>
        <div className="flex gap-4 text-xs text-slate-400">
          {profileStage && <button onClick={() => { stopListening(); void handle('skip'); }} className="flex items-center gap-1 hover:text-slate-200"><SkipForward className="w-3.5 h-3.5" /> Skip question</button>}
          <button onClick={() => closeMeet('later')} className="underline hover:text-slate-200">Finish later</button>
        </div>
        <p className="text-[10px] text-slate-500">Your answers stay on this device. You will review them and choose how to save before anything is stored.</p>
      </div>
    </div>
  );
};
