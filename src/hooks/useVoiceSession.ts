import {useProfileStore} from '../store/useProfileStore';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { globalVoiceEngine, type VoiceState } from '../utils/voiceEngine';

/** Shared ownership for desktop/mobile: one microphone and no second TTS effect. */
export function useVoiceSession() {
  const {voiceSettings,isMicMuted,audioTtsEnabled}=useAxionStore();
  const [liveTranscript,setLiveTranscript]=useState('');
  const [interimTranscript,setInterimTranscript]=useState('');
  const [audioLevel,setAudioLevel]=useState(0);
  const [observedVoiceState,setObservedVoiceState]=useState<VoiceState>('idle');
  const [runtimeWarning,setRuntimeWarning]=useState<string|null>(null);
  const [isPttActive,setIsPttActive]=useState(false);const held=useRef(false);
  const activation=useSyncExternalStore(globalVoiceEngine.subscribe,globalVoiceEngine.getActivationStatus);
  const isPushToTalk=voiceSettings.listeningMode==='push-to-talk';
  useEffect(()=>{
    globalVoiceEngine.setEvents({
      onWake:(phrase)=>{const p=useProfileStore.getState();if(p.profile||p.locked)return false;p.show();void useAxionStore.getState().executeUserPrompt(phrase||'Hello AXION',true);return true;},
      continueConversation:()=>{const p=useProfileStore.getState();return p.open&&!p.profile&&!p.locked&&p.stage<4;},
      onStateChange:state=>{setObservedVoiceState(state);useAxionStore.getState().setSpeechState(state);},
      onAudioLevel:setAudioLevel,
      onHeard:(text,woke)=>{if(!woke)setLiveTranscript(`Heard (no wake word): ${text}`);},
      onTranscript:(text,final)=>{
        if(final){setLiveTranscript(text);setInterimTranscript('');void useAxionStore.getState().executeUserPrompt(text,true);}
        else setInterimTranscript(text);
      },
      onError:error=>{if(!globalVoiceEngine.getActivationStatus().micOn)useAxionStore.setState({isMicMuted:true});setRuntimeWarning(error==='network'?'Browser speech service could not connect. Enable desktop Groq transcription below with a saved Groq key, or configure LiveKit.':error==='not-allowed'?'Microphone permission was denied. Allow microphone access in browser settings, then retry.':error);if(held.current)globalVoiceEngine.stopListening();held.current=false;setIsPttActive(false);}
    });
    const hidden=()=>{if(document.hidden){setRuntimeWarning('Microphone paused because you switched tabs. Enable microphone to resume wake listening.');globalVoiceEngine.stopListening();globalVoiceEngine.synthesisAdapter.cancel();useAxionStore.setState({isMicMuted:true});}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{document.removeEventListener('visibilitychange',hidden);globalVoiceEngine.destroy();};
  },[]);
  useEffect(()=>{globalVoiceEngine.configure(voiceSettings,audioTtsEnabled&&voiceSettings.autoSpeak);if((!audioTtsEnabled||!voiceSettings.autoSpeak)&&globalVoiceEngine.getState()==='speaking')globalVoiceEngine.interrupt();},[voiceSettings,audioTtsEnabled]);
  useEffect(()=>{
    held.current=false;setIsPttActive(false);globalVoiceEngine.stopListening();
    if(!isMicMuted&&!isPushToTalk){setRuntimeWarning(null);globalVoiceEngine.startListening();}
  },[isMicMuted,voiceSettings.listeningMode,voiceSettings.doubleClap,voiceSettings.groqTranscription]);
  const startPtt=(event?:React.PointerEvent)=>{
    const state=useAxionStore.getState();if(state.isMicMuted||state.isWorking)return;
    try{if(event)event.currentTarget.setPointerCapture(event.pointerId);}catch{}
    held.current=true;setIsPttActive(true);setRuntimeWarning(null);globalVoiceEngine.startListening();
  };
  const stopPtt=(event?:React.PointerEvent)=>{
    try{if(event)event.currentTarget.releasePointerCapture(event.pointerId);}catch{}
    if(!held.current)return;held.current=false;setIsPttActive(false);globalVoiceEngine.finishListening();
  };
  const cancelPtt=()=>{if(held.current){held.current=false;setIsPttActive(false);globalVoiceEngine.stopListening();}};
  useEffect(()=>{
    if(!isPushToTalk)return;
    const editable=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;return target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target?.tagName);};
    const down=(event:KeyboardEvent)=>{if(event.code==='Space'&&!event.repeat&&!editable(event)){event.preventDefault();startPtt();}};
    const up=(event:KeyboardEvent)=>{if(event.code==='Space'&&held.current){event.preventDefault();stopPtt();}};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',cancelPtt);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',cancelPtt);};
  },[isPushToTalk,isMicMuted]);
  const initializeVoice=()=>{setRuntimeWarning(null);if(useAxionStore.getState().isMicMuted)useAxionStore.setState({isMicMuted:false});else if(!isPushToTalk)globalVoiceEngine.startListening();};
  return {liveTranscript,setLiveTranscript,interimTranscript,audioLevel,observedVoiceState,runtimeWarning,isPttActive,isPushToTalk,startPtt,stopPtt,cancelPtt,initializeVoice,activation};
}
