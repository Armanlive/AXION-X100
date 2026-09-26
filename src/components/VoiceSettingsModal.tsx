import React, { useState, useEffect } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { X, Volume2, Mic, Globe, Gauge, Check } from 'lucide-react';

interface VoiceSettingsModalProps {
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({ onClose }) => {
  const { voiceSettings, updateVoiceSettings, audioTtsEnabled, toggleAudioTts } = useAxionStore();
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in duration-150">
        <div className="p-3.5 bg-[#16161a] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100 font-mono">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Voice & Conversational Audio Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Language Selection */}
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span>Input Language & Hinglish Recognition:</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'auto', label: 'Auto Detect (Hi/En)' },
                { id: 'hinglish', label: 'Hinglish (Colloquial)' },
                { id: 'en', label: 'English Only' },
                { id: 'hi', label: 'Hindi (Devanagari)' }
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => updateVoiceSettings({ language: lang.id as any })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left border transition ${
                    voiceSettings.language === lang.id
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* System TTS Voice Selector */}
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-zinc-500" />
              <span>System Output Voice (Zero-Cost Local):</span>
            </label>
            <select
              value={voiceSettings.voiceName}
              onChange={(e) => updateVoiceSettings({ voiceName: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 focus:outline-none font-mono"
            >
              <option value="Default Voice">Default System Voice</option>
              {availableVoices.map((v, i) => (
                <option key={i} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Speech Rate Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-zinc-500" />
                <span>Speech Speed:</span>
              </span>
              <span className="text-zinc-200">{voiceSettings.speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={voiceSettings.speed}
              onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Auto Speak Toggle */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-200">Auto Speak Responses</div>
              <div className="text-[10px] text-zinc-500">Automatically read AI responses aloud</div>
            </div>
            <button
              onClick={() => updateVoiceSettings({ autoSpeak: !voiceSettings.autoSpeak })}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                voiceSettings.autoSpeak ? 'bg-emerald-600' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  voiceSettings.autoSpeak ? 'left-5' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-500 leading-relaxed font-sans">
            <strong className="text-zinc-400">Zero-Cost Policy:</strong> All speech synthesis and recognition runs directly on local browser/system speech drivers. No paid external voice APIs are contacted.
          </div>
        </div>

        <div className="p-3 bg-[#16161a] border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-200 hover:bg-white text-zinc-950 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
