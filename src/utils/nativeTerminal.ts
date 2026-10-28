import {GhostMonitor, type GhostProposal} from './ghostMonitor';
import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export type PtyStatus = 'ready' | 'opening' | 'running' | 'exited' | 'error';
type Event = { kind: 'data'; bytes: number[] } | { kind: 'exit'; code: number | null } | { kind: 'error'; message: string };
export interface PtyView {
  terminal: Terminal; fit: FitAddon; host: HTMLDivElement; id?: string;
  status: PtyStatus; message: string; cwd: string; listeners: Set<() => void>;
  monitor: GhostMonitor; ghost: {log:string; auto:boolean; status:string; revision:number; proposal?:GhostProposal; lastRequest:number};
  ready?: Promise<void>; writes: Promise<void>; pendingAck: number; disposed: boolean;
}
const terminals = new Map<string, PtyView>();
let ghostBusy=false;
export async function requestGhostAnalysis(key:string){
 const view=terminals.get(key);if(!view||!view.ghost.log)return;
 if(ghostBusy||Date.now()-view.ghost.lastRequest<30000){view.ghost.status='Analysis paused: wait 30 seconds between requests, then choose Analyze.';notify(view);return;}
 const revision=view.ghost.revision;const log=view.ghost.log;view.ghost.lastRequest=Date.now();view.ghost.status='Analyzing captured error…';ghostBusy=true;notify(view);
 try{const {analyzeGhostError}=await import('./ghostAnalysis');const proposal=await analyzeGhostError(log,view.cwd);if(!view.disposed&&revision===view.ghost.revision){view.ghost.proposal=proposal;view.ghost.status='Proposal only — unverified';}}
 catch(error){if(!view.disposed&&revision===view.ghost.revision)view.ghost.status=error instanceof Error?error.message:'Analysis failed.';}
 finally{ghostBusy=false;if(!view.disposed)notify(view);}
}
export function rejectGhost(key:string){const view=terminals.get(key);if(!view)return;view.ghost.revision++;view.ghost.log='';view.ghost.proposal=undefined;view.ghost.status='Rejected / dismissed. No files changed.';notify(view);}
export function setGhostAuto(key:string,enabled:boolean){const view=terminals.get(key);if(!view)return;view.ghost.auto=enabled;if(!enabled)view.ghost.revision++;notify(view);}
export const hasNativeTerminal = () => isTauri();
const notify = (view: PtyView) => view.listeners.forEach(fn => fn());
function fail(view: PtyView, error: unknown) {
  view.message = String(error); view.status = 'error'; notify(view);
}
export function getPty(key: string): PtyView {
  let view = terminals.get(key);
  if (view) return view;
  const terminal = new Terminal({ cursorBlink: true, fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 13,
    lineHeight: 1.25, scrollback: 5000, allowProposedApi: false, screenReaderMode: true,
    theme: { background: '#080c12', foreground: '#d6e2ee', cursor: '#39d9f4', selectionBackground: '#174467',
      black: '#192431', red: '#ff7d83', green: '#7cdbac', yellow: '#efbf73', blue: '#63a7ff', magenta: '#c39bff', cyan: '#42d5ec', white: '#d6e2ee' } });
  const fit = new FitAddon(); terminal.loadAddon(fit);
  const host = document.createElement('div'); host.style.cssText = 'width:100%;height:100%;padding:6px 8px;box-sizing:border-box';
  const monitor=new GhostMonitor(log=>{const current=terminals.get(key);if(!current||current.disposed)return;current.ghost.log=log;current.ghost.proposal=undefined;current.ghost.revision++;current.ghost.status='Error captured locally';notify(current);if(current.ghost.auto)void requestGhostAnalysis(key);});
  view = { monitor, ghost:{log:'',auto:false,status:'Watching terminal output locally',revision:0,lastRequest:0}, terminal, fit, host, status: 'ready', message: '', cwd: '', listeners: new Set(), writes: Promise.resolve(), pendingAck: 0, disposed: false };
  terminals.set(key, view);
  const entry = view;
  terminal.onData(data => { if (entry.status === 'running') void sendPty(key, data).catch(error => fail(entry, error)); });
  terminal.onResize(({cols, rows}) => { if (entry.id && entry.status === 'running') void invoke('terminal_resize', {id: entry.id, cols, rows}).catch(error => fail(entry, error)); });
  // Ctrl+C interrupts when no selection; with selected text it copies normally.
  terminal.attachCustomKeyEventHandler(event => !(event.type === 'keydown' && event.ctrlKey && event.key.toLowerCase() === 'c' && terminal.hasSelection()));
  return view;
}
export function mountPty(key: string, container: HTMLElement): () => void {
  const view = getPty(key); container.appendChild(view.host);
  if (!view.terminal.element) view.terminal.open(view.host);
  const fit = () => { if (container.clientWidth > 20 && container.clientHeight > 20) view.fit.fit(); };
  const observer = new ResizeObserver(fit); observer.observe(container); fit();
  return () => { observer.disconnect(); view.host.remove(); };
}
function ack(view: PtyView, bytes: number) {
  if (view.disposed) return;
  if (!view.id) { view.pendingAck += bytes; return; }
  void invoke('terminal_ack', {id: view.id, bytes}).catch(() => { /* Native EOF can retire the session before final render acknowledgement. */ });
}
export async function openPty(key: string, profile: string): Promise<void> {
  const view = getPty(key);
  if (!hasNativeTerminal()) { fail(view, 'Local shells require the AXION desktop app. Browser preview cannot run commands.'); return; }
  if (view.status === 'opening' || view.status === 'running') return;
  if (view.id) await invoke('terminal_close', {id: view.id});
  view.monitor.reset();view.ghost.revision++;view.ghost.log='';view.ghost.proposal=undefined;
  view.writes = Promise.resolve(); view.terminal.reset();
  view.id = undefined; view.pendingAck = 0; view.message = ''; view.status = 'opening'; notify(view);
  const output = new Channel<Event>();
  const decoder=new TextDecoder();
  output.onmessage = event => {
    if (view.disposed) return;
    if (event.kind === 'data') {const bytes=new Uint8Array(event.bytes);view.monitor.feed(decoder.decode(bytes,{stream:true}));view.terminal.write(bytes, () => ack(view, event.bytes.length));}
    if (event.kind === 'exit') {
      view.monitor.feed(decoder.decode());if(event.code!==null&&event.code!==0)view.monitor.feed(`\nError: shell exited with code ${event.code} (not a per-command exit code).`);view.monitor.flush();
      view.status = 'exited'; view.message = event.code === null ? 'Shell exited; exit code unavailable.' : `Shell exited with code ${event.code}.`;
      view.terminal.writeln(`\r\n\x1b[90m[${view.message}]\x1b[0m`); notify(view);
    }
    if (event.kind === 'error') {view.monitor.feed('\nError: '+event.message);view.monitor.flush();fail(view, event.message);}
  };
  view.ready = (async () => {
    try {
      const result = await invoke<{id: string; cwd: string}>('terminal_open', {profile, cols: Math.max(2,view.terminal.cols), rows: Math.max(1,view.terminal.rows), output});
      view.id = result.id; view.cwd = result.cwd;
      if (view.pendingAck) { ack(view, view.pendingAck); view.pendingAck = 0; }
      if (view.status === 'opening') view.status = 'running';
      view.fit.fit(); view.terminal.focus(); notify(view);
    } catch (error) { fail(view, error); }
  })();
  await view.ready;
}
export async function sendPty(key: string, data: string): Promise<void> {
  const view = terminals.get(key);
  if (!view?.id || view.status !== 'running') throw new Error('No running native shell.');
  // Queue the whole paste atomically so subsequent keystrokes cannot interleave chunks.
  const id = view.id;
  view.writes = view.writes.then(async () => {
    for (let start = 0; start < data.length;) {
      if (view.disposed || view.id !== id || view.status !== 'running') throw new Error('Terminal session changed.');
      let end = Math.min(start + 8192, data.length);
      if (end < data.length && /[\uD800-\uDBFF]/.test(data[end - 1])) end--;
      const part = data.slice(start, end); start = end;
      await invoke<void>('terminal_write', {id, data: part});
    }
  });
  await view.writes;
}
export async function closePty(key: string): Promise<void> {
  const view = terminals.get(key); if (!view) return;
  await view.ready;
  if (view.id) await invoke('terminal_close', {id: view.id});
  view.monitor.reset();view.ghost.revision++;view.disposed = true; view.terminal.dispose(); view.host.remove(); terminals.delete(key);
}
export function clearPty(key: string) { terminals.get(key)?.terminal.clear(); }
