import React,{useState} from 'react';
import {configureLiveKit,liveKitConfigured} from '../utils/liveKitVoice';
import {globalVoiceEngine} from '../utils/voiceEngine';
import {useAxionStore} from '../store/useAxionStore';
export function LiveKitSettings(){
 const [url,setUrl]=useState('ws://127.0.0.1:7880');const [token,setToken]=useState('');const [agent,setAgent]=useState('axion-stt');const [pcmStreaming,setPcmStreaming]=useState(true);const [status,setStatus]=useState(liveKitConfigured()?'LiveKit configured for this session':'Device/browser speech selected');
 return <details className="border border-slate-700 rounded p-3 text-xs space-y-2"><summary>Optional LiveKit voice transport</summary>
 <p>Audio goes to your LiveKit server and configured worker. AXION publishes the compatible WebRTC microphone track and optional 16 kHz PCM packets; PCM replies are played through Web Audio. Session token stays in memory.</p>
 <label className="block">Server URL<input value={url} onChange={e=>setUrl(e.target.value)} className="w-full bg-slate-900 p-2"/></label>
 <label className="block">Short-lived participant token<input type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" className="w-full bg-slate-900 p-2"/></label>
 <label className="block">Worker identity<input value={agent} onChange={e=>setAgent(e.target.value)} className="w-full bg-slate-900 p-2"/></label>
 <label className="flex gap-2"><input type="checkbox" checked={pcmStreaming} onChange={e=>setPcmStreaming(e.target.checked)}/>Send 16 kHz PCM chunks to compatible worker; legacy mic track remains enabled.</label>
 <button onClick={()=>{try{globalVoiceEngine.stopListening();globalVoiceEngine.synthesisAdapter.cancel();useAxionStore.setState({isMicMuted:true});configureLiveKit({url,token,agent,pcmStreaming});setToken('');setStatus('Configured, not connected. Enable microphone to start the live session.');}catch(e){setStatus(e instanceof Error?e.message:'Configuration failed');}}} className="underline mr-3">Use LiveKit this session</button>
 <button onClick={()=>{globalVoiceEngine.stopListening();useAxionStore.setState({isMicMuted:true});configureLiveKit(null);setToken('');setStatus('Device/browser speech selected');}} className="underline">Use browser speech</button>
 <p role="status">{status}</p></details>;
}
