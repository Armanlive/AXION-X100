import React,{useEffect,useState} from 'react';
import {useProfileStore} from '../store/useProfileStore';
import {useAxionStore} from '../store/useAxionStore';
export function ProfileOnboarding(){
 const p=useProfileStore();const [answer,setAnswer]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [deleting,setDeleting]=useState(false);
 useEffect(()=>{p.initialize();},[]);
 useEffect(()=>{if(!p.open){setPassword('');setConfirm('');setAnswer('');}},[p.open]);
 const submit=(e:React.FormEvent)=>{e.preventDefault();if(!answer.trim())return;void useAxionStore.getState().executeUserPrompt(answer);setAnswer('');};
 return <aside aria-label="Personal profile" className="fixed right-3 top-14 z-40 max-w-md w-[calc(100%-1.5rem)] text-sm">
 {p.open&&
 <section className="max-h-[75vh] overflow-y-auto rounded-xl border border-cyan-900 bg-slate-950 p-5 shadow-2xl space-y-4">
 <div className="flex justify-between gap-3"><h2 className="font-semibold text-cyan-200">Let's make AXION yours</h2><button onClick={p.pause} aria-label="Pause profile interview" className="text-slate-400">Later / close</button></div>
 <p role="status" className="leading-relaxed text-slate-200">{p.message}</p>
 <p className="text-xs text-slate-400">Optional. Answers stay out of chat history. Do not include passwords or API keys. You can answer here, in chat, or through an enabled Voice session.</p>
 {p.error&&<p role="alert" className="text-amber-300">{p.error}</p>}
 {!p.locked&&!p.profile&&p.stage<4&&<form onSubmit={submit} className="space-y-2"><label className="block" htmlFor="profile-answer">Your answer</label><textarea id="profile-answer" maxLength={1200} value={answer} onChange={e=>setAnswer(e.target.value)} className="w-full rounded bg-slate-900 border border-slate-700 p-2"/><div className="flex gap-3"><button type="submit" className="rounded bg-cyan-900 px-3 py-2">Continue</button><button type="button" onClick={()=>{void useAxionStore.getState().executeUserPrompt('skip');}}>Skip question</button><button type="button" onClick={()=>useAxionStore.getState().setSpeechMode('speech')}>Use voice</button></div></form>}
 {!p.locked&&p.stage===4&&!p.profile&&<>
 <dl className="space-y-2">{(['role','projects','help','style'] as const).map(key=><div key={key}><dt className="text-cyan-300 capitalize">{key}</dt><dd className="break-words whitespace-pre-wrap">{p.draft[key]||'Skipped'}</dd></div>)}</dl>
 <label className="flex gap-2 text-xs"><input type="checkbox" checked={p.draft.shareWithAI} onChange={e=>p.setSharing(e.target.checked)}/>Include this profile with future cloud AI requests to tailor responses. Otherwise it remains local.</label>
 <button onClick={p.edit} className="underline">Redo interview</button>
 </>}
 {(p.locked||p.stage===4&&!p.profile)&&<form className="space-y-2" onSubmit={async e=>{e.preventDefault();if(!p.locked&&password!==confirm){useProfileStore.setState({error:'Passphrases do not match.'});return;}const secret=password;setPassword('');setConfirm('');if(p.locked)await p.unlock(secret);else await p.save(secret);}}>
 <label htmlFor="profile-password">{p.locked?'Unlock passphrase':'New passphrase (12+ characters)'}</label><input id="profile-password" type="password" autoComplete={p.locked?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded bg-slate-900 border border-slate-700 p-2"/>
 {!p.locked&&<><label htmlFor="profile-confirm">Confirm passphrase</label><input id="profile-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded bg-slate-900 border border-slate-700 p-2"/></>}
 <p className="text-xs text-slate-400">Encrypted in this app's local storage. Unlock after restart. The passphrase is not saved or recoverable; clearing app/browser data removes the profile.</p>
 <button disabled={p.busy} className="rounded bg-cyan-900 px-3 py-2 disabled:opacity-50">{p.busy?'Working…':p.locked?'Unlock profile':'Save encrypted profile'}</button>
 {!p.locked&&<button type="button" disabled={p.busy} onClick={()=>{setPassword('');setConfirm('');p.useSession();}} className="ml-3 underline">Use for this session only</button>}
 </form>}
 {p.profile&&<div className="flex flex-wrap gap-3"><button onClick={p.pause}>Continue to workspace</button><button onClick={p.edit}>Update profile</button><button onClick={p.lock}>Lock profile</button></div>}
 {p.saved&&<div>{!deleting?<button onClick={()=>setDeleting(true)} className="text-slate-400 underline">Delete saved profile</button>:<><p>Delete this device's saved profile? This cannot be undone.</p><button onClick={()=>{p.forget();setDeleting(false);}} className="text-rose-300 mr-3">Delete profile permanently</button><button onClick={()=>setDeleting(false)}>Cancel</button></>}</div>}
 </section>}
 </aside>;
}
