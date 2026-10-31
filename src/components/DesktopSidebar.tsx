import React, { useState, useRef, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { NativeWorkspaceService } from '../services/nativeWorkspace';
import { SessionChangesBadge, SessionChangesPanel } from './chat/SessionChangesPanel';
import type { SessionFileChange } from '../utils/sessionChanges';
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
  Sparkles,
  FolderOpen
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
    createWorkspaceChat,
    switchChat,
    switchWorkspace,
    renameChat,
    deleteChat,
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    chatSearchQuery,
    setChatSearchQuery
  } = useAxionStore();

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [changesSessionId, setChangesSessionId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const isNative = NativeWorkspaceService.isNative();

  const isWorkspaceChat = (s: ChatSessionLike) =>
    Boolean(s.isWorkspaceBound || (s.workspaceId && s.workspaceId !== 'default' && s.workspaceId !== ''));
  const matchesSearch = (s: ChatSessionLike) => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.messages?.some((m) => m.text.toLowerCase().includes(q));
  };

  // General conversations live in the lower "Recents" section, fully separated
  // from project threads.
  const generalSessions = useMemo(
    () => chatSessions.filter((s) => !isWorkspaceChat(s) && matchesSearch(s)),
    [chatSessions, chatSearchQuery]
  );
  const searchResults = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    return chatSessions.filter(matchesSearch);
  }, [chatSessions, chatSearchQuery]);

  // Match by id or by the exact folder path (keeps chats saved before path-based ids);
  // never by folder name, which two different projects can share.
  const threadsForProject = (wsId: string, wsPath?: string) =>
    chatSessions.filter(
      (s) =>
        isWorkspaceChat(s) &&
        (s.workspaceId === wsId || (wsPath ? s.workspacePath === wsPath : false)) &&
        matchesSearch(s)
    );

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) renameChat(id, editTitle.trim());
    setEditingChatId(null);
  };

  const handleNewChat = async () => {
    createNewChat('general');
    setSpeechMode('chat');
    setCurrentTab('workspace');
  };

  const handleProjectClick = async (wsId: string) => {
    const expanding = openProjectId !== wsId;
    setOpenProjectId(expanding ? wsId : null);
    setSpeechMode('chat');
    if (wsId !== activeWorkspaceId) {
      try {
        await switchWorkspace(wsId);
      } catch {
        // Workspace switch already surfaces its own sync error state.
      }
    }
    // After the switch, so the chat view opens this project's thread rather than the previous one.
    setCurrentTab('code_studio');
  };

  const handleNewProjectThread = async (wsId: string) => {
    if (wsId !== activeWorkspaceId) {
      try {
        await switchWorkspace(wsId);
      } catch {
        return;
      }
    }
    createWorkspaceChat();
    setSpeechMode('chat');
    setOpenProjectId(wsId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteChat(id);
  };

  const renderSessionRow = (session: ChatSessionLike) => {
    const isActive = activeChatId === session.id && currentTab === (session.isWorkspaceBound ? 'code_studio' : 'workspace');
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
            className="flex-1 bg-[#080e1c] border border-cyan-500/40 rounded px-1.5 py-0.5 text-xs text-white font-mono"
          />
          <button type="submit" className="p-1 text-[#00f0ff] hover:text-white">
            <Check className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => setEditingChatId(null)} className="p-1 text-cyan-400/60 hover:text-white">
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
        }}
        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
          isActive
            ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/35 font-medium shadow-[0_0_10px_rgba(0,240,255,0.1)]'
            : 'text-cyan-200/70 hover:text-white hover:bg-cyan-950/40 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-1">
          <MessageSquare className="w-3 h-3 text-cyan-400/60 shrink-0" />
          <span className="truncate">{session.title}</span>
          <SessionChangesBadge changes={session.changes} onOpen={() => setChangesSessionId(session.id)} />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
          <button
            onClick={(e) => handleStartRename(session.id, session.title, e)}
            className="p-1 text-cyan-400/60 hover:text-[#00f0ff] rounded"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {chatSessions.length > 1 && (
            <button onClick={(e) => handleDelete(session.id, e)} className="p-1 text-cyan-400/60 hover:text-rose-400 rounded" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-60 bg-[#050508] border-r border-cyan-500/20 flex flex-col justify-between shrink-0 select-none h-full z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      {/* 1. Header: Branding & Subtitle */}
      <div className="p-3 pb-2.5 border-b border-cyan-500/15 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.25)]">
              <span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs tracking-wider text-white font-mono">
                  AXION<span className="text-[#00f0ff]">-X100</span>
                </span>
              </div>
              <p className="text-[10px] text-cyan-400/60 font-mono tracking-tight">
                Autonomous AI Workspace
              </p>
            </div>
          </div>

          <button
            onClick={() => handleNewChat()}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-200 hover:text-[#00f0ff] border border-cyan-500/30 hover:border-cyan-400 text-xs font-mono transition shadow-[0_0_8px_rgba(0,240,255,0.1)]"
            title="Start New Conversation"
            aria-label="New Chat"
          >
            <Plus className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-[11px] font-semibold">New</span>
          </button>
        </div>

        {/* 2. Primary Mode Selector: [ Chat | Voice ] */}
        <div className="mt-3 p-0.5 rounded-lg bg-[#080d1a] border border-cyan-500/25 flex items-center gap-1">
          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('workspace');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition-all ${
              speechMode === 'chat' && currentTab === 'workspace'
                ? 'bg-cyan-950/90 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.2)] border border-cyan-500/40 font-bold'
                : 'text-cyan-300/60 hover:text-white hover:bg-cyan-950/40'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button onClick={()=>{setSpeechMode('chat');setCurrentTab('code_studio');}} aria-current={currentTab==='code_studio'?'page':undefined} className="px-2 py-1.5 text-xs text-cyan-200 rounded hover:bg-cyan-950">Code</button>

          <button
            onClick={() => setSpeechMode('speech')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition-all ${
              speechMode === 'speech'
                ? 'bg-cyan-950/90 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.2)] border border-cyan-500/40 font-bold'
                : 'text-cyan-300/60 hover:text-white hover:bg-cyan-950/40'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Voice</span>
          </button>
        </div>
      </div>

      <button onClick={()=>{setSpeechMode('chat');setCurrentTab('plugins');}} className="mx-3 my-2 p-2 border border-cyan-500/25 rounded text-xs text-cyan-200" aria-current={currentTab==='plugins'?'page':undefined}>Customize / Plugins</button>
      {/* 3. Projects section: local workspaces with their dedicated threads */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400/60 font-semibold">
            <span>Projects</span>
            <button
              onClick={() => setCurrentTab('local_workspace')}
              className="text-cyan-400/70 hover:text-[#00f0ff] p-0.5 rounded transition"
              title="Mount a new local workspace"
              aria-label="Mount a new local workspace"
            >
              <FolderOpen className="w-3 h-3" />
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="px-2 py-3 rounded-lg bg-[#080d1a]/50 border border-cyan-500/10 text-center space-y-1.5">
              <p className="text-[11px] text-cyan-400/50 font-mono">No projects mounted yet.</p>
              <button
                onClick={() => setCurrentTab('local_workspace')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] text-[#00f0ff] hover:bg-cyan-900/60 font-mono"
              >
                <FolderOpen className="w-2.5 h-2.5" />
                <span>Open Local Workspace</span>
              </button>
            </div>
          ) : (
            workspaces.map((ws) => {
              const isOpen = openProjectId === ws.id;
              const isActive = ws.id === activeWorkspaceId;
              const threads = threadsForProject(ws.id, ws.path);
              return (
                <div key={ws.id} className="space-y-0.5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleProjectClick(ws.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') void handleProjectClick(ws.id);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                      isActive
                        ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold'
                        : 'text-cyan-200/70 hover:text-white hover:bg-cyan-950/40 border border-transparent'
                    }`}
                    title={`${ws.path}${ws.branch ? ` · ${ws.branch}` : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
                      <span className="truncate">{ws.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] px-1 py-0 rounded border font-mono ${
                          isActive ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300' : 'bg-cyan-950/40 border-cyan-700/40 text-cyan-500/70'
                        }`}
                      >
                        {ws.branch || 'main'}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]' : 'bg-cyan-600/50'}`}
                        title={isActive ? 'Active project' : 'Mounted'}
                      />
                      {isOpen ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronRight className="w-3 h-3 text-cyan-400/70" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="ml-3 pl-2 border-l border-cyan-500/15 space-y-0.5 animate-in fade-in duration-100">
                      {threads.map((session) => renderSessionRow(session))}
                      <button
                        onClick={() => handleNewProjectThread(ws.id)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-cyan-300/70 hover:text-[#00f0ff] hover:bg-cyan-950/40 font-mono transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New thread</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Workspace Hub */}
        <div className="space-y-0.5">
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400/60 font-semibold">
            Workspace
          </div>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('workspace');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
              currentTab === 'workspace' && speechMode === 'chat'
                ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold'
                : 'text-cyan-200/70 hover:text-white hover:bg-cyan-950/40 hover:border-cyan-500/20 border border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
            <span className="truncate">Main Workspace</span>
          </button>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('local_workspace');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
              currentTab === 'local_workspace'
                ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold'
                : 'text-cyan-200/70 hover:text-white hover:bg-cyan-950/40 hover:border-cyan-500/20 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
              <span className="truncate">Local Workspace</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {activeWorkspace ? (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]"
                  title={`Connected: ${activeWorkspace.name}`}
                />
              ) : (
                <span className="text-[10px] text-cyan-500/50 font-mono">None</span>
              )}
            </div>
          </button>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('agents');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
              currentTab === 'agents'
                ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold'
                : 'text-cyan-200/70 hover:text-white hover:bg-cyan-950/40 hover:border-cyan-500/20 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
            <span className="truncate">Agent Lab</span>
          </button>

          <button
            onClick={() => {
              setSpeechMode('chat');
              setCurrentTab('cloud_brain');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
              currentTab === 'cloud_brain' || currentTab === 'router'
                ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold'
                : 'text-cyan-200/70 hover:text-white hover:bg-cyan-950/40 hover:border-cyan-500/20 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
            <span className="truncate">Cloud Brain</span>
          </button>
        </div>

        {/* Developer Tools (Collapsible Accordion) */}
        <div className="space-y-0.5">
          <button
            onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400/60 hover:text-cyan-200 transition"
          >
            <span>Developer Tools</span>
            {isDevToolsOpen ? (
              <ChevronDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-cyan-400" />
            )}
          </button>

          {isDevToolsOpen && (
            <div className="pl-1 space-y-0.5 border-l border-cyan-500/20 ml-2 animate-in fade-in duration-100">
              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('diffs');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                  currentTab === 'diffs'
                    ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/35'
                    : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
                <span className="truncate">Diff Review Gate</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('terminal');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                  currentTab === 'terminal'
                    ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/35'
                    : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40'
                }`}
                title="Audit log"
              >
                <Terminal className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
                <span className="truncate">Terminal Audit</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('router');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                  currentTab === 'router'
                    ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/35'
                    : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
                <span className="truncate">Zero-Cost Router</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('rollback');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                  currentTab === 'rollback'
                    ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/35'
                    : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40'
                }`}
              >
                <History className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
                <span className="truncate">Rollback Vault</span>
              </button>

              <button
                onClick={() => {
                  setSpeechMode('chat');
                  setCurrentTab('pilot');
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                  currentTab === 'pilot'
                    ? 'bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/35'
                    : 'text-cyan-300/70 hover:text-white hover:bg-cyan-950/40'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#00f0ff] shrink-0" />
                <span className="truncate">Pilot Log</span>
              </button>
            </div>
          )}
        </div>

        {/* Recents: general conversations, cleanly separated from projects */}
        {!chatSearchQuery.trim() && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400/60 font-semibold">
              <span>Recents</span>
              <button
                onClick={() => setIsSearchVisible(!isSearchVisible)}
                className="text-cyan-400/70 hover:text-[#00f0ff] p-0.5 rounded transition"
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
                  placeholder="Search all chats..."
                  className="w-full bg-[#080e1c] border border-cyan-500/30 rounded px-2 py-1 text-xs text-white placeholder-cyan-300/40 focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>
            )}

            {generalSessions.length === 0 ? (
              <div className="px-2 py-3 rounded-lg bg-[#080d1a]/50 border border-cyan-500/10 text-center space-y-1.5">
                <p className="text-[11px] text-cyan-400/50 font-mono">No general conversations</p>
                <button
                  onClick={() => createNewChat('general')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] text-[#00f0ff] hover:bg-cyan-900/60 font-mono"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Start General Chat</span>
                </button>
              </div>
            ) : (
              generalSessions.slice(0, 15).map((session) => renderSessionRow(session))
            )}
          </div>
        )}

        {/* Search results span every project thread and general conversation */}
        {chatSearchQuery.trim() && (
          <div className="space-y-1.5">
            <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-cyan-400/60 font-semibold">
              Results ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-cyan-400/50 font-mono">No chats match your search.</p>
            ) : (
              searchResults.slice(0, 15).map((session) => renderSessionRow(session))
            )}
          </div>
        )}
      </div>

      {/* 4. Bottom Footer: Truthful Runtime & Environment Status Area */}
      <div className="p-3 border-t border-cyan-500/20 bg-[#050508] space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeWorkspace ? 'bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]' : 'bg-cyan-950'
              }`}
            />
            <span className="truncate font-semibold">
              {activeWorkspace ? activeWorkspace.name : 'No workspace'}
            </span>
          </div>
          <span className="text-[10px] text-cyan-400/60 font-mono">
            {activeWorkspace ? 'Phase 1' : 'Idle'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400/60 pt-1 border-t border-cyan-500/15">
          <span>Runtime:</span>
          <span className="text-[#00f0ff] font-bold">
            {isNative ? 'Tauri v2 Native' : 'Web Sandbox'}
          </span>
        </div>
      </div>
      {changesSessionId && <SessionChangesPanel sessionId={changesSessionId} onClose={() => setChangesSessionId(null)} />}
    </aside>
  );
};

interface ChatSessionLike {
  id: string;
  title: string;
  workspaceId?: string;
  workspaceName?: string;
  isWorkspaceBound?: boolean;
  messages?: { text: string }[];
  changes?: SessionFileChange[];
}
