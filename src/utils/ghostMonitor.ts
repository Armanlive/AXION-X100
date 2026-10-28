/** Bounded, session-local observation only. Terminal text is untrusted data. */
export const MUTATION_BLOCK = 'Apply blocked: Phase-2 native recovery, atomic mutation and command verification are not available. No snapshot created; no files written; validation not run.';
export function redactLog(text: string): string {
 return text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'')
 .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'')
 .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,'[REDACTED PRIVATE KEY]')
 .replace(/\b(?:sk-|gsk_)[A-Za-z0-9_-]{12,}/g,'[REDACTED KEY]')
 .replace(/((?:api[_-]?key|token|password|secret|authorization)\s*[=:]\s*)([^\s,;]+)/gi,'$1[REDACTED]')
 .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi,'Bearer [REDACTED]');
}
export function isErrorOutput(text: string): boolean {
 return /error(?:\[E\d+\]|\s+TS\d+|:)|Traceback \(most recent call last\)|(?:Type|Reference|Syntax|Value|Runtime|ModuleNotFound)Error:|unhandled (?:exception|rejection)|panicked at|failed to compile|compilation failed|build failed/iu.test(text);
}
export function safeContextPath(path: string): boolean {
 return !/^(?:[a-z]:|[\\/])/i.test(path)&&!path.split(/[\\/]/).some(x=>x==='..'||x.startsWith('.'))
 && /\.(?:tsx?|jsx?|rs|py|css|json|toml)$/i.test(path)
 && !/(?:secret|credential|token|password|lock|node_modules|target|dist)/i.test(path);
}
export interface GhostPatch {path:string;original:string;proposed:string}
export interface GhostProposal {summary:string;patches:GhostPatch[];validation:string}
export function parseGhostProposal(raw:string,files:Record<string,string>):GhostProposal {
 const value=JSON.parse(raw);
 if(!value||typeof value.summary!=='string'||typeof value.validation!=='string'||!Array.isArray(value.patches)||value.patches.length>3)throw Error('Invalid proposal');
 for(const p of value.patches){
  if(!p||typeof p.path!=='string'||!safeContextPath(p.path)||!Object.prototype.hasOwnProperty.call(files,p.path)||p.original!==files[p.path]||typeof p.proposed!=='string'||p.proposed.length>40000)throw Error('Proposal does not match supplied source');
 }
 if(new Set(value.patches.map((p:GhostPatch)=>p.path)).size!==value.patches.length)throw Error('Duplicate patch targets');
 return value;
}
export class GhostMonitor {
 private buffer='';private last='';private timer:ReturnType<typeof setTimeout>|undefined;private first=0;
 private emit:(log:string)=>void;
 constructor(emit:(log:string)=>void){this.emit=emit;}
 feed(text:string){
  this.buffer=(this.buffer+text).slice(-16000);
  if(!isErrorOutput(redactLog(this.buffer)))return;
  if(!this.first)this.first=Date.now();clearTimeout(this.timer);
  // Collect trace continuation, but do not wait forever on a noisy process.
  this.timer=setTimeout(()=>this.flush(),Math.min(600,Math.max(0,2000-(Date.now()-this.first))));
 }
 flush(){clearTimeout(this.timer);this.first=0;const log=redactLog(this.buffer);this.buffer='';if(log&&isErrorOutput(log)&&log!==this.last){this.last=log;this.emit(log);}}
 reset(){clearTimeout(this.timer);this.timer=undefined;this.buffer='';this.last='';this.first=0;}
}
