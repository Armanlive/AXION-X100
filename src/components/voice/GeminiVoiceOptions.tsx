import React, { useState } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { globalVoiceEngine } from '../../utils/voiceEngine';
import { GEMINI_TTS_MODELS, GEMINI_TTS_VOICES, DEFAULT_GEMINI_TTS_MODEL, DEFAULT_GEMINI_TTS_VOICE } from '../../services/geminiTtsService';

/** Model and voice picker for the Gemini TTS engine; the key comes from Cloud Brain. */
export const GeminiVoiceOptions: React.FC = () => {
  const { voiceSettings, updateVoiceSettings, cloudProviders } = useAxionStore();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const gemini = cloudProviders.find(p => p.type === 'gemini');
  const hasKey = !!(gemini?.configured || gemini?.isConnected || gemini?.status === 'connected');
  const model = voiceSettings.geminiTtsModel || DEFAULT_GEMINI_TTS_MODEL;
  const voice = voiceSettings.geminiTtsVoice || DEFAULT_GEMINI_TTS_VOICE;

  const preview = async () => {
    setBusy(true);
    setMessage('Synthesizing with Gemini...');
    try {
      globalVoiceEngine.configure({ ...voiceSettings, ttsEngine: 'gemini', geminiTtsModel: model, geminiTtsVoice: voice }, true);
      const started = performance.now();
      await globalVoiceEngine.speak('Alright, this is how I sound now. Not bad... right?');
      const error = globalVoiceEngine.synthesisAdapter.lastError;
      setMessage(error || `Played in ${Math.round(performance.now() - started)} ms. If it sounded like the device voice, Gemini failed and AXION fell back.`);
    } catch (e: any) {
      setMessage(`Playback failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const selectClass = 'w-full bg-zinc-900 border border-cyan-500/30 rounded-lg px-2 py-1.5 text-xs text-cyan-100';
  return (
    <div className="p-3.5 rounded-xl bg-[#091024]/80 border border-cyan-500/30 space-y-3 shadow-inner text-[11px] font-mono">
      <p className={hasKey ? 'text-emerald-400' : 'text-amber-300'}>
        {hasKey ? 'Using the Gemini key saved in Cloud Brain.' : 'Save a Gemini key in Cloud Brain first. Until then AXION falls back to Fish Audio or device speech.'}
      </p>
      <label className="block space-y-1 text-cyan-300">
        <span>Model</span>
        <select aria-label="Gemini TTS model" value={model} onChange={e => updateVoiceSettings({ geminiTtsModel: e.target.value })} className={selectClass}>
          {GEMINI_TTS_MODELS.map(m => <option key={m.id} value={m.id}>{m.name} — {m.description}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-cyan-300">
        <span>Voice</span>
        <select aria-label="Gemini TTS voice" value={voice} onChange={e => updateVoiceSettings({ geminiTtsVoice: e.target.value })} className={selectClass}>
          {GEMINI_TTS_VOICES.map(v => <option key={v.id} value={v.id}>{v.id} — {v.description}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy} onClick={preview} className="px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-100 hover:bg-cyan-950/60 disabled:opacity-50">
        {busy ? 'Speaking...' : 'Preview voice'}
      </button>
      {message && <p className="text-cyan-300/80">{message}</p>}
    </div>
  );
};
