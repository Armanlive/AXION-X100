import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Terminal as TerminalIcon,
  Shield,
  Trash2,
  Play,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const TerminalAudit: React.FC = () => {
  const {
    terminalLogs,
    auditLogs,
    clearTerminal,
    runTerminalCommand
  } = useAxionStore();

  const [termCmd, setTermCmd] = useState('');
  const [activeTab, setActiveTab] = useState<'terminal' | 'audit'>('terminal');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'SUCCESS' | 'WARN' | 'BLOCKED'>('ALL');

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termCmd.trim()) return;
    runTerminalCommand(termCmd);
    setTermCmd('');
  };

  const filteredAudits = auditLogs.filter(
    (a) => auditFilter === 'ALL' || a.status === auditFilter
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-hidden select-none">
      {/* Tab Switcher & Actions */}
      <div className="px-4 py-2.5 bg-[#0d1424] border-b border-[#1b263b] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              activeTab === 'terminal'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#152035]'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Native Terminal Execution
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#152035]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Enterprise Operations Audit Trail
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {auditLogs.length}
            </span>
          </button>
        </div>

        {activeTab === 'terminal' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => runTerminalCommand('npm run build')}
              className="px-2.5 py-1 rounded bg-[#152238] hover:bg-[#1c2c47] text-slate-300 text-xs font-mono border border-[#233554] transition"
            >
              npm run build
            </button>
            <button
              onClick={() => runTerminalCommand('npm test')}
              className="px-2.5 py-1 rounded bg-[#152238] hover:bg-[#1c2c47] text-slate-300 text-xs font-mono border border-[#233554] transition"
            >
              npm test
            </button>
            <button
              onClick={clearTerminal}
              className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Clear Terminal Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {(['ALL', 'SUCCESS', 'WARN', 'BLOCKED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setAuditFilter(filter)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  auditFilter === filter
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Display Area */}
      {activeTab === 'terminal' ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14] font-mono text-xs">
          {/* Terminal Logs Output */}
          <div className="flex-1 p-4 overflow-y-auto space-y-1 text-slate-300 leading-relaxed select-text">
            {terminalLogs.map((log, idx) => {
              const isCommand = log.startsWith('>');
              const isError = log.includes('error') || log.includes('Build failed') || log.includes('FATAL');
              const isSuccess = log.includes('Success') || log.includes('PASS') || log.includes('Clean Restore');
              return (
                <div
                  key={idx}
                  className={`${
                    isCommand
                      ? 'text-sky-400 font-bold mt-2'
                      : isError
                      ? 'text-red-400 bg-red-950/20 px-2 py-0.5 rounded'
                      : isSuccess
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              );
            })}
          </div>

          {/* Terminal Input Bar */}
          <form
            onSubmit={handleCommandSubmit}
            className="p-3 bg-[#0d1424] border-t border-[#1a253a] flex items-center gap-2"
          >
            <span className="text-emerald-400 font-bold select-none">PS E:\Projects\nexus-core&gt;</span>
            <input
              type="text"
              value={termCmd}
              onChange={(e) => setTermCmd(e.target.value)}
              placeholder="Execute native command (e.g. npm run build, vitest, git status)..."
              className="flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none font-mono text-xs"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Audit Trail Table */
        <div className="flex-1 overflow-y-auto p-4 bg-[#0a0f1d]">
          <div className="rounded-xl border border-[#1d2c47] bg-[#0c1322] overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#10192c] border-b border-[#1c2940] text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172338]">
                {filteredAudits.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 text-slate-300">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {log.timestamp.split('T')[1]?.substring(0, 8) || log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {log.actor}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-blue-400 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[120px]">
                      {log.targetPath || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[280px]">
                      {log.details}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'BLOCKED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
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
