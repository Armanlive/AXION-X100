import { LiveKitSettings } from './LiveKitSettings';
import { GeminiVoiceOptions } from './voice/GeminiVoiceOptions';
import { globalVoiceEngine } from '../utils/voiceEngine';
import React, { useState, useEffect } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { getFishAudioKey, saveFishAudioKey, FISH_AUDIO_MODELS, testFishAudioConnection } from '../services/fishAudioService';
import { X, Volume2, Mic, Globe, Gauge, Key, Radio, Sparkles, Check, RefreshCw } from 'lucide-react';

interface VoiceSettingsModalProps {
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({ onClose }) => {
  const { voiceSettings, updateVoiceSettings, audioTtsEnabled, cloudProviders, connectProvider, testProviderConnection } = useAxionStore();
  const [previewMessage, setPreviewMessage] = useState('');
  const [fishKey, setFishKey] = useState(() => voiceSettings.fishAudioApiKey || getFishAudioKey());
  const [fishModel, setFishModel] = useState(() => voiceSettings.fishAudioModel || 's2.1-pro');
  const [isTesting, setIsTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const ttsEngine = voiceSettings.ttsEngine || 'fishaudio';
  const fishProvider = cloudProviders.find(p => p.type === 'fishaudio');
  const isFishConnected = !!(fishProvider?.isConnected || fishProvider?.status === 'connected' || (fishProvider?.configured && fishProvider?.verifiedAt));
  const isFishError = fishProvider?.status === 'error';

  const handleSaveFishKey = (newKey:string)=>{setFishKey(newKey);};

  const handleModelChange = (modelId: string) => {
    setFishModel(modelId);
    updateVoiceSettings({ fishAudioModel: modelId });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setPreviewMessage('Testing connection to Fish Audio neural gateway...');
    try {
      if(fishKey.trim()&&fishProvider){await connectProvider(fishProvider.id,fishKey);setFishKey('');}
      const res = await testFishAudioConnection();
      if (res.success) {
        setPreviewMessage(res.message || `Connected & Verified · Fish Audio neural synthesis verified (${res.latencyMs || 0}ms).`);
        if (fishProvider) {
          await testProviderConnection(fishProvider.id);
        }
      } else {
        setPreviewMessage(res.message || 'Fish Audio connection test failed.');
        if (fishProvider) {
          useAxionStore.setState(s => ({
            cloudProviders: s.cloudProviders.map(p => p.id === fishProvider.id ? {
              ...p,
              isConnected: false,
              status: 'error',
              latencyMs: res.latencyMs,
              pingResult: res.message || 'Connection test failed.'
            } : p)
          }));
        }
      }
    } catch (e: any) {
      setPreviewMessage(`Connection test error: ${e?.message || e}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestAndPreview = async () => {
    setPreviewMessage('Synthesizing speech via Fish Audio API...');
    setIsTesting(true);
    try {
      const activeSettings = {
        ...voiceSettings,
        ttsEngine: 'fishaudio' as const,
        fishAudioApiKey: '',
        fishAudioModel: fishModel,
      };
      globalVoiceEngine.configure(activeSettings, true);
      const phrase = 'Alright, this is how I sound now. Not bad... right?';
      await globalVoiceEngine.speak(phrase);
      const hasError = !!globalVoiceEngine.synthesisAdapter.lastError;
      if (!hasError) {
        setPreviewMessage('Connected & Verified · Fish Audio audio playback active.');
        if (fishProvider) {
          await testProviderConnection(fishProvider.id);
        }
      } else {
        setPreviewMessage(globalVoiceEngine.synthesisAdapter.lastError || 'Playback synthesis failed.');
      }
    } catch (e: any) {
      setPreviewMessage(`Playback failed: ${e?.message || e}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#070c18] border border-cyan-500/30 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,240,255,0.15)] animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-[#050811] border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-cyan-50 font-mono tracking-wider">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-[#00f0ff]">
              <Volume2 className="w-4 h-4" />
            </div>
            <span>VOICE & NEURAL AUDIO GATEWAY</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close voice settings"
            className="p-1 rounded-lg hover:bg-cyan-950/60 text-cyan-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <LiveKitSettings />

          {/* TTS Engine Selector: Fish Audio vs Device */}
          <div className="space-y-2">
            <label className="block text-[11px] font-mono text-cyan-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>Voice Synthesis Engine:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateVoiceSettings({ ttsEngine: 'gemini' })}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  ttsEngine === 'gemini'
                    ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : 'bg-[#080d1a] border-cyan-500/20 text-cyan-300/60 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs font-mono text-cyan-100 flex items-center gap-1.5">
                    ✨ Gemini TTS
                  </span>
                  {ttsEngine === 'gemini' && <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />}
                </div>
                <span className="text-[10px] text-cyan-400/70">Natural voice, uses Cloud Brain key</span>
              </button>

              <button
                type="button"
                onClick={() => updateVoiceSettings({ ttsEngine: 'fishaudio' })}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  ttsEngine === 'fishaudio'
                    ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : 'bg-[#080d1a] border-cyan-500/20 text-cyan-300/60 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs font-mono text-cyan-100 flex items-center gap-1.5">
                    🐟 Fish Audio TTS
                  </span>
                  {ttsEngine === 'fishaudio' && <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />}
                </div>
                <span className="text-[10px] text-cyan-400/70">Ultra-realistic neural voice model</span>
              </button>

              <button
                type="button"
                onClick={() => updateVoiceSettings({ ttsEngine: 'device' })}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  ttsEngine === 'device'
                    ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : 'bg-[#080d1a] border-cyan-500/20 text-cyan-300/60 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs font-mono text-cyan-100 flex items-center gap-1.5">
                    💻 Device Local Voice
                  </span>
                  {ttsEngine === 'device' && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                </div>
                <span className="text-[10px] text-cyan-400/70">Standard OS speech synthesis</span>
              </button>
            </div>
          </div>

          {ttsEngine === 'gemini' && <GeminiVoiceOptions />}

          {/* Fish Audio Specific Configuration */}
          {ttsEngine === 'fishaudio' && (
            <div className="p-3.5 rounded-xl bg-[#091024]/80 border border-cyan-500/30 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-cyan-200 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#00f0ff]" />
                  <span>Fish Audio API Key</span>
                </span>
                {isFishConnected ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                    <span>Connected &amp; Verified</span>
                    {fishProvider?.latencyMs ? <span className="text-emerald-500/80 font-normal">· {fishProvider.latencyMs}ms</span> : null}
                  </span>
                ) : isFishError ? (
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Verification Failed</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{fishKey.startsWith('sk-fish-') ? 'Bearer Saved (Untested)' : 'Unsaved Key'}</span>
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={fishKey}
                  onChange={(e) => handleSaveFishKey(e.target.value)}
                  placeholder="sk-fish-..."
                  spellCheck={false}
                  className="w-full bg-[#050811] border border-cyan-500/40 rounded-lg px-3 py-2 text-xs font-mono text-cyan-50 placeholder-cyan-500/40 focus:border-[#00f0ff] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-[10px] font-mono text-cyan-400 hover:text-white"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-[10px] font-mono text-cyan-300/80 mb-1">Neural Model Selection:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {FISH_AUDIO_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModelChange(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border text-center transition ${
                        fishModel === m.id
                          ? 'bg-cyan-900/60 border-[#00f0ff] text-white shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                          : 'bg-[#050811] border-cyan-500/20 text-cyan-300/70 hover:border-cyan-500/40'
                      }`}
                    >
                      {m.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-cyan-500/20">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleTestConnection}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-400/40"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Test Connection</span>
                  </button>
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleTestAndPreview}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition disabled:opacity-50 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>Preview Audio</span>
                  </button>
                </div>
                <span className="text-[10px] font-mono text-cyan-400/80">Bearer Auth Format</span>
              </div>
            </div>
          )}

          {previewMessage && (
            <p role="status" className="text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-2.5">
              {previewMessage}
            </p>
          )}

          {/* Language Selection */}
          <div>
            <label className="block text-[11px] font-mono text-cyan-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Input language:</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'auto', label: 'Auto (system language)' },
                { id: 'en', label: 'English' },
                { id: 'hinglish', label: 'Hinglish' },
                { id: 'hi', label: 'Hindi' }
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => updateVoiceSettings({ language: lang.id as any })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition ${
                    voiceSettings.language === lang.id
                      ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                      : 'bg-[#080d1a] border-cyan-500/20 text-cyan-300/60 hover:border-cyan-500/40'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speech Rate Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>Speech Speed:</span>
              </span>
              <span className="text-cyan-100 font-bold">{voiceSettings.speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={voiceSettings.speed}
              onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
              className="w-full accent-[#00f0ff]"
            />
          </div>

          {/* Listening Mode */}
          <div className="pt-2 border-t border-cyan-500/20">
            <label className="block text-xs font-mono text-cyan-200 mb-2" htmlFor="voice-settings-mode">
              Listening mode
            </label>
            <select
              id="voice-settings-mode"
              value={voiceSettings.listeningMode}
              onChange={(e) => updateVoiceSettings({ listeningMode: e.target.value as typeof voiceSettings.listeningMode })}
              className="w-full bg-[#080d1a] border border-cyan-500/30 rounded-lg p-2 text-xs font-mono text-cyan-100 focus:outline-none focus:border-[#00f0ff]"
            >
              <option value="push-to-talk">Hold button to talk</option>
              <option value="continuous">Conversation</option>
              <option value="wake-word">Hello AXION</option>
            </select>
          </div>

          {/* Auto Speak Toggle */}
          <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-cyan-100">Auto Speak Responses</div>
              <div className="text-[10px] text-cyan-400/60">Automatically read AI responses aloud via Fish Audio</div>
            </div>
            <button
              onClick={() => updateVoiceSettings({ autoSpeak: !voiceSettings.autoSpeak })}
              className={`w-10 h-6 rounded-full transition-colors relative border border-cyan-500/30 ${
                voiceSettings.autoSpeak ? 'bg-cyan-600' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                  voiceSettings.autoSpeak ? 'left-5' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#050811] border-t border-cyan-500/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold font-mono bg-[#00f0ff] hover:bg-[#38bdf8] text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
