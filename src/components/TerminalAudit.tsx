import React, { useState, useRef, useEffect } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { TerminalSession, PanelDockPosition } from '../types';
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
  Layers
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
    terminalActiveTab,
    setTerminalActiveTab,
    toggleTerminal,
    terminalDockPosition,
    setTerminalDockPosition,
    auditLogs
  } = useAxionStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'SUCCESS' | 'WARN' | 'BLOCKED'>('ALL');
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isDockMenuOpen, setIsDockMenuOpen] = useState(false);

  const activeSession =
    terminalSessions.find((s) => s.id === activeTerminalId) || terminalSessions[0];
  const splitSession =
    terminalSessions.find((s) => s.id === splitTerminalId);

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
      // Pick another session, or create one if only 1 exists
      const other = terminalSessions.find((s) => s.id !== activeTerminalId);
      if (other) {
        setSplitTerminalId(other.id);
      } else {
        const newId = createTerminalSession('OpenCode', 'opencode');
        setSplitTerminalId(newId);
      }
    }
  };

  const filteredAudits = auditLogs.filter(
    (a) => auditFilter === 'ALL' || a.status === auditFilter
  );

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
                ? 'border-zinc-200 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
            <span className="text-[10px] text-zinc-500 font-sans">({terminalSessions.length})</span>
          </button>

          <button
            onClick={() => setTerminalActiveTab('output')}
            className={`h-8 flex items-center gap-1.5 transition border-b-2 font-medium ${
              terminalActiveTab === 'output'
                ? 'border-zinc-200 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>Output</span>
          </button>

          <button
            onClick={() => setTerminalActiveTab('audit')}
            className={`h-8 flex items-center gap-1.5 transition border-b-2 font-medium ${
              terminalActiveTab === 'audit'
                ? 'border-zinc-200 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Audit</span>
            <span className="text-[10px] text-zinc-500 font-sans">({auditLogs.length})</span>
          </button>
        </div>

        {/* Master Panel Right Controls */}
        <div className="flex items-center gap-1.5">
          {terminalActiveTab === 'audit' && (
            <div className="flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-zinc-500 mr-0.5" />
              {(['ALL', 'SUCCESS', 'WARN', 'BLOCKED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAuditFilter(filter)}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono transition ${
                    auditFilter === filter
                      ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}

          {terminalActiveTab === 'terminal' && (
            <>
              {/* Split Terminal Button */}
              <button
                onClick={handleToggleSplit}
                className={`p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition ${
                  splitTerminalId ? 'bg-zinc-800 text-white' : ''
                }`}
                title={splitTerminalId ? 'Unsplit terminal' : 'Split terminal (Ctrl+\\)'}
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
                        className="truncate max-w-[110px]"
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

            {/* New Terminal (+) Button with type dropdown */}
            <div className="relative shrink-0 ml-2">
              <button
                onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition flex items-center gap-0.5"
                title="New Terminal"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {isNewMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#141417] border border-zinc-800 rounded-lg shadow-2xl p-1 z-50 animate-in fade-in duration-100">
                  <div className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500 font-mono border-b border-zinc-800/80 mb-0.5">
                    Launch Session
                  </div>
                  {[
                    { label: 'PowerShell Session', type: 'powershell' as const },
                    { label: 'OpenCode CLI', type: 'opencode' as const },
                    { label: 'Gemini CLI Agent', type: 'gemini-cli' as const },
                    { label: 'Bash / Native Shell', type: 'bash' as const },
                    { label: 'Custom CLI Tool', type: 'custom' as const }
                  ].map((preset) => (
                    <button
                      key={preset.type}
                      onClick={() => {
                        createTerminalSession(preset.label.replace(' Session', '').replace(' Agent', ''), preset.type);
                        setIsNewMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition flex items-center gap-1.5"
                    >
                      <TerminalIcon className="w-3 h-3 text-zinc-400" />
                      <span>{preset.label}</span>
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
                onRunCommand={(cmd) => runCommandInSession(activeSession.id, cmd)}
                onClear={() => clearSessionLogs(activeSession.id)}
              />
            )}

            {/* Split Session if active */}
            {splitSession && (
              <div className="flex-1 flex border-l border-zinc-800 overflow-hidden">
                <TerminalConsolePane
                  session={splitSession}
                  isSplit={true}
                  onRunCommand={(cmd) => runCommandInSession(splitSession.id, cmd)}
                  onClear={() => clearSessionLogs(splitSession.id)}
                  onClose={() => setSplitTerminalId(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output View: Vite / Diagnostic Stream */}
      {terminalActiveTab === 'output' && (
        <div className="flex-1 p-3 overflow-y-auto space-y-1 text-zinc-400 select-text font-mono text-xs bg-[#070709]">
          <div className="text-zinc-500 pb-2 mb-2 border-b border-zinc-800 flex items-center justify-between">
            <span>[Vite & React DevServer Diagnostic Stream]</span>
            <span className="text-emerald-400 font-sans text-[11px]">0 Errors • In Sync</span>
          </div>
          <div className="text-zinc-500 leading-relaxed">
            [axion-native] Initializing sandbox environment...<br />
            [axion-native] Strict subfolder write boundary active: E:\Projects\nexus-core<br />
            [axion-compiler] Ready for local prompts and tool invocation.
          </div>
        </div>
      )}

      {/* Audit View: Security Operations Trail */}
      {terminalActiveTab === 'audit' && (
        <div className="flex-1 overflow-auto bg-[#070709] select-text">
          <table className="w-full text-left font-mono text-[11px] border-collapse">
            <thead className="bg-[#0b0b0e] text-zinc-500 uppercase sticky top-0 border-b border-zinc-800">
              <tr>
                <th className="py-1.5 px-3">Status</th>
                <th className="py-1.5 px-3">Timestamp</th>
                <th className="py-1.5 px-3">Actor</th>
                <th className="py-1.5 px-3">Action</th>
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
                  <td className="py-1.5 px-3 text-zinc-500">{log.timestamp.split('T')[1]?.slice(0, 8) || log.timestamp}</td>
                  <td className="py-1.5 px-3 font-semibold text-zinc-300">{log.actor}</td>
                  <td className="py-1.5 px-3 text-zinc-400">{log.action}</td>
                  <td className="py-1.5 px-3 text-zinc-300 truncate max-w-xs">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  onClose?: () => void;
}

const TerminalConsolePane: React.FC<TerminalConsolePaneProps> = ({
  session,
  isSplit = false,
  onRunCommand,
  onClear,
  onClose
}) => {
  const [cmdInput, setCmdInput] = useState('');
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [session.logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    onRunCommand(cmdInput);
    setCmdInput('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070709] relative">
      {/* Pane Sub-header */}
      <div className="px-3 py-1 bg-[#09090b] border-b border-zinc-850 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-300">{session.name}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
            {session.type}
          </span>
          <span className="text-[10px] text-zinc-600 font-sans hidden sm:inline">
            (Client Sandbox Preview • Native Process Hook Ready)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRunCommand('npm run build')}
            className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            build
          </button>
          <button
            onClick={() => onRunCommand('npm test')}
            className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            test
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

      {/* Logs stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1 text-zinc-300 leading-relaxed select-text font-mono text-xs">
        {session.logs.map((log, idx) => {
          const isCommand = log.startsWith('>');
          const isError = log.includes('error') || log.includes('Build failed') || log.includes('FATAL');
          const isSuccess = log.includes('Success') || log.includes('PASS') || log.includes('Clean');

          return (
            <div
              key={idx}
              className={`${
                isCommand
                  ? 'text-zinc-100 font-bold mt-1.5 flex items-center gap-1.5'
                  : isError
                  ? 'text-rose-400 bg-rose-950/20 px-1.5 py-0.5 rounded'
                  : isSuccess
                  ? 'text-emerald-400'
                  : 'text-zinc-400'
              }`}
            >
              {isCommand && <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />}
              <span>{log}</span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* Command Prompt Form: PS > _ */}
      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-zinc-850 bg-[#09090b] flex items-center gap-2 shrink-0"
      >
        <span className="text-zinc-500 font-mono text-xs flex items-center gap-1 shrink-0">
          <span>{session.type === 'powershell' ? 'PS' : session.type === 'bash' ? '$' : '>'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        </span>
        <input
          type="text"
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          placeholder={`Run command in ${session.name} (e.g. npm test, git status, cat src/App.tsx)...`}
          className="flex-1 bg-transparent text-zinc-200 font-mono text-xs focus:outline-none placeholder-zinc-600"
        />
      </form>
    </div>
  );
};
