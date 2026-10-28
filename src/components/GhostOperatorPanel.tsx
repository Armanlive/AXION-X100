import React from 'react';
import {type PtyView,requestGhostAnalysis,rejectGhost,setGhostAuto} from '../utils/nativeTerminal';
import {MUTATION_BLOCK} from '../utils/ghostMonitor';
export function GhostOperatorPanel({sessionId,view}:{sessionId:string;view:PtyView}){
 const ghost=view.ghost;
 return <details className="border-b border-slate-800 px-3 py-2 text-xs max-h-[45vh] overflow-auto">
  <summary className="cursor-pointer text-cyan-200">Ghost Operator · {ghost.status}</summary>
  <div className="space-y-3 py-3">
   <p className="text-slate-400">Captures error-like terminal output locally while the shell runs, including when its panel is hidden. Detection is heuristic; a shell exit is not a build result.</p>
   <label className="flex gap-2 text-slate-300"><input type="checkbox" checked={ghost.auto} onChange={e=>setGhostAuto(sessionId,e.target.checked)}/>Automatically send future captured errors and up to 3 referenced source files to the configured Gemini provider.</label>
   <p className="text-slate-500">Known secrets are filtered; redaction cannot guarantee removal of every secret. Leave automatic analysis off to review logs first. No disk writes or command execution.</p>
   {ghost.log&&<><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all bg-black/30 p-2 text-amber-200">{ghost.log}</pre>
    <div className="flex gap-3"><button className="border border-cyan-700 rounded px-2 py-1" onClick={()=>void requestGhostAnalysis(sessionId)}>Analyze captured error</button><button className="border border-slate-600 rounded px-2 py-1" onClick={()=>rejectGhost(sessionId)}>Reject / dismiss</button></div></>}
   {ghost.proposal&&<>
    <p className="text-slate-200 whitespace-pre-wrap">{ghost.proposal.summary}</p>
    {ghost.proposal.patches.map(p=><section key={p.path} className="space-y-1"><h4 className="text-cyan-200">{p.path}</h4><div className="grid md:grid-cols-2 gap-2">{[['ORIGINAL — read from workspace',p.original],['PROPOSED — not applied',p.proposed]].map(([label,text])=><div key={label}><p className="text-slate-400">{label}</p><pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto p-2 bg-black/40 text-slate-200">{text}</pre></div>)}</div></section>)}
    <p className="text-slate-400">Suggested validation (not run): <code>{ghost.proposal.validation}</code></p>
    <button disabled className="border border-slate-600 rounded px-2 py-1 opacity-50">Apply Fix — unavailable</button>
   </>}
   <p role="status" className="text-amber-200">{MUTATION_BLOCK}</p>
  </div>
 </details>;
}
