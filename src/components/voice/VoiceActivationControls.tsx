import {isTauri} from '@tauri-apps/api/core';
import React from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import type { ActivationStatus } from '../../utils/voiceEngine';
export function VoiceActivationControls({status}:{status:ActivationStatus}) {
 const {voiceSettings,updateVoiceSettings,isMicMuted,toggleMicMute}=useAxionStore();
 return <div className="w-full max-w-lg mx-auto px-2 py-2 text-xs space-y-2">
  <label className="flex items-start justify-center gap-2 text-cyan-200"><input type="checkbox" disabled={!isTauri()} checked={!!voiceSettings.groqTranscription} onChange={e=>updateVoiceSettings({groqTranscription:e.target.checked})}/>Use desktop Groq transcription (requires the Tauri desktop app and a saved Groq key). While microphone is on, utterances—including wake listening—are sent to Groq. Audio is not saved locally.</label>
  <div className="flex items-center justify-center gap-2 flex-wrap">
   <label htmlFor="axion-listening-mode" className="text-zinc-400">Talk mode</label>
   <select id="axion-listening-mode" aria-label="Talk mode" value={voiceSettings.listeningMode} onChange={event=>updateVoiceSettings({listeningMode:event.target.value as typeof voiceSettings.listeningMode})} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-200">
    <option value="push-to-talk">Hold button to talk</option><option value="continuous">Conversation</option><option value="wake-word">Hello AXION</option>
   </select>
   <span role="status" className={status.micOn?'text-amber-300':'text-zinc-500'}>{status.micOn?'MIC ON':'MIC OFF'}</span>
  </div>
  {voiceSettings.listeningMode==='wake-word'&&<div className="text-center text-zinc-400 space-y-1">
   <p>{isMicMuted?'Wake phrase and claps are OFF. Enable microphone below.':status.micOn&&status.waitingForWake?'Say “Hello AXION”, then your question.':status.micOn?'Listening for your question…':'Microphone is off.'}</p>
   <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!voiceSettings.doubleClap} onChange={event=>updateVoiceSettings({doubleClap:event.target.checked})}/> Also wake with two claps (experimental)</label>
   <p className="text-[10px] text-zinc-500">Switching tabs pauses the microphone. Keep this Voice screen visible. Clap detection is experimental and can react to other sharp sounds.</p>
  </div>}
  {voiceSettings.listeningMode==='wake-word'&&voiceSettings.doubleClap&&<p role="status" className="text-center text-xs text-amber-200">{status.micOn&&status.waitingForWake?'Clap detection active: clap twice, roughly half a second apart.':'Clap detection inactive — waiting for microphone and wake mode.'}</p>}
  {isMicMuted&&<button onClick={toggleMicMute} className="block mx-auto text-cyan-300 underline">Enable microphone</button>}
 </div>;
}
