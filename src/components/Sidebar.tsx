import React, { useState, useEffect, useRef } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  MessageSquare,
  Mic,
  SquarePen,
  Cpu,
  Search,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  GitCompare,
  Terminal,
  History,
  CheckCircle2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Folder,
  Sparkles,
  X,
  Radio,
  Hand
} from 'lucide-react';

export const Sidebar: React.FC = () => {
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
    clearAllChats,
    chatSearchQuery,
    setChatSearchQuery,
    isSidebarCollapsed,
    toggleSidebar,
    activeDiff,
    snapshots,
    pilotTasks,
    cloudProviders,
    computeMode,
    activeWorkspace,
    workspaces,
    activeWorkspaceId,
    voiceSettings,
    updateVoiceSettings
  } = useAxionStore();

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const primaryProvider = cloudProviders.find((p) => p.isPrimary) || cloudProviders[0];
  const passedPilotCount = pilotTasks.filter((t) => t.status === 'passed').length;

  // Live case-insensitive search across title, user prompts, and agent responses
  const filteredSessions = chatSessions.filter((s) => {
    if (!chatSearchQuery.trim()) return true;
    const query = chatSearchQuery.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(query);
    const messageMatch = s.messages?.some((m) => m.text.toLowerCase().includes(query));
    return titleMatch || messageMatch;
  });

  // Global shortcut for search (Ctrl+K or Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        if (!isSidebarCollapsed) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarCollapsed]);

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingChatId(id);
    setEditTitle(currentTitle);
    setActiveMenuChatId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      renameChat(id, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleNewChatClick = () => {
    createNewChat();
    setCurrentTab('workspace');
  };

  return (
    <aside
      className={`bg-[#09090b] border-r border-zinc-800/80 flex flex-col justify-between shrink-0 select-none transition-all duration-200 z-20 ${
        isSidebarCollapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Top Fixed Section */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* 1. Gemini-Style Mode Selector: [ Chat | Voice ] */}
        <div className="p-2 pb-1 shrink-0">
          {!isSidebarCollapsed ? (
            <div className="bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80 flex items-center gap-1 shadow-inner">
              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('workspace');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  speechMode !== 'speech' && currentTab === 'workspace'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                }`}
                title="AI Conversation & Text Workspace"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-zinc-300" />
                <span>Chat</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('speech');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  speechMode === 'speech'
                    ? 'bg-zinc-800 text-amber-300 shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                }`}
                title="Conversational Live Speech Mode"
              >
                <Mic className={`w-3.5 h-3.5 shrink-0 ${speechMode === 'speech' ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>Voice</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 items-center pb-1 border-b border-zinc-800/60">
              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('workspace');
                }}
                className={`p-2 rounded-lg transition ${
                  speechMode !== 'speech' && currentTab === 'workspace'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
                title="Chat Workspace"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSpeechMode('speech');
                }}
                className={`p-2 rounded-lg transition ${
                  speechMode === 'speech'
                    ? 'bg-zinc-800 text-amber-300 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
                title="Voice Mode"
              >
                <Mic className={`w-4 h-4 ${speechMode === 'speech' ? 'text-amber-400' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* 2. New Chat Row (Below Chat / Spark) */}
        <div className="px-2 py-1 shrink-0">
          <button
            onClick={handleNewChatClick}
            className={`w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition ${
              isSidebarCollapsed
                ? 'justify-center p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                : 'px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800/70 border border-transparent hover:border-zinc-750/70'
            }`}
            title="Start New Conversation (Clear chat & open landing hero)"
          >
            <SquarePen className="w-4 h-4 text-zinc-400 shrink-0" />
            {!isSidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* 3. Main Navigation Items */}
        <div className="px-2 py-1 space-y-0.5 border-b border-zinc-800/60 shrink-0">
          {/* Agent Lab */}
          <button
            onClick={() => setCurrentTab('agents')}
            className={`w-full flex items-center rounded-lg text-xs transition ${
              isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
            } ${
              currentTab === 'agents'
                ? 'bg-zinc-800 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title="Agent Lab (100 Specialists)"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Sparkles className="w-4 h-4 text-amber-400/90 shrink-0" />
              {!isSidebarCollapsed && <span>Agent Lab</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                100
              </span>
            )}
          </button>

          {/* Cloud Brain */}
          <button
            onClick={() => setCurrentTab('cloud_brain')}
            className={`w-full flex items-center rounded-lg text-xs transition ${
              isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
            } ${
              currentTab === 'cloud_brain' || currentTab === 'router'
                ? 'bg-zinc-800 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title="Cloud Brain & Compute Intelligence"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Cpu className="w-4 h-4 text-cyan-400/90 shrink-0" />
              {!isSidebarCollapsed && <span>Cloud Brain</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-medium">
                ● Free
              </span>
            )}
          </button>

          {/* Local Workspace */}
          <button
            onClick={() => setCurrentTab('local_workspace')}
            className={`w-full flex items-center rounded-lg text-xs transition ${
              isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
            } ${
              currentTab === 'local_workspace'
                ? 'bg-zinc-800 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title={`Local Workspace: ${activeWorkspace?.name || 'Local Folder'}`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Folder className="w-4 h-4 text-indigo-400/90 shrink-0" />
              {!isSidebarCollapsed && <span>Local Workspace</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 truncate max-w-[70px]">
                {activeWorkspace?.name || 'Local'}
              </span>
            )}
          </button>
        </div>

        {/* 4. Collapsible Developer Tools */}
        {!isSidebarCollapsed && (
          <div className="border-b border-zinc-800/60 px-2 py-1.5 shrink-0">
            <button
              onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition"
            >
              <span>DEVELOPER TOOLS</span>
              {isDevToolsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            {isDevToolsOpen && (
              <div className="mt-1 space-y-0.5 animate-in fade-in duration-100">
                {/* Diff Gate */}
                <button
                  onClick={() => setCurrentTab('diffs')}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                    currentTab === 'diffs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Diff Gate</span>
                  </div>
                  {activeDiff && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>

                {/* Terminal & Audit */}
                <button
                  onClick={() => setCurrentTab('terminal')}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                    currentTab === 'terminal' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Terminal & Audit</span>
                  </div>
                </button>

                {/* Cloud Router */}
                <button
                  onClick={() => setCurrentTab('router')}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                    currentTab === 'router' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Zero-Cost Router</span>
                  </div>
                </button>

                {/* Rollback Vault */}
                <button
                  onClick={() => setCurrentTab('rollback')}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                    currentTab === 'rollback' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rollback Vault</span>
                  </div>
                  {snapshots.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-500">#{snapshots.length}</span>
                  )}
                </button>

                {/* Quality Suite */}
                <button
                  onClick={() => setCurrentTab('pilot')}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                    currentTab === 'pilot' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Quality Suite</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{passedPilotCount}/10</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. RECENTS Section (Scrollable Flex History) */}
        {!isSidebarCollapsed && (
          <div className="flex-1 flex flex-col min-h-0 px-2 py-2 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                RECENTS
              </span>
              {chatSessions.length > 1 && (
                <button
                  onClick={() => setIsConfirmClearOpen(true)}
                  className="text-[10px] font-mono text-zinc-600 hover:text-rose-400 transition"
                  title="Clear conversation history"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Dedicated Search Chats Control */}
            <div className="mb-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs focus-within:border-zinc-700 transition">
                <Search className="w-3 h-3 text-zinc-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (chatSearchQuery) {
                        setChatSearchQuery('');
                      } else {
                        searchInputRef.current?.blur();
                      }
                    }
                  }}
                  placeholder="Search chats..."
                  className="w-full bg-transparent text-zinc-300 placeholder-zinc-600 text-[11px] focus:outline-none"
                />
                {chatSearchQuery && (
                  <button
                    onClick={() => setChatSearchQuery('')}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Conversation List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
              {filteredSessions.map((session) => {
                const isActive = session.id === activeChatId && currentTab === 'workspace';
                const isEditing = editingChatId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      switchChat(session.id);
                      setCurrentTab('workspace');
                    }}
                    className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 font-medium shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(session.id);
                            if (e.key === 'Escape') setEditingChatId(null);
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(session.id)}
                          className="p-1 hover:text-emerald-400"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="truncate pr-2 flex-1">
                          <span className="truncate block text-xs">{session.title}</span>
                          <span className="text-[10px] text-zinc-600 font-mono block">
                            {session.updatedAt}
                          </span>
                        </div>

                        {/* Recent Chat Hover Actions */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(session.id, session.title);
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-750"
                            title="Rename chat"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChat(session.id);
                            }}
                            className="p-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-750"
                            title="Delete conversation"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {filteredSessions.length === 0 && (
                <div className="text-center py-6 px-2">
                  <p className="text-[11px] text-zinc-500 mb-2">No conversations found</p>
                  {chatSearchQuery && (
                    <button
                      onClick={() => setChatSearchQuery('')}
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer (Fixed): Compute Settings & Connection Status */}
      <div className="p-2 border-t border-zinc-800/60 space-y-1.5 shrink-0 bg-[#09090b]">
        {!isSidebarCollapsed ? (
          <>
            {/* Compute Settings Button */}
            <button
              onClick={() => setCurrentTab('cloud_brain')}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 transition font-sans"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-zinc-500" />
                <span>Compute Settings</span>
              </div>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                {computeMode}
              </span>
            </button>

            {/* Voice Listening Mode Toggle (Push-to-Talk vs Continuous) */}
            <div className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1 px-0.5">
                <span className="flex items-center gap-1 text-zinc-300">
                  <Radio className="w-3 h-3 text-cyan-400" />
                  <span>Voice Mode</span>
                </span>
                <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-zinc-800 text-cyan-300">
                  {voiceSettings.listeningMode === 'push-to-talk' ? 'PTT' : 'Continuous'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded bg-zinc-950 border border-zinc-850 text-[10px]">
                <button
                  onClick={() => updateVoiceSettings({ listeningMode: 'push-to-talk' })}
                  className={`py-1 px-1 rounded flex items-center justify-center gap-1 transition ${
                    voiceSettings.listeningMode === 'push-to-talk'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title="Push-to-Talk Mode"
                >
                  <Hand className="w-2.5 h-2.5" />
                  <span>PTT</span>
                </button>
                <button
                  onClick={() => updateVoiceSettings({ listeningMode: 'continuous' })}
                  className={`py-1 px-1 rounded flex items-center justify-center gap-1 transition ${
                    voiceSettings.listeningMode !== 'push-to-talk'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title="Continuous Mode"
                >
                  <Mic className="w-2.5 h-2.5" />
                  <span>Live</span>
                </button>
              </div>
            </div>

            {/* Provider Connection Status */}
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-850 pt-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <span className={`w-1.5 h-1.5 rounded-full ${primaryProvider.isConnected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <span className="text-zinc-400 truncate">{primaryProvider.name}</span>
              </div>
              <span className="text-zinc-600">{primaryProvider.latencyMs ? `${primaryProvider.latencyMs}ms` : 'untested'}</span>
            </div>
          </>
        ) : (
          <button
            onClick={() => setCurrentTab('cloud_brain')}
            className="w-full flex justify-center p-1.5 rounded text-zinc-500 hover:text-zinc-200"
            title="Compute Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Sidebar Collapse Toggle */}
        <div className="flex justify-end pt-0.5">
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition ${
              isSidebarCollapsed ? 'w-full flex justify-center' : ''
            }`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Clear All Chats */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-xl max-w-sm w-full p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Clear All Chat History?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              This will only delete conversation history. Your local workspace files, git history, snapshots, and rollback records will remain 100% safe.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAllChats();
                  setIsConfirmClearOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white transition"
              >
                Clear Chats
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
