import React, { useState, useEffect, useRef } from 'react';
import { useAxionStore, TabType } from '../store/useAxionStore';
import { NativeWorkspaceService } from '../services/nativeWorkspace';
import {
  MessageSquare,
  Mic,
  Plus,
  Cpu,
  Folder,
  Layers,
  ChevronDown,
  ChevronRight,
  GitCompare,
  Terminal,
  History,
  ShieldCheck,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Settings,
  Sparkles,
  ExternalLink,
  Radio,
  Hand
} from 'lucide-react';

export const DesktopSidebar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    speechMode,
    setSpeechMode,
    chatSessions,
    activeChatId,
    createNewChat,
    switchChat,
    renameChat,
    deleteChat,
    activeWorkspace,
    workspaces,
    activeWorkspaceId,
    computeMode,
    chatSearchQuery,
    setChatSearchQuery,
    voiceSettings,
    updateVoiceSettings
  } = useAxionStore();

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const isNativeRuntime = NativeWorkspaceService.isNative();

  // Filter sessions by search query
  const filteredSessions = chatSessions.filter((s) => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.messages?.some((m) => m.text.toLowerCase().includes(q));
  });

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      renameChat(id, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleNewChat = () => {
    createNewChat();
    setSpeechMode('chat');
    setCurrentTab('workspace');
  };

  return (
    <aside className="w-64 bg-[#09090b] border-r border-zinc-800/80 flex flex-col justify-between shrink-0 select-none h-full z-20">
      {/* 1. Header: Branding & Subtitle */}
      <div className="p-3.5 pb-2 border-b border-zinc-900/90 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Luminous Mini Core Mark */}
            <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.15)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs tracking-wider text-zinc-100 font-mono">
                  AXION-X100
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono tracking-tight">
                Local AI Workspace
              </p>
            </div>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 text-xs font-medium transition"
            title="Start New Conversation"
            aria-label="New Chat"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">New</span>
          </button>
        </div>

        {/* 2. Primary Mode Selector: [ Chat | Voice ] */}
        <div className="mt-3 p-0.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center gap-1">
          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('workspace');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              speechMode === 'chat' && currentTab === 'workspace'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => {
              setSpeechMode('speech');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              speechMode === 'speech'
                ? 'bg-zinc-800 text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Voice</span>
          </button>
        </div>

        {/* 2b. Voice Listening Mode Settings Toggle (Push-to-Talk vs Continuous) */}
        <div className="mt-2.5 p-2 rounded-lg bg-[#111114] border border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1.5 px-0.5">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
              <Radio className="w-3 h-3 text-cyan-400" />
              <span>Voice Listening</span>
            </span>
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-850 text-cyan-300/90 border border-zinc-750">
              {voiceSettings.listeningMode === 'push-to-talk' ? 'Push-to-Talk' : 'Continuous'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-zinc-950 border border-zinc-850 text-[11px] font-medium">
            <button
              onClick={() => updateVoiceSettings({ listeningMode: 'push-to-talk' })}
              className={`py-1.5 px-1.5 rounded flex items-center justify-center gap-1.5 transition ${
                voiceSettings.listeningMode === 'push-to-talk'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Push-to-Talk: Only listens when holding talk button or Spacebar"
              aria-label="Switch to Push-to-Talk voice mode"
            >
              <Hand className="w-3 h-3 shrink-0" />
              <span className="truncate text-[10px]">Push-to-Talk</span>
            </button>

            <button
              onClick={() => updateVoiceSettings({ listeningMode: 'continuous' })}
              className={`py-1.5 px-1.5 rounded flex items-center justify-center gap-1.5 transition ${
                voiceSettings.listeningMode !== 'push-to-talk'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Continuous: Listens continuously in real-time"
              aria-label="Switch to Continuous voice mode"
            >
              <Mic className="w-3 h-3 shrink-0" />
              <span className="truncate text-[10px]">Continuous</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Items & Recents */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Workspace Hub */}
        <div className="space-y-0.5">
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Workspace
          </div>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('workspace');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
              currentTab === 'workspace' && speechMode === 'chat'
                ? 'bg-zinc-800/90 text-white border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">Main Workspace</span>
          </button>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('local_workspace');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
              currentTab === 'local_workspace'
                ? 'bg-zinc-800/90 text-white border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">Local Workspace</span>
            </div>
            {activeWorkspace ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Connected" />
            ) : (
              <span className="text-[10px] text-zinc-600 font-mono">None</span>
            )}
          </button>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('agents');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
              currentTab === 'agents'
                ? 'bg-zinc-800/90 text-white border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">Agent Lab</span>
          </button>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('cloud_brain');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
              currentTab === 'cloud_brain' || currentTab === 'router'
                ? 'bg-zinc-800/90 text-white border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">Cloud Brain</span>
          </button>
        </div>

        {/* Developer Tools (Collapsible Accordion) */}
        <div className="space-y-0.5">
          <button
            onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition"
          >
            <span>Developer Tools</span>
            {isDevToolsOpen ? (
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            )}
          </button>

          {isDevToolsOpen && (
            <div className="pl-1 space-y-0.5 border-l border-zinc-800/80 ml-2 animate-in fade-in duration-100">
              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('diffs');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
                  currentTab === 'diffs'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Diff Review Gate</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('terminal');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
                  currentTab === 'terminal'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                }`}
                title="Audit log (Native terminal execution is not implemented yet)"
              >
                <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Terminal Audit</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('router');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
                  currentTab === 'router'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Zero-Cost Router</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('rollback');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
                  currentTab === 'rollback'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                }`}
              >
                <History className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Rollback Vault</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('pilot');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition font-medium ${
                  currentTab === 'pilot'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Pilot Log</span>
              </button>
            </div>
          )}
        </div>

        {/* Recents Conversations */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            <span>Conversations</span>
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
              title="Search conversations"
            >
              <Search className="w-3 h-3" />
            </button>
          </div>

          {isSearchVisible && (
            <div className="px-1.5 py-1">
              <input
                ref={searchInputRef}
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans"
              />
            </div>
          )}

          <div className="space-y-0.5">
            {filteredSessions.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-zinc-600 font-mono">
                No conversations
              </div>
            ) : (
              filteredSessions.slice(0, 10).map((session) => {
                const isActive = activeChatId === session.id && currentTab === 'workspace';
                const isEditing = editingChatId === session.id;

                if (isEditing) {
                  return (
                    <form
                      key={session.id}
                      onSubmit={(e) => handleSaveRename(session.id, e)}
                      className="px-2 py-1 flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white"
                      />
                      <button type="submit" className="p-1 text-emerald-400 hover:text-emerald-300">
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingChatId(null)}
                        className="p-1 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      switchChat(session.id);
                      setSpeechMode('chat');
                      setCurrentTab('workspace');
                    }}
                    className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                      isActive
                        ? 'bg-zinc-800/80 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                    }`}
                  >
                    <span className="truncate pr-1">{session.title}</span>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={(e) => handleStartRename(session.id, session.title, e)}
                        className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {chatSessions.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(session.id);
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Footer: Truthful Runtime & Environment Status Area */}
      <div className="p-3 border-t border-zinc-900 bg-[#09090b] space-y-2 shrink-0">
        {/* Workspace Root Preview */}
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeWorkspace ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            <span className="truncate">
              {activeWorkspace ? activeWorkspace.name : 'No workspace'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {activeWorkspace ? 'Phase 1' : 'Idle'}
          </span>
        </div>

        {/* Runtime Environment Badge */}
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-900/80">
          <span>Runtime:</span>
          <span className="text-zinc-400">
            {isNativeRuntime ? 'Tauri v2 Native' : 'Web Sandbox'}
          </span>
        </div>
      </div>
    </aside>
  );
};
