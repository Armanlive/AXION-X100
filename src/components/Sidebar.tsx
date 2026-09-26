import React, { useState } from 'react';
import { useAxionStore, TabType } from '../store/useAxionStore';
import {
  MessageSquare,
  Users,
  Cpu,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  GitCompare,
  Terminal,
  History,
  CheckCircle2,
  ShieldCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  Sparkles,
  Check,
  Folder
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
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
    workspaces,
    activeWorkspaceId
  } = useAxionStore();

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const primaryProvider = cloudProviders.find((p) => p.isPrimary) || cloudProviders[0];
  const passedPilotCount = pilotTasks.filter((t) => t.status === 'passed').length;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const filteredSessions = chatSessions.filter((s) =>
    s.title.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

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

  return (
    <aside
      className={`bg-[#09090b] border-r border-zinc-800/80 flex flex-col justify-between shrink-0 select-none transition-all duration-150 z-20 ${
        isSidebarCollapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Top Section */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header */}
        <div className="p-3 border-b border-zinc-800/60">
          {!isSidebarCollapsed ? (
            <div
              onClick={() => setCurrentTab('workspace')}
              className="cursor-pointer hover:opacity-90 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-[10px] text-zinc-100 shadow-sm">
                  AX
                </div>
                <span className="font-bold text-xs tracking-tight text-white">AXION-X100</span>
              </div>
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest pl-7 mt-0.5">
                100 SPECIALISTS
              </div>
            </div>
          ) : (
            <div
              onClick={() => setCurrentTab('workspace')}
              className="w-full flex justify-center py-0.5 cursor-pointer"
              title="AXION-X100 (100 Specialists)"
            >
              <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-[11px] text-zinc-100 shadow-sm">
                AX
              </div>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-2 border-b border-zinc-800/60">
          <button
            onClick={createNewChat}
            className={`w-full flex items-center gap-2 rounded-lg text-xs font-semibold transition ${
              isSidebarCollapsed
                ? 'justify-center p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                : 'px-3 py-2 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 shadow-sm'
            }`}
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4 text-zinc-300" />
            {!isSidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Primary Views */}
        <div className="p-1.5 space-y-0.5 border-b border-zinc-800/60">
          {/* Chats */}
          <button
            onClick={() => setCurrentTab('workspace')}
            className={`w-full flex items-center rounded-lg text-xs transition ${
              isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
            } ${
              currentTab === 'workspace'
                ? 'bg-zinc-800 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title="AI Chat & Orchestration"
          >
            <div className="flex items-center gap-2 truncate">
              <MessageSquare className="w-4 h-4 text-zinc-400 shrink-0" />
              {!isSidebarCollapsed && <span>Chats</span>}
            </div>
          </button>

          {/* Agent Lab */}
          <button
            onClick={() => setCurrentTab('agents')}
            className={`w-full flex items-center rounded-lg text-xs transition ${
              isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
            } ${
              currentTab === 'agents'
                ? 'bg-zinc-800 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title="Agent Lab (100 Specialists)"
          >
            <div className="flex items-center gap-2 truncate">
              <Users className="w-4 h-4 text-zinc-400 shrink-0" />
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
              currentTab === 'cloud_brain'
                ? 'bg-zinc-800 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title="Cloud Brain & Compute Providers"
          >
            <div className="flex items-center gap-2 truncate">
              <Cpu className="w-4 h-4 text-zinc-400 shrink-0" />
              {!isSidebarCollapsed && <span>Cloud Brain</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
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
                ? 'bg-zinc-800 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
            }`}
            title={`Local Workspace: ${activeWorkspace?.name || 'Local Folder'}`}
          >
            <div className="flex items-center gap-2 truncate">
              <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
              {!isSidebarCollapsed && <span>Local Workspace</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 truncate max-w-[70px]">
                {activeWorkspace?.name || 'Local'}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Developer Tools */}
        {!isSidebarCollapsed ? (
          <div className="border-b border-zinc-800/60 p-1.5">
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
        ) : null}

        {/* RECENTS (Real Persistent Chat History) */}
        {!isSidebarCollapsed && (
          <div className="flex-1 flex flex-col min-h-0 p-2">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                RECENTS
              </span>
              {chatSessions.length > 1 && (
                <button
                  onClick={() => setIsConfirmClearOpen(true)}
                  className="text-[10px] font-mono text-zinc-600 hover:text-rose-400 transition"
                  title="Clear all conversation history (does NOT delete project files)"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Search Chats */}
            {chatSessions.length > 3 && (
              <div className="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs">
                <Search className="w-3 h-3 text-zinc-500" />
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full bg-transparent text-zinc-300 placeholder-zinc-600 text-[11px] focus:outline-none"
                />
              </div>
            )}

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
              {filteredSessions.map((session) => {
                const isActive = session.id === activeChatId && currentTab === 'workspace';
                const isEditing = editingChatId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => switchChat(session.id)}
                    className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
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
                        <div className="truncate pr-4 flex-1">
                          <span className="truncate block">{session.title}</span>
                          <span className="text-[10px] text-zinc-600 font-mono block">
                            {session.updatedAt}
                          </span>
                        </div>

                        {/* Hover Action Menu */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(session.id, session.title);
                            }}
                            className="p-0.5 text-zinc-500 hover:text-zinc-200 rounded"
                            title="Rename chat"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChat(session.id);
                            }}
                            className="p-0.5 text-zinc-500 hover:text-rose-400 rounded"
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
                <div className="text-[11px] text-zinc-600 italic px-2 py-4 text-center">
                  No matching chats
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer: Compute Settings & Connection Status */}
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

            {/* Provider Connection Status */}
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-850 pt-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-400 truncate">{primaryProvider.name}</span>
              </div>
              <span className="text-zinc-600">{primaryProvider.latencyMs}ms</span>
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
        <div className="flex justify-end pt-1">
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
