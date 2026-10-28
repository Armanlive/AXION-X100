import React,{useState} from 'react';
import {Copy,Check,Volume2,RotateCcw,Share2,Clock} from 'lucide-react';
import {globalVoiceEngine} from '../utils/voiceEngine';
import type {ECCTelemetry} from '../core/context/eccManager';

async function copyText(text:string){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
 const previous=document.activeElement as HTMLElement;const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0';document.body.appendChild(area);area.select();
 try{if(!document.execCommand('copy'))throw Error('Clipboard unavailable');}finally{area.remove();previous?.focus();}
}

export function formatDuration(ms:number){return ms<1000?`${ms}ms`:ms<60000?`${(ms/1000).toFixed(1)}s`:`${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;}

/** Action row under a message: copy, retry, share, listen, and how long the reply took. */
export function ResponseActions({text,ecc,onSpeak,onRetry,durationMs,shareText,isUser=false}:{text:string;ecc?:ECCTelemetry;onSpeak?:()=>void;onRetry?:()=>void;durationMs?:number;shareText?:string;isUser?:boolean}){
 const [notice,setNotice]=useState<'copied'|'shared'|''>(''),[error,setError]=useState('');
 const flash=(n:'copied'|'shared')=>{setNotice(n);setError('');setTimeout(()=>setNotice(''),1800);};
 const copy=async()=>{try{await copyText(text);flash('copied');}catch{setError('Could not copy. Select the text and copy manually.');}};
 // Uses the system share sheet where the webview has one; otherwise copies the exchange for pasting anywhere.
 const share=async()=>{const body=shareText||text;try{
  if(typeof navigator.share==='function'){await navigator.share({title:'AXION',text:body});return;}
  await copyText(body);flash('shared');
 }catch(e){if((e as Error)?.name!=='AbortError')setError('Could not share. Use Copy instead.');}};
 const btn='flex gap-1 items-center hover:text-cyan-100';
 return <div className={`flex flex-wrap items-center gap-3 py-2 text-[11px] text-cyan-300/70 ${isUser?'justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition':''}`}>
  <button aria-label={isUser?'Copy message':'Copy response'} onClick={()=>void copy()} className={btn}>{notice==='copied'?<Check size={13}/>:<Copy size={13}/>} {notice==='copied'?'Copied':'Copy'}</button>
  {onRetry&&<button aria-label={isUser?'Send again':'Retry response'} title={isUser?'Send this message again':'Regenerate this reply'} onClick={onRetry} className={btn}><RotateCcw size={13}/>{isUser?'Resend':'Retry'}</button>}
  {!isUser&&<button aria-label="Share" onClick={()=>void share()} className={btn}>{notice==='shared'?<Check size={13}/>:<Share2 size={13}/>}{notice==='shared'?'Copied to share':'Share'}</button>}
  {!isUser&&<button aria-label="Listen to response" onClick={()=>onSpeak?onSpeak():void globalVoiceEngine.speak(text)} className={btn}><Volume2 size={13}/>Listen</button>}
  {durationMs!==undefined&&<span className="flex gap-1 items-center" title="Time taken for this reply"><Clock size={12}/>{formatDuration(durationMs)}</span>}
  {ecc&&<span title={`Estimated prompt: ${ecc.promptTokens}; raw context baseline: ${ecc.rawContextTokens}; compact map: ${ecc.compactContextTokens}. Not billed usage. ${ecc.truncated?'Partial map.':''}`}>Tokens saved via ECC: ~{ecc.savedPercent}% · context estimate</span>}
  {error&&<span role="status" className="text-amber-300">{error}</span>}
 </div>;
}
