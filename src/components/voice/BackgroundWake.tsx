import {useEffect,useState,useSyncExternalStore} from 'react';
import {isTauri} from '@tauri-apps/api/core';
import {useAxionStore} from '../../store/useAxionStore';
import {globalVoiceEngine} from '../../utils/voiceEngine';

/**
 * Wake listening while the user is in chat mode: AXION sleeps until it hears
 * "Hello AXION" / "AXION, wake up" (or a sentence starting with its name), greets,
 * takes the command, replies, and keeps a short follow-up window before sleeping.
 * The Voice screen owns the microphone itself; this unmounts while it is open.
 */
export function BackgroundWake(){
 const voiceSettings=useAxionStore(s=>s.voiceSettings);
 const isMicMuted=useAxionStore(s=>s.isMicMuted);
 const audioTtsEnabled=useAxionStore(s=>s.audioTtsEnabled);
 const updateVoiceSettings=useAxionStore(s=>s.updateVoiceSettings);
 const status=useSyncExternalStore(globalVoiceEngine.subscribe,globalVoiceEngine.getActivationStatus);
 const [problem,setProblem]=useState('');
 const [heard,setHeard]=useState<{text:string;woke:boolean}|null>(null);
 const enabled=voiceSettings.backgroundWake!==false&&!isMicMuted;

 useEffect(()=>{
  if(!enabled)return;
  setProblem('');
  globalVoiceEngine.setEvents({
   onTranscript:(text,final)=>{if(final){setHeard({text,woke:true});void useAxionStore.getState().executeUserPrompt(text,true);}},
   onHeard:(text,woke)=>setHeard({text,woke}),
   onStateChange:state=>useAxionStore.getState().setSpeechState(state),
   onError:error=>setProblem(error==='not-allowed'?'Microphone permission denied':error==='network'?'Speech service unreachable — enable Groq transcription in Voice settings':String(error)),
  });
  globalVoiceEngine.setModeOverride('wake-word');
  globalVoiceEngine.configure(voiceSettings,audioTtsEnabled&&voiceSettings.autoSpeak);
  globalVoiceEngine.startListening();
  // In the browser, a hidden tab pauses the mic. The desktop app keeps listening so
  // follow-ups still work while Chrome or another app is in front.
  const hidden=()=>{if(isTauri())return;if(document.hidden)globalVoiceEngine.stopListening();else globalVoiceEngine.startListening();};
  document.addEventListener('visibilitychange',hidden);
  return()=>{document.removeEventListener('visibilitychange',hidden);globalVoiceEngine.setModeOverride(undefined);globalVoiceEngine.destroy();};
 },[enabled,voiceSettings.language,voiceSettings.groqTranscription,voiceSettings.voiceName,voiceSettings.ttsEngine,audioTtsEnabled,voiceSettings.autoSpeak]);

 const label=isMicMuted?'Mic muted':!enabled?'Wake off':problem?problem:status.micOn?(status.sleeping?'Sleeping · say “AXION” to wake':status.waitingForWake?'Say “AXION…”':'Listening…'):'Waking mic…';
 return <div className="fixed bottom-3 right-32 z-50 flex items-center gap-2 rounded bg-slate-950 px-2 py-1 text-[11px]" title="Wake with “Hello AXION”, “AXION, wake up”, or start a sentence with “AXION”.">
  <span role="status" className={problem?'text-amber-300':enabled&&status.micOn?'text-emerald-300':'text-slate-400'}>
   {enabled&&status.micOn&&<span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" aria-hidden="true"/>}
   {label}
  </span>
  {enabled&&heard&&<span className={`max-w-[220px] truncate ${heard.woke?'text-cyan-200':'text-slate-500'}`} title={heard.woke?'Heard and acted on':'Heard, but it did not start with AXION’s name'}>
   Heard: “{heard.text}”
  </span>}
  <button type="button" onClick={()=>updateVoiceSettings({backgroundWake:voiceSettings.backgroundWake===false})} className="text-cyan-200">
   {voiceSettings.backgroundWake===false?'Turn on':'Turn off'}
  </button>
 </div>;
}
