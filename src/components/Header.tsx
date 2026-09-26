import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  ShieldCheck,
  Zap,
  Volume2,
  VolumeX,
  FolderGit2,
  Minus,
  Square,
  X,
  Mic,
  Cpu
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    projectPath,
    activeModelId,
    models,
    audioTtsEnabled,
    toggleAudioTts,
    voiceState,
    setCurrentTab
  } = useAxionStore();

  const activeModel = models.find((m) => m.id === activeModelId);

  const getVoiceColor = () => {
    switch (voiceState) {
      case 'listening':
        return 'text-red-400 bg-red-500/10 border-red-500/30 animate-pulse';
      case 'parsing':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-bounce';
      case 'working':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'ready':
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  return (
    <header className="h-12 bg-[#0d1322] border-b border-[#1f293d] px-4 flex items-center justify-between select-none shrink-0 z-20">
      {/* Brand & Workspace Directory */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center shadow-sm">
            <span className="text-[11px] font-black text-white tracking-tighter">AX</span>
          </div>
          <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
            AXION-X100
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
              v1.0.0
            </span>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#223049]" />

        {/* Local Workspace Bound */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-[#141d2f] px-2.5 py-1 rounded border border-[#23334e]">
          <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Workspace:</span>
          <span className="text-slate-200 font-semibold">{projectPath}</span>
          <span className="text-[10px] px-1 bg-emerald-500/20 text-emerald-400 rounded">
            Secured
          </span>
        </div>
      </div>

      {/* Center Slogan / Security Philosophy */}
      <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-400 font-medium">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>AI proposes. User approves. Native layer enforces.</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Voice State Indicator */}
        <button
          onClick={() => setCurrentTab('workspace')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition ${getVoiceColor()}`}
          title="Voice State"
        >
          <Mic className="w-3.5 h-3.5" />
          <span className="capitalize">{voiceState}</span>
        </button>

        {/* Zero-Cost Model Router Pill */}
        <button
          onClick={() => setCurrentTab('router')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141d2f] hover:bg-[#1a263d] border border-[#23334e] text-xs font-mono text-slate-200 transition"
          title="Zero-Cost Dynamic Router"
        >
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">{activeModel?.name || 'Gemini 2.0 Flash'}</span>
          <span className="text-[10px] px-1 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-semibold">
            $0.00
          </span>
        </button>

        {/* Audio TTS toggle */}
        <button
          onClick={toggleAudioTts}
          className={`p-1.5 rounded border transition ${
            audioTtsEnabled
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              : 'bg-[#141d2f] border-[#23334e] text-slate-400 hover:text-slate-200'
          }`}
          title={audioTtsEnabled ? 'Audio TTS Enabled' : 'Audio TTS Muted'}
        >
          {audioTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Windows Desktop Style Frame Controls */}
        <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-[#223049] text-slate-400">
          <div className="p-1 hover:bg-[#1a263d] rounded cursor-pointer transition">
            <Minus className="w-3 h-3" />
          </div>
          <div className="p-1 hover:bg-[#1a263d] rounded cursor-pointer transition">
            <Square className="w-2.5 h-2.5" />
          </div>
          <div className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded cursor-pointer transition">
            <X className="w-3 h-3" />
          </div>
        </div>
      </div>
    </header>
  );
};
