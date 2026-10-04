import React, { useState } from 'react';
import { useAxionStore, TabType } from '../../store/useAxionStore';
import { NativeWorkspaceService } from '../../services/nativeWorkspace';
import {
  X,
  Plus,
  Cpu,
  Sparkles,
  GitCompare,
  Terminal,
  Layers,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Trash2,
  Folder
} from 'lucide-react';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({ isOpen, onClose }) => {
  const {
    setCurrentTab,
    setSpeechMode,
    chatSessions,
    activeChatId,
    switchChat,
    createNewChat,
    deleteChat,
    activeWorkspace,
    computeMode
  } = useAxionStore();

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const isNativeRuntime = NativeWorkspaceService.isNative();

  if (!isOpen) return null;

  const handleSelectTab = (tab: TabType) => {
    setSpeechMode('chat');
    setCurrentTab(tab);
    onClose();
  };

  const handleNewChat = () => {
    createNewChat();
    setSpeechMode('chat');
    setCurrentTab('workspace');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Content */}
      <div className="bg-[#121215] border-t border-zinc-800 rounded-t-3xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Drag Handle & Header */}
        <div className="p-3 pb-2 flex flex-col items-center border-b border-zinc-850 shrink-0">
          <div className="w-10 h-1 bg-zinc-700 rounded-full mb-3" />
          <div className="w-full flex items-center justify-between px-2">
            <span className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
              AXION Workspace Menu
            </span>
            <button
              onClick={onClose}
              className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleNewChat}
              className="min-h-[44px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-white hover:bg-zinc-800 transition"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>New Chat</span>
            </button>

            <button
              onClick={() => handleSelectTab('local_workspace')}
              className="min-h-[44px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-white hover:bg-zinc-800 transition"
            >
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>Workspace</span>
            </button>
          </div>

          {/* Primary Capabilities */}
          <div className="space-y-1">
            <div className="px-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Intelligence & Compute
            </div>

            <button
              onClick={() => handleSelectTab('agents')}
              className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-850 text-xs text-zinc-200 font-medium transition"
            >
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-left">
                <div>Agent Lab</div>
                <div className="text-[10px] text-zinc-500">17 specialist engineering agents</div>
              </div>
            </button>

            <button
              onClick={() => handleSelectTab('cloud_brain')}
              className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-850 text-xs text-zinc-200 font-medium transition"
            >
              <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-left">
                <div>Cloud Brain & Models</div>
                <div className="text-[10px] text-zinc-500">Model router and compute tier</div>
              </div>
            </button>
          </div>

          {/* Developer Tools (Collapsible) */}
          <div className="space-y-1">
            <button
              onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
              className="w-full min-h-[44px] flex items-center justify-between px-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
            >
              <span>Developer Tools</span>
              {isDevToolsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isDevToolsOpen && (
              <div className="space-y-1 pl-2 border-l border-zinc-800">
                <button
                  onClick={() => handleSelectTab('diffs')}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-850"
                >
                  <GitCompare className="w-4 h-4 text-zinc-400" />
                  <span>Diff Review Gate</span>
                </button>

                <button
                  onClick={() => handleSelectTab('terminal')}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-850"
                >
                  <Terminal className="w-4 h-4 text-zinc-400" />
                  <span>Terminal Audit</span>
                </button>

                <button
                  onClick={() => handleSelectTab('router')}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-850"
                >
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <span>Zero-Cost Router</span>
                </button>

                <button
                  onClick={() => handleSelectTab('rollback')}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-850"
                >
                  <History className="w-4 h-4 text-zinc-400" />
                  <span>Rollback Vault</span>
                </button>

                <button
                  onClick={() => handleSelectTab('pilot')}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-850"
                >
                  <ShieldCheck className="w-4 h-4 text-zinc-400" />
                  <span>Pilot Verification Log</span>
                </button>
              </div>
            )}
          </div>

          {/* Recent Conversations */}
          <div className="space-y-1">
            <div className="px-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Recent Conversations
            </div>
            <div className="space-y-1">
              {chatSessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    switchChat(s.id);
                    setSpeechMode('chat');
                    setCurrentTab('workspace');
                    onClose();
                  }}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                    activeChatId === s.id ? 'bg-zinc-800 text-white font-medium' : 'bg-zinc-900/40 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  {chatSessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(s.id);
                      }}
                      className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-500 hover:text-rose-400"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Truthful Runtime Footer */}
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] font-mono text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="text-zinc-300">{isNativeRuntime ? 'Tauri Desktop' : 'Web Sandbox'}</span>
            </div>
            <div className="flex justify-between">
              <span>Workspace:</span>
              <span className="text-zinc-300">{activeWorkspace ? activeWorkspace.name : 'None (Phase 1 Read-Only)'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
