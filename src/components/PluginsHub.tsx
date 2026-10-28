import React,{useEffect,useState} from 'react';
import {INTEGRATIONS,connections,connectIntegration,disconnectIntegration,requestIntegration,type IntegrationId,type IntegrationResult} from '../services/integrationService';
export function PluginsHub(){
 const [selected,setSelected]=useState<IntegrationId>('github'),[linked,setLinked]=useState<string[]>([]),[token,setToken]=useState('');
 const [project,setProject]=useState(''),[resource,setResource]=useState(''),[title,setTitle]=useState(''),[content,setContent]=useState('');
 const [status,setStatus]=useState('Load saved connections to begin.'),[busy,setBusy]=useState(false),[result,setResult]=useState<IntegrationResult|null>(null),[approved,setApproved]=useState(false);
 const entry=INTEGRATIONS.find(e=>e.id===selected)!;
 useEffect(()=>{void connections().then(setLinked).catch(e=>setStatus(String(e)));},[]);
 async function run(action:'connect'|'read'|'write'|'disconnect'){
  if(busy || (action==='write'&&!approved))return;
  setBusy(true);setResult(null);setStatus(action==='connect'?'🔑 Verifying service authentication…':action==='write'?'🛡️ Waiting for native write approval…':action==='read'?'📂 Reading accessible resources…':'Disconnecting…');
  try{
   if(action==='disconnect'){await disconnectIntegration(selected);setStatus('Disconnected. Saved credential removed.');}
   else {const data=action==='connect'?await connectIntegration(selected,token,project,resource):await requestIntegration(selected,action,resource,title,selected==='canva'?'Create blank design':content);setResult(data);setStatus(data.summary);}
   setToken('');setApproved(false);setLinked(await connections());
  }catch(e){setStatus(String(e));}finally{setBusy(false);}
 }
 return <section aria-label="Customize and Plugins" className="flex-1 overflow-auto p-5 space-y-4 bg-[#070b16]">
  <h1 className="text-xl text-cyan-100">Customize / Plugins</h1>
  <p className="text-sm text-slate-300">Connect your services, inspect accessible resources, and approve specific writes. Credentials stay in the Windows encrypted vault and are never sent to a conversation model.</p>
  <div className="flex flex-wrap gap-2">{INTEGRATIONS.map(p=><button key={p.id} disabled={busy} aria-pressed={p.id===selected} onClick={()=>{setSelected(p.id);setToken('');setProject('');setResource('');setTitle('');setContent('');setResult(null);setApproved(false);setStatus('Ready to configure '+p.name);}} className={`rounded border p-2 text-sm ${p.id===selected?'border-cyan-400':'border-slate-700'}`}>{p.name} · {linked.includes(p.id)?'Saved':'Not connected'}</button>)}</div>
  <h2 className="text-lg">{entry.name}</h2><p className="text-xs text-slate-300">Required access: {entry.scope}. OAuth tokens must be granted by the provider; expired or insufficient permissions require reconnection. No OAuth client or credential is bundled.</p>
  <label className="block text-sm">{entry.credential}<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} className="block w-full max-w-xl p-2 rounded bg-slate-900"/></label>
  {selected==='supabase'&&<label className="block text-sm">Project URL<input placeholder="https://PROJECT.supabase.co" value={project} onChange={e=>setProject(e.target.value)} className="block w-full max-w-xl p-2 bg-slate-900"/></label>}
  <label className="block text-sm">Resource · {entry.resource}<input value={resource} onChange={e=>setResource(e.target.value)} className="block w-full max-w-xl p-2 bg-slate-900"/></label>
  <div className="flex gap-4 text-sm"><button disabled={busy||!token.trim()} onClick={()=>void run('connect')}>Verify & connect</button><button disabled={busy||!linked.includes(selected)} onClick={()=>void run('read')}>Read accessible resources</button><button disabled={busy||!linked.includes(selected)} onClick={()=>void run('disconnect')}>Disconnect</button></div>
  <fieldset className="border border-slate-700 rounded p-3 space-y-2"><legend>{entry.write}</legend>
   <label className="block text-sm">Title / filename<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} className="block w-full max-w-xl p-2 bg-slate-900"/></label>
   {selected!=='canva'&&<label className="block text-sm">{selected==='supabase'?'JSON row object':'Content / description'}<textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={selected==='notion'?2000:5000} className="block w-full max-w-xl p-2 bg-slate-900"/></label>}
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I reviewed this operation and want to create it in {entry.name}.</label>
   <button disabled={busy||!approved||!linked.includes(selected)||!title.trim()||(selected!=='canva'&&!content.trim())} onClick={()=>void run('write')} className="rounded border border-cyan-500 px-3 py-2 disabled:opacity-40">{entry.write}</button>
  </fieldset>
  <p role="status" aria-live="polite" className="text-sm text-cyan-200 whitespace-pre-wrap">{status}</p>
  {result&&<ul className="text-sm space-y-2">{result.items.map((item,i)=><li key={`${item.id}-${i}`} className="border-b border-slate-800 py-2"><span>{item.title}</span><span className="block text-xs text-slate-400 break-all">{item.id}</span></li>)}</ul>}
 </section>;
}
