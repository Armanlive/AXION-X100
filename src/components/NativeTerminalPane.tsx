import {GhostOperatorPanel} from './GhostOperatorPanel';
import React, { useEffect, useRef, useState } from 'react';
import { TerminalSession } from '../types';
import { getPty, mountPty, openPty, sendPty, hasNativeTerminal } from '../utils/nativeTerminal';
import { Play, Square, Eraser, TerminalSquare } from 'lucide-react';

export function NativeTerminalPane({session}: {session: TerminalSession}) {
  const container = useRef<HTMLDivElement>(null);
  const [, update] = useState(0);
  const view = getPty(session.id);
  useEffect(() => {
    const refresh = () => update(n => n + 1); view.listeners.add(refresh);
    const unmount = mountPty(session.id, container.current!);
    return () => { view.listeners.delete(refresh); unmount(); };
  }, [session.id, view]);
  const native = hasNativeTerminal();
  return <section aria-label={`${session.name} terminal`} className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#080c12] select-text">
    <div className="min-h-8 px-3 flex items-center justify-between gap-2 border-b border-slate-800/70 text-[11px]">
      <span className="truncate text-slate-400" title={view.cwd || session.cwd}><span className="text-cyan-300 mr-2">{session.name}</span>{view.cwd || 'Workspace shell'}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span role="status" className="text-slate-500">{view.status === 'running' ? 'Shell running' : view.status}</span>
        <button title="Clear scrollback" aria-label="Clear terminal scrollback" onClick={() => view.terminal.clear()} className="p-1.5 hover:text-cyan-200"><Eraser size={13}/></button>
        <button title="Send Ctrl+C" aria-label="Interrupt terminal" disabled={view.status !== 'running'} onClick={() => void sendPty(session.id, '\x03').catch(error => {view.message=String(error);update(n=>n+1);})} className="p-1.5 hover:text-amber-300 disabled:opacity-30"><Square size={12}/></button>
      </div>
    </div>
    <GhostOperatorPanel sessionId={session.id} view={view}/>
    <div ref={container} className={`flex-1 min-h-0 ${view.status === 'ready' ? 'hidden' : ''}`} />
    {view.message && <p role="status" className="px-3 py-2 text-xs text-amber-200 bg-amber-950/20 break-words">{view.message}</p>}
    {view.status !== 'running' && <div className={`flex items-center justify-center gap-4 px-5 py-4 ${view.status === 'ready' ? 'flex-1' : ''}`}>
      <TerminalSquare size={24} className="text-cyan-400 shrink-0"/>
      <div className="max-w-lg">
        <p className="text-sm text-slate-200">{native ? 'Your workspace. Your shell.' : 'Local terminal requires the desktop app'}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{native ? 'Open a manual shell in the selected workspace. Tabs keep their sessions when you hide this panel.' : 'This browser preview cannot start PowerShell or run local commands. Open AXION in Tauri to use the interactive terminal.'}</p>
      </div>
      {native && <button disabled={view.status==='opening'} onClick={() => void openPty(session.id,session.type).catch(error => {view.message=String(error);update(n=>n+1);})} className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 disabled:opacity-40"><Play size={12}/>{view.status==='opening'?'Opening…':'Open shell'}</button>}
    </div>}
  </section>;
}
