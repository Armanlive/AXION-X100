import {hasProjectScope} from '../utils/workspaceScope';
import React,{useEffect,useRef,useState} from 'react';
import {useAxionStore} from '../store/useAxionStore';
import {useProfileStore} from '../store/useProfileStore';
import {globalVoiceEngine} from '../utils/voiceEngine';
export function PerceptionPanel(){
 const [open,setOpen]=useState(false);const [kind,setKind]=useState<'camera'|'screen'|null>(null);const [error,setError]=useState('');const [frame,setFrame]=useState(false);const [reviewed,setReviewed]=useState(false);const [prompt,setPrompt]=useState('What can you tell me about this image?');const [code,setCode]=useState(false);
 const stream=useRef<MediaStream|null>(null);const epoch=useRef(0);const video=useRef<HTMLVideoElement>(null);const canvas=useRef<HTMLCanvasElement>(null);const point=useRef<{x:number;y:number}|null>(null);
 const state=useAxionStore();
 useEffect(()=>{if(state.currentTab!=='code_studio')setCode(false);},[state.currentTab]);
 const stop=()=>{epoch.current++;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setKind(null);};
 const discard=()=>{setFrame(false);setReviewed(false);const c=canvas.current;if(c)c.getContext('2d')?.clearRect(0,0,c.width,c.height);};
 const stopAll=()=>{stop();discard();globalVoiceEngine.stopListening();globalVoiceEngine.synthesisAdapter.cancel();useAxionStore.setState({isMicMuted:true});};
 useEffect(()=>{const hide=()=>{if(document.hidden){stop();discard();}};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);epoch.current++;stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 const start=async(source:'camera'|'screen')=>{stop();discard();setError('');const token=epoch.current;
  try{const media=source==='camera'?await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
   if(token!==epoch.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;setKind(source);for(const track of media.getTracks())track.onended=()=>{if(stream.current===media){stop();discard();setError('Capture ended. Enable the camera or choose a screen to try again.');}};
   if(video.current){video.current.srcObject=media;await video.current.play();}
  }catch{if(token===epoch.current){stop();setError('Capture failed, was denied, or is unsupported in this runtime.');}}
 };
 const capture=()=>{const v=video.current,c=canvas.current;if(!v||!c||!v.videoWidth)return;const scale=Math.min(1,1280/v.videoWidth,720/v.videoHeight);c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);c.getContext('2d')?.drawImage(v,0,0,c.width,c.height);setFrame(true);setReviewed(false);};
 const position=(e:React.PointerEvent<HTMLCanvasElement>)=>{const c=e.currentTarget,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};};
 const send=async()=>{if(!reviewed||!canvas.current||state.isWorking)return;const selected=state.selectedFilePath;const content=state.unsavedFileChanges[selected]??state.files[selected];if(code&&!hasProjectScope(state.currentTab,state.chatSessions.find(s=>s.id===state.activeChatId),state.activeWorkspace?.id)){setError('Editor context is available only in the matching Code Studio project thread.');return;}if(code&&(!selected||typeof content!=='string')){setError('No loaded editor file is available.');return;}
  const data=canvas.current.toDataURL('image/jpeg',0.82).split(',')[1];useProfileStore.getState().pause();stop();discard();setOpen(false);
  try { await state.executeUserPrompt(prompt,false,{mimeType:'image/jpeg',data,codeContext:code?`${selected} (editor context, may be unsaved):\n${content.slice(0,5000)}`:undefined}); } catch { setOpen(true);setError('The frame could not be sent. Capture and review a new frame to retry.'); }
 };
 return <>
 <div className="fixed top-14 left-3 max-w-[calc(100vw-180px)] flex-wrap lg:max-w-none lg:top-1 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-50 flex gap-2 items-center text-[11px] bg-slate-950 rounded px-2 py-1">
 <button onClick={()=>{if(open){stop();discard();}setOpen(!open);}} className="text-cyan-200">{open?'Close vision':'Vision'}</button>
 {kind&&<><span role="status" className="text-amber-300">{kind==='camera'?'CAMERA ON':'SCREEN ACCESS'}</span><button onClick={stopAll} className="text-rose-300">STOP MEDIA</button></>}
 </div>
 {open&&<section aria-label="Visual sharing" className="fixed top-28 lg:top-14 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,620px)] max-h-[82vh] overflow-auto rounded-xl bg-slate-950 border border-cyan-900 p-4 space-y-3 text-sm">
 <h2 className="text-cyan-200">Share visual context</h2><p className="text-xs text-slate-400">Local preview only until you send a reviewed frame to your configured vision provider (local Ollama in offline mode). Cover private information by dragging black rectangles on the captured frame. Image pixels are not saved in chat history; answers follow normal chat retention.</p>
 <div className="flex flex-wrap gap-3"><button onClick={()=>void start('camera')}>Enable camera</button><button onClick={()=>void start('screen')}>Choose screen/window</button><button onClick={stopAll}>Stop media</button></div>
 {error&&<p role="alert" className="text-amber-300">{error}</p>}
 <video ref={video} muted playsInline className={kind?'w-full max-h-48':'hidden'}/>
 <button disabled={!kind} onClick={capture} className="disabled:opacity-40">Capture one frame</button>
 <canvas ref={canvas} aria-label="Frame preview; drag to redact" className={frame?'w-full border border-slate-700 touch-none':'hidden'} onPointerDown={e=>{point.current=position(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{const a=point.current,b=position(e);if(a){const ctx=e.currentTarget.getContext('2d');if(ctx){ctx.fillStyle='#000';ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));}point.current=null;setReviewed(false);}}} onPointerCancel={()=>{point.current=null;}}/>
 {frame&&<><button onClick={discard}>Discard frame</button><label className="block">Question<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={3000} className="block w-full bg-slate-900 p-2"/></label>
 <label className="flex gap-2"><input type="checkbox" disabled={state.currentTab!=='code_studio'} checked={code} onChange={e=>setCode(e.target.checked)}/>Also send up to 5,000 characters from {state.selectedFilePath||'the current editor file'}</label>
 <label className="flex gap-2"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed/redacted this frame and authorize sending it to the configured vision provider.</label>
 <button disabled={!reviewed||!prompt.trim()||state.isWorking} onClick={()=>void send()} className="rounded bg-cyan-900 p-2 disabled:opacity-40">Send reviewed frame</button></>}
 </section>}
 </>;
}
