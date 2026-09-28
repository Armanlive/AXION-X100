import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { TerminalSession, PanelDockPosition, OutputLogEvent } from '../types';
import { AVAILABLE_SHELL_PROFILES } from '../utils/terminalService';
import {
  Terminal as TerminalIcon,
  Shield,
  Trash2,
  Filter,
  X,
  Maximize2,
  Minimize2,
  ChevronRight,
  Plus,
  Split,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Edit2,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Square,
  Search,
  FolderOpen,
  ArrowRight,
  Activity,
  Cpu,
  Lock,
  Globe
} from 'lucide-react';

interface TerminalAuditProps {
  isDockedPanel?: boolean;
}

export const TerminalAudit: React.FC<TerminalAuditProps> = ({ isDockedPanel = false }) => {
  const {
    terminalSessions,
    activeTerminalId,
    splitTerminalId,
    setActiveTerminalId,
    setSplitTerminalId,
    createTerminalSession,
    closeTerminalSession,
    renameTerminalSession,
    runCommandInSession,
    clearSessionLogs,
    killRunningProcessInSession,
    terminalActiveTab,
    setTerminalActiveTab,
    toggleTerminal,
    terminalDockPosition,
    setTerminalDockPosition,
    auditLogs,
    outputLogEvents,
    clearOutputLogs,
    pendingProposedCommand,
    approveProposedCommand,
    rejectProposedCommand,
    workspaceSwitchNotice,
    dismissWorkspaceSwitchNotice,
    startTerminalInNewWorkspace,
    detectedDevServerUrl,
    togglePreviewPanel,
    activeWorkspace,
    projectPath
  } = useAxionStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'SUCCESS' | 'WARN' | 'BLOCKED'>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [outputCategoryFilter, setOutputCategoryFilter] = useState<string>('ALL');
  const [outputSearchQuery, setOutputSearchQuery] = useState('');
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isDockMenuOpen, setIsDockMenuOpen] = useState(false);

  const activeSession =
    terminalSessions.find((s) => s.id === activeTerminalId) || terminalSessions[0];
  const splitSession =
    terminalSessions.find((s) => s.id === splitTerminalId);

  const isTauriDesktop = typeof window !== 'undefined' && Boolean((window as any).__TAURI__);

  const handleStartRename = (session: TerminalSession) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingName.trim()) {
      renameTerminalSession(sessionId, editingName.trim());
    }
    setEditingSessionId(null);
  };

  const handleToggleSplit = () => {
    if (splitTerminalId) {
      setSplitTerminalId(null);
    } else {
      const other = terminalSessions.find((s) => s.id !== activeTerminalId);
      if (other) {
        setSplitTerminalId(other.id);
      } else {
        const newId = createTerminalSession('OpenCode', 'opencode');
        setSplitTerminalId(newId);
      }
    }
  };

  // Filter audit logs
  const filteredAudits = useMemo(() => {
    return auditLogs.filter((a) => {
      const matchStatus = auditFilter === 'ALL' || a.status === auditFilter;
      const matchSearch =
        !auditSearchQuery.trim() ||
        a.details.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        a.actor.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        a.action.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        (a.command && a.command.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (a.targetPath && a.targetPath.toLowerCase().includes(auditSearchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [auditLogs, auditFilter, auditSearchQuery]);

  // Filter output logs
  const filteredOutputs = useMemo(() => {
    return outputLogEvents.filter((ev) => {
      const matchCat = outputCategoryFilter === 'ALL' || ev.category === outputCategoryFilter;
      const matchSearch =
        !outputSearchQuery.trim() ||
        ev.message.toLowerCase().includes(outputSearchQuery.toLowerCase()) ||
        (ev.details && ev.details.toLowerCase().includes(outputSearchQuery.toLowerCase())) ||
        ev.category.toLowerCase().includes(outputSearchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [outputLogEvents, outputCategoryFilter, outputSearchQuery]);

  return (
    <div
      className={`flex flex-col bg-[#070709] border-zinc-800 text-zinc-300 font-mono text-xs select-none h-full w-full overflow-hidden ${
        isMaximized ? 'fixed inset-0 z-50 bg-[#070709]' : ''
      }`}
    >
      {/* VS Code-style Master Panel Header */}
      <div className="h-8 px-2.5 bg-[#0d0d10] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        {/* Panel Views: TERMINAL | OUTPUT | AUDIT */}
        <div className="flex items-center gap-4 text-[11px] uppercase tracking-wider font-mono">
          <button
            onClick={() => setTerminalActiveTab('terminal')}
            className={`h-8 flex items-center gap-1.5 transition border-b-2 font-medium ${
              terminalActiveTab === 'terminal'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
            <span className="text-[10px] text-zinc-500 font-sans">({terminalSessions.length})</span>
            {terminalSessions.some((s) => s.status === 'running') && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setTerminalActiveTab('output')}
            className={`h-8 flex items-center gap-1.5 transition border-b-2 font-medium ${
              terminalActiveTab === 'output'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Output</span>
            <span className="text-[10px] text-zinc-500 font-sans">({outputLogEvents.length})</span>
          </button>

          <button
            onClick={() => setTerminalActiveTab('audit')}
            className={`h-8 flex items-center gap-1.5 transition border-b-2 font-medium ${
              terminalActiveTab === 'audit'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Audit</span>
            <span className="text-[10px] text-zinc-500 font-sans">({auditLogs.length})</span>
          </button>
        </div>

        {/* Runtime Environment Tag & Controls */}
        <div className="flex items-center gap-2">
          {/* Real Runtime Environment Badge */}
          <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isTauriDesktop ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-emerald-400'
              }`}
            />
            <span>{isTauriDesktop ? 'LOCAL TERMINAL (PowerShell)' : 'WEB SANDBOX (Node 20)'}</span>
          </div>

          {/* Dev server live notification shortcut */}
          {detectedDevServerUrl && (
            <button
              onClick={() => togglePreviewPanel(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/80 transition animate-pulse"
              title="Dev server detected. Click to open Preview"
            >
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Dev Server Active</span>
              <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-80" />
            </button>
          )}

          {terminalActiveTab === 'terminal' && (
            <>
              {/* Split Terminal Button */}
              <button
                onClick={handleToggleSplit}
                className={`p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition ${
                  splitTerminalId ? 'bg-zinc-800 text-white' : ''
                }`}
                title={splitTerminalId ? 'Unsplit terminal' : 'Split terminal'}
              >
                <Split className="w-3.5 h-3.5" />
              </button>

              {/* Kill Active Terminal */}
              <button
                onClick={() => closeTerminalSession(activeTerminalId)}
                className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                title="Kill active terminal session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="h-3 w-[1px] bg-zinc-800 mx-0.5" />

              {/* Dock Position Switcher */}
              <div className="relative">
                <button
                  onClick={() => setIsDockMenuOpen(!isDockMenuOpen)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-0.5"
                  title={`Dock position: ${terminalDockPosition}`}
                >
                  {terminalDockPosition === 'bottom' && <PanelBottom className="w-3.5 h-3.5" />}
                  {terminalDockPosition === 'left' && <PanelLeft className="w-3.5 h-3.5" />}
                  {terminalDockPosition === 'right' && <PanelRight className="w-3.5 h-3.5" />}
                </button>

                {isDockMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-[#141417] border border-zinc-800 rounded-lg shadow-xl p-1 z-50 animate-in fade-in duration-100">
                    <div className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
                      Panel Position
                    </div>
                    {(['bottom', 'left', 'right'] as PanelDockPosition[]).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => {
                          setTerminalDockPosition(pos);
                          setIsDockMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition capitalize ${
                          terminalDockPosition === pos
                            ? 'bg-zinc-800 text-white font-medium'
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                        }`}
                      >
                        {pos === 'bottom' && <PanelBottom className="w-3 h-3" />}
                        {pos === 'left' && <PanelLeft className="w-3 h-3" />}
                        {pos === 'right' && <PanelRight className="w-3 h-3" />}
                        <span>{pos}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Maximize / Restore */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title={isMaximized ? 'Restore panel' : 'Maximize panel'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close Panel */}
          {isDockedPanel && (
            <button
              onClick={() => toggleTerminal(false)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Safety Gate Banner for Proposed Commands */}
      {pendingProposedCommand && (
        <div
          className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150 ${
            pendingProposedCommand.isDangerous
              ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
              : 'bg-cyan-950/40 border-cyan-800/80 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {pendingProposedCommand.isDangerous ? (
              <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-[11px]">
                  {pendingProposedCommand.isDangerous
                    ? '⚠️ DANGEROUS COMMAND SAFETY GATE'
                    : '⚡ COMMAND EXECUTION CONFIRMATION'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-zinc-300 border border-zinc-700">
                  {pendingProposedCommand.origin} ({pendingProposedCommand.agentName || 'Boss Agent'})
                </span>
              </div>
              <div className="text-[11px] text-zinc-300 flex items-center gap-2 mt-0.5">
                <span className="text-zinc-400">Command:</span>
                <code className="bg-black/60 px-1.5 py-0.5 rounded text-white font-mono border border-zinc-700">
                  {pendingProposedCommand.command}
                </code>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400">CWD:</span>
                <span className="text-zinc-300 font-mono text-[10px]">{pendingProposedCommand.cwd}</span>
              </div>
              {pendingProposedCommand.isDangerous && pendingProposedCommand.riskReason && (
                <div className="text-[10px] text-rose-300 font-sans mt-0.5 font-medium">
                  Risk Reason: {pendingProposedCommand.riskReason}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={rejectProposedCommand}
              className="px-2.5 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => approveProposedCommand(pendingProposedCommand.isDangerous)}
              className={`px-3 py-1 rounded text-xs font-medium text-white shadow-sm transition flex items-center gap-1.5 ${
                pendingProposedCommand.isDangerous
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
              }`}
            >
              <Play className="w-3 h-3" />
              <span>{pendingProposedCommand.isDangerous ? 'Run Anyway (Override)' : 'Run Command'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Workspace Switch Notification Banner */}
      {workspaceSwitchNotice && (
        <div className="px-3 py-1.5 bg-amber-950/40 border-b border-amber-800/60 flex items-center justify-between text-amber-200 text-[11px] shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Workspace changed to:{' '}
              <strong className="text-amber-100 font-mono">{workspaceSwitchNotice.newWorkspace}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startTerminalInNewWorkspace}
              className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-semibold text-[10px] transition"
            >
              Start Terminal in New Workspace
            </button>
            <button
              onClick={dismissWorkspaceSwitchNotice}
              className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-200 text-[10px]"
            >
              Keep Existing
            </button>
          </div>
        </div>
      )}

      {/* Terminal View Body */}
      {terminalActiveTab === 'terminal' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070709]">
          {/* Terminal Session Tabs Strip (Multiple Terminals) */}
          <div className="h-7 px-2 bg-[#0a0a0c] border-b border-zinc-850 flex items-center justify-between overflow-x-auto shrink-0 select-none">
            <div className="flex items-center gap-1 overflow-x-auto">
              {terminalSessions.map((session) => {
                const isActive = session.id === activeTerminalId;
                const isSplit = session.id === splitTerminalId;
                const isEditing = editingSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveTerminalId(session.id)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700/60 shadow-sm'
                        : isSplit
                        ? 'bg-zinc-850/80 text-zinc-300 border border-zinc-700/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                    }`}
                  >
                    {/* Session status dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        session.status === 'running'
                          ? 'bg-emerald-400 animate-pulse'
                          : session.status === 'error'
                          ? 'bg-rose-400'
                          : session.status === 'terminated'
                          ? 'bg-zinc-600'
                          : 'bg-cyan-400'
                      }`}
                    />

                    <TerminalIcon className="w-3 h-3 text-zinc-400 shrink-0" />

                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(session.id);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          className="bg-[#121215] border border-zinc-600 rounded px-1 text-white text-[11px] focus:outline-none w-24"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveRename(session.id);
                          }}
                          className="hover:text-emerald-400"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(session);
                        }}
                        className="truncate max-w-[120px]"
                        title={`${session.name} (Double-click to rename)`}
                      >
                        {session.name}
                      </span>
                    )}

                    {isSplit && (
                      <span className="text-[9px] px-1 rounded bg-zinc-900 text-zinc-400 border border-zinc-700">
                        split
                      </span>
                    )}

                    {/* Rename icon */}
                    {!isEditing && isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(session);
                        }}
                        className="opacity-60 hover:opacity-100 hover:text-zinc-200 transition"
                        title="Rename terminal"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {/* Close tab */}
                    {terminalSessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTerminalSession(session.id);
                        }}
                        className="opacity-50 hover:opacity-100 hover:text-rose-400 transition ml-0.5"
                        title="Close terminal"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New Terminal (+) Button with shell profile picker */}
            <div className="relative shrink-0 ml-2">
              <button
                onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition flex items-center gap-0.5"
                title="New Terminal"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {isNewMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-[#141417] border border-zinc-800 rounded-lg shadow-2xl p-1 z-50 animate-in fade-in duration-100">
                  <div className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500 font-mono border-b border-zinc-800/80 mb-0.5">
                    Launch Shell Profile
                  </div>
                  {AVAILABLE_SHELL_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        createTerminalSession(profile.name, profile.shellType);
                        setIsNewMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <TerminalIcon className="w-3 h-3 text-zinc-400" />
                        <span>{profile.name}</span>
                      </div>
                      {profile.isDefault && (
                        <span className="text-[9px] text-zinc-500 font-mono">default</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Terminal Console Execution Surface (Supports Single or Split view) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Primary Active Session */}
            {activeSession && (
              <TerminalConsolePane
                session={activeSession}
                onRunCommand={(cmd) => runCommandInSession(activeSession.id, cmd, 'manual')}
                onClear={() => clearSessionLogs(activeSession.id)}
                onKill={() => killRunningProcessInSession(activeSession.id)}
                onOpenPreview={() => togglePreviewPanel(true)}
              />
            )}

            {/* Split Session if active */}
            {splitSession && (
              <div className="flex-1 flex border-l border-zinc-800 overflow-hidden">
                <TerminalConsolePane
                  session={splitSession}
                  isSplit={true}
                  onRunCommand={(cmd) => runCommandInSession(splitSession.id, cmd, 'manual')}
                  onClear={() => clearSessionLogs(splitSession.id)}
                  onKill={() => killRunningProcessInSession(splitSession.id)}
                  onClose={() => setSplitTerminalId(null)}
                  onOpenPreview={() => togglePreviewPanel(true)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output View: Structured Application Events */}
      {terminalActiveTab === 'output' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070709]">
          {/* Filter and search bar */}
          <div className="px-3 py-1.5 bg-[#0a0a0c] border-b border-zinc-850 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mr-1">
                Category:
              </span>
              {['ALL', 'BUILD', 'LINT', 'TEST', 'DEV_SERVER', 'WORKSPACE', 'PROCESS'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setOutputCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                    outputCategoryFilter === cat
                      ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-1.5" />
                <input
                  type="text"
                  value={outputSearchQuery}
                  onChange={(e) => setOutputSearchQuery(e.target.value)}
                  placeholder="Search outputs..."
                  className="bg-[#121215] border border-zinc-800 rounded pl-6 pr-2 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-36"
                />
              </div>
              <button
                onClick={clearOutputLogs}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition"
                title="Clear Output Stream"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Events Stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-1.5 text-zinc-300 select-text font-mono text-xs">
            {filteredOutputs.length === 0 ? (
              <div className="text-zinc-600 italic py-6 text-center text-xs">
                No structured output events match your filter.
              </div>
            ) : (
              filteredOutputs.map((ev) => (
                <div
                  key={ev.id}
                  className="px-2.5 py-1.5 rounded bg-[#0c0c0f] border border-zinc-850 hover:border-zinc-800 transition flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-500 text-[10px] shrink-0 mt-0.5">[{ev.timestamp}]</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${
                        ev.category === 'BUILD'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : ev.category === 'TEST'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : ev.category === 'LINT'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : ev.category === 'DEV_SERVER'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : ev.category === 'SECURITY'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {ev.category}
                    </span>
                    <div>
                      <div
                        className={`${
                          ev.level === 'ERROR'
                            ? 'text-rose-400 font-semibold'
                            : ev.level === 'WARN'
                            ? 'text-amber-400'
                            : ev.level === 'SUCCESS'
                            ? 'text-emerald-400'
                            : 'text-zinc-200'
                        }`}
                      >
                        {ev.message}
                      </div>
                      {ev.details && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">{ev.details}</div>
                      )}
                    </div>
                  </div>

                  {ev.exitCode !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                        ev.exitCode === 0
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                          : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                      }`}
                    >
                      exit: {ev.exitCode}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Audit View: Security Operations Trail */}
      {terminalActiveTab === 'audit' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070709]">
          {/* Audit Controls & Search */}
          <div className="px-3 py-1.5 bg-[#0a0a0c] border-b border-zinc-850 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-zinc-500 mr-1" />
              {(['ALL', 'SUCCESS', 'WARN', 'BLOCKED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAuditFilter(filter)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                    auditFilter === filter
                      ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-1.5" />
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="Search audit trail..."
                className="bg-[#121215] border border-zinc-800 rounded pl-6 pr-2 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-48"
              />
            </div>
          </div>

          {/* Audit Trail Table */}
          <div className="flex-1 overflow-auto select-text">
            <table className="w-full text-left font-mono text-[11px] border-collapse">
              <thead className="bg-[#0b0b0e] text-zinc-500 uppercase sticky top-0 border-b border-zinc-800 text-[10px]">
                <tr>
                  <th className="py-1.5 px-3">Status</th>
                  <th className="py-1.5 px-3">Timestamp</th>
                  <th className="py-1.5 px-3">Actor</th>
                  <th className="py-1.5 px-3">Action</th>
                  <th className="py-1.5 px-3">Command / Target</th>
                  <th className="py-1.5 px-3">Duration</th>
                  <th className="py-1.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredAudits.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/40">
                    <td className="py-1.5 px-3">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'WARN'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-zinc-500 shrink-0">
                      {log.timestamp.includes('T')
                        ? log.timestamp.split('T')[1]?.slice(0, 8)
                        : log.timestamp}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-zinc-300">{log.actor}</td>
                    <td className="py-1.5 px-3 text-zinc-400 text-[10px]">{log.action}</td>
                    <td className="py-1.5 px-3 text-zinc-300 font-mono truncate max-w-xs">
                      {log.command ? (
                        <span className="text-cyan-300">{log.command}</span>
                      ) : (
                        log.targetPath || '—'
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-zinc-500 text-[10px]">
                      {log.durationMs !== undefined ? `${log.durationMs}ms` : '—'}
                    </td>
                    <td className="py-1.5 px-3 text-zinc-400 truncate max-w-sm">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: Individual Console Window for a Terminal Session
interface TerminalConsolePaneProps {
  session: TerminalSession;
  isSplit?: boolean;
  onRunCommand: (command: string) => void;
  onClear: () => void;
  onKill: () => void;
  onClose?: () => void;
  onOpenPreview?: () => void;
}

const TerminalConsolePane: React.FC<TerminalConsolePaneProps> = ({
  session,
  isSplit = false,
  onRunCommand,
  onClear,
  onKill,
  onClose,
  onOpenPreview
}) => {
  const [cmdInput, setCmdInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [session.logs, autoScroll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim() || session.status === 'running') return;
    onRunCommand(cmdInput);
    setCmdInput('');
    setHistoryIndex(-1);
  };

  // Up/Down History Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = session.history || [];
      if (hist.length === 0) return;
      const nextIdx = historyIndex === -1 ? hist.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setCmdInput(hist[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = session.history || [];
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= hist.length) {
        setHistoryIndex(-1);
        setCmdInput('');
      } else {
        setHistoryIndex(nextIdx);
        setCmdInput(hist[nextIdx] || '');
      }
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && session.status === 'running') {
      e.preventDefault();
      onKill();
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(session.logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070709] relative">
      {/* Pane Sub-header */}
      <div className="px-3 py-1 bg-[#09090b] border-b border-zinc-850 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200">{session.name}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
            {session.shell || session.type}
          </span>
          <span className="text-[10px] text-zinc-500 font-sans hidden md:inline truncate max-w-xs" title={session.cwd}>
            {session.cwd}
          </span>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-1.5">
          {session.status === 'running' && (
            <button
              onClick={onKill}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900 transition flex items-center gap-1"
              title="Terminate running process (Ctrl+C)"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Kill / Ctrl+C</span>
            </button>
          )}

          <button
            onClick={() => onRunCommand('npm run build')}
            disabled={session.status === 'running'}
            className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition disabled:opacity-50"
          >
            build
          </button>
          <button
            onClick={() => onRunCommand('npm test')}
            disabled={session.status === 'running'}
            className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition disabled:opacity-50"
          >
            test
          </button>
          <button
            onClick={() => onRunCommand('git status')}
            disabled={session.status === 'running'}
            className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition disabled:opacity-50"
          >
            git
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Copy terminal logs"
          >
            {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
          </button>

          <button
            onClick={onClear}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Clear output"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>

          {isSplit && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
              title="Close split pane"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Logs stream with ANSI color rendering */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1 text-zinc-300 leading-relaxed select-text font-mono text-xs">
        {session.logs.map((log, idx) => {
          const isCommand = log.startsWith('>');
          const isError =
            log.includes('error') ||
            log.includes('Build failed') ||
            log.includes('FATAL') ||
            log.includes('FAILED');
          const isSuccess =
            log.includes('Success') ||
            log.includes('PASS') ||
            log.includes('Clean') ||
            log.includes('built in') ||
            log.includes('Zero type errors');
          const isUrl = log.includes('http://localhost:') || log.includes('http://127.0.0.1:');

          return (
            <div
              key={idx}
              className={`${
                isCommand
                  ? 'text-cyan-300 font-bold mt-1.5 flex items-center gap-1.5'
                  : isError
                  ? 'text-rose-400 bg-rose-950/20 px-1.5 py-0.5 rounded'
                  : isSuccess
                  ? 'text-emerald-400'
                  : isUrl
                  ? 'text-amber-300 font-medium'
                  : 'text-zinc-400'
              }`}
            >
              {isCommand && <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0" />}
              <span>{log}</span>
              {isUrl && onOpenPreview && (
                <button
                  onClick={onOpenPreview}
                  className="ml-2 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] inline-flex items-center gap-1 font-sans"
                >
                  <span>Open Preview</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {session.status === 'running' && (
          <div className="flex items-center gap-2 text-emerald-400 text-xs py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Running: {session.activeProcessName || 'Executing process...'} (Ctrl+C to cancel)</span>
          </div>
        )}

        <div ref={logEndRef} />
      </div>

      {/* Command Prompt Form: PS C:\Path> _ */}
      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-zinc-850 bg-[#09090b] flex items-center gap-2 shrink-0"
      >
        <span className="text-zinc-500 font-mono text-xs flex items-center gap-1 shrink-0">
          <span className="text-cyan-400 font-medium truncate max-w-[200px]" title={session.cwd}>
            {session.type === 'powershell'
              ? `PS ${session.cwd}>`
              : session.type === 'cmd'
              ? `${session.cwd}>`
              : `${session.cwd} $`}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={session.status === 'running'}
          placeholder={
            session.status === 'running'
              ? 'Process running... (Press Ctrl+C to abort)'
              : 'Run command (e.g. npm run dev, npm run build, git status, npm test)...'
          }
          className="flex-1 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none placeholder-zinc-600 disabled:opacity-50"
        />
        {session.status === 'running' && (
          <button
            type="button"
            onClick={onKill}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-900/60 text-rose-200 border border-rose-700/80 hover:bg-rose-800 transition"
          >
            Cancel (Ctrl+C)
          </button>
        )}
      </form>
    </div>
  );
};
