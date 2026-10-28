import {requiresLocalInference, onInferenceModeChange} from './hybridMode.ts';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {RecordedRecognition} from './recordedRecognition.ts';
import {LiveKitRecognition,liveKitConfigured} from './liveKitVoice.ts';
import { prepareTextForSpeech } from './voiceNormalizer.ts';
import { DoubleClapDetector, parseWakePhrase, selectDeviceVoice, wakeAcknowledgement, isNoiseTranscript, detectSleepCommand, sleepAcknowledgement } from './voiceActivation.ts';
import { synthesizeFishAudio, getFishAudioKey, isFishAudioConfigured, getFishAudioModel } from '../services/fishAudioService.ts';
import { synthesizeGeminiSpeech } from '../services/geminiTtsService.ts';
import type { SpeechState, VoiceSettings } from '../types';
export type VoiceState = SpeechState;
type TtsEngine = NonNullable<VoiceSettings['ttsEngine']>;
/**
 * Language the recognizer listens for. "auto" follows the computer's language, so a
 * Spanish or Arabic user is heard in their language; Hindi and Hinglish use hi-IN.
 */
export function recognitionLocale(setting: VoiceSettings['language'] | string, system = typeof navigator !== 'undefined' ? navigator.language : 'en-US'): string {
  const sys = system || 'en-US';
  if (setting === 'hi' || setting === 'hinglish') return 'hi-IN';
  if (setting === 'en') return sys.toLowerCase().startsWith('en') ? sys : 'en-US';
  return sys;
}
export interface VoiceEngineEvents {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (error: string) => void;
  onBargeIn?: () => void;
  onWake?: (phrase?:string) => boolean;
  /** Every final phrase heard while asleep, and whether it woke AXION (for on-screen diagnostics). */
  onHeard?: (text:string, woke:boolean) => void;
  continueConversation?: () => boolean;
  /** AXION was told to sleep; it now waits for its name. */
  onSleep?: () => void;
}
export class SpeechRecognitionAdapter {
  private recognition: any = null;
  private recordedEnabled=false;private usingRecorded=false;
  // Whisper must be told the language: left to guess, it often writes Hindi speech in Urdu script.
  private transcriptionLanguage:string|null=null;
  private recorded=new RecordedRecognition((audio,mime)=>{if(requiresLocalInference())return Promise.reject(new Error('Offline mode: cloud transcription is disabled.'));return invoke<string>('transcribe_audio',{audio,mime,language:this.transcriptionLanguage});},text=>this.transcript?.(text,true),error=>this.error?.(error));
  setRecordedEnabled(enabled:boolean){this.recordedEnabled=enabled&&isTauri();}
  sample(rms:number,now:number){if(this.usingRecorded)this.recorded.sample(rms,now);}

  private transport:LiveKitRecognition|null=null;private inputStream:MediaStream|null=null;private usingTransport=false;private mode='continuous';
  setMode(mode:string){this.mode=mode;}
  setInputStream(stream:MediaStream|null){this.inputStream=stream;}
  private wanted = false;
  private running = false;
  private starting = false;
  private stopping = false;
  private acceptResults = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private transcript?: (text:string,final:boolean)=>void;
  private state?: (state:VoiceState)=>void;
  private error?: (error:string)=>void;
  private liveAudio:{onOutputLevel?:(level:number)=>void;onOutputStarted?:()=>void;onOutputEnded?:()=>void}={};
  constructor() {
    if(typeof window==='undefined')return;
    const Recognition=(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!Recognition)return;
    try {
      const rec=this.recognition=new Recognition();rec.continuous=true;rec.interimResults=true;rec.lang=recognitionLocale('auto');
      rec.onstart=()=>{this.starting=false;this.running=true;if(!this.wanted||this.stopping){rec.abort();return;}this.acceptResults=true;this.state?.('listening');};
      rec.onresult=(event:any)=>{
        if(!this.acceptResults)return;
        let final='',interim='';
        for(let i=event.resultIndex;i<event.results.length;i++){
          if(event.results[i].isFinal)final+=event.results[i][0].transcript+' ';else interim+=event.results[i][0].transcript+' ';
        }
        if(final.trim())this.transcript?.(final.trim(),true);else if(interim.trim())this.transcript?.(interim.trim(),false);
      };
      rec.onerror=(event:any)=>{
        if(event.error==='no-speech'||event.error==='aborted')return;
        this.wanted=false;this.acceptResults=false;this.error?.(event.error || 'Speech recognition failed.');
      };
      rec.onend=()=>{
        this.running=false;this.starting=false;this.stopping=false;
        if(this.wanted)this.retry=setTimeout(()=>this.start(),250);else{this.acceptResults=false;this.state?.('idle');}
      };
    } catch {this.recognition=null;}
  }
  checkAvailability(){return this.recordedEnabled||liveKitConfigured()||!!this.recognition;}
  setLanguage(lang:string, autoDetect=false){if(this.recognition)this.recognition.lang=lang;this.transcriptionLanguage=autoDetect?null:lang.split('-')[0].toLowerCase();}
  setCallbacks(transcript:(text:string,final:boolean)=>void,state:(state:VoiceState)=>void,error:(error:string)=>void){this.transcript=transcript;this.state=state;this.error=error;this.transport=new LiveKitRecognition(transcript,()=>state('listening'),error,undefined,undefined,this.liveAudio);}
  setLiveAudioCallbacks(callbacks:{onOutputLevel?:(level:number)=>void;onOutputStarted?:()=>void;onOutputEnded?:()=>void}){this.liveAudio=callbacks;if(this.transcript&&this.state&&this.error)this.transport=new LiveKitRecognition(this.transcript,()=>this.state?.('listening'),this.error,undefined,undefined,this.liveAudio);}
  start(){
    if(requiresLocalInference()){
      // Web Speech can otherwise use a remote recognizer even with no cloud adapter selected.
      if(!this.recognition || !('processLocally' in this.recognition)){
        this.error?.('Offline speech recognition is unavailable. Install a local speech adapter or type your command. No audio was sent.');return;
      }
      this.recognition.processLocally=true;
    } else if(this.recognition && 'processLocally' in this.recognition) this.recognition.processLocally=false;
    if(!requiresLocalInference() && this.recordedEnabled){if(!this.inputStream){this.error?.('Microphone stream is unavailable.');return;}this.usingRecorded=true;this.recorded.start(this.inputStream);this.state?.('listening');return;}
    if(!requiresLocalInference() && liveKitConfigured()){this.usingTransport=true;void this.transport?.start(this.inputStream,this.mode);return;}
    if(!this.recognition){this.error?.('Speech recognition is unavailable in this runtime. Microphone permission alone does not enable transcription. Configure the LiveKit voice connection or use a browser with speech recognition.');return;}
    this.wanted=true;this.acceptResults=!this.stopping;clearTimeout(this.retry);
    if(this.running||this.starting||this.stopping)return;
    try{this.starting=true;this.recognition.start();}catch(error:any){this.starting=false;if(error.name!=='InvalidStateError'){this.wanted=false;this.error?.('Could not start speech recognition.');}}
  }
  restartIgnoredTurn(){if(requiresLocalInference()){this.stop();this.start();return;}if(this.usingRecorded&&this.inputStream){this.recorded.start(this.inputStream);return;}if(this.usingTransport)void this.transport?.start(this.inputStream,this.mode);}
  stop(flush=false){if(this.usingRecorded){this.recorded.stop(flush);if(!flush)this.usingRecorded=false;return;}if(this.usingTransport){this.transport?.stop(flush);if(!flush)this.usingTransport=false;return;}this.stopping=this.running||this.starting;this.wanted=false;this.acceptResults=flush;clearTimeout(this.retry);try{flush?this.recognition?.stop():this.recognition?.abort();}catch{} }
}

export class SpeechSynthesisAdapter {
  private current: SpeechSynthesisUtterance | null=null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private abortController: AbortController | null = null;
  private generation=0;
  private speaking=false;
  private voiceName='Default Voice';private rate=1;private pitch=1;private language='auto';
  private ttsEngine: TtsEngine = 'fishaudio';
  private fishAudioApiKey: string = '';
  private fishAudioModel: string = 's2.1-pro';
  private geminiTtsModel='';private geminiTtsVoice='';
  private changed?: (speaking:boolean)=>void;
  private outputLevel?: (level:number)=>void;
  private meterContext:AudioContext|null=null;private meter:AnalyserNode|null=null;private meterFrame:number|null=null;
  public lastError='';

  checkAvailability(){
    return isFishAudioConfigured() || !!this.fishAudioApiKey || (typeof window!=='undefined' && 'speechSynthesis' in window);
  }

  setVoiceSettings(
    name: string,
    rate: number,
    pitch=1,
    language='auto',
    ttsEngine: TtsEngine = 'fishaudio',
    fishAudioApiKey?: string,
    fishAudioModel?: string,
    geminiTtsModel?: string,
    geminiTtsVoice?: string
  ){
    this.voiceName=name;
    this.rate=rate;
    this.pitch=pitch;
    this.language=language;
    this.ttsEngine=ttsEngine;
    if(fishAudioApiKey!==undefined)this.fishAudioApiKey=fishAudioApiKey;
    if(fishAudioModel!==undefined)this.fishAudioModel=fishAudioModel;
    if(geminiTtsModel!==undefined)this.geminiTtsModel=geminiTtsModel;
    if(geminiTtsVoice!==undefined)this.geminiTtsVoice=geminiTtsVoice;
  }

  setOnSpeakingChange(callback:(speaking:boolean)=>void){this.changed=callback;}
  setOnOutputLevel(callback:(level:number)=>void){this.outputLevel=callback;}
  private meterAudio(audio:HTMLAudioElement){
    if(typeof AudioContext==='undefined')return;
    try{this.meterContext=new AudioContext();const source=this.meterContext.createMediaElementSource(audio);this.meter=this.meterContext.createAnalyser();this.meter.fftSize=1024;source.connect(this.meter);this.meter.connect(this.meterContext.destination);void this.meterContext.resume();const samples=new Float32Array(this.meter.fftSize);let smooth=0;const loop=()=>{if(!this.meter)return;this.meter.getFloatTimeDomainData(samples);let sum=0;for(const value of samples)sum+=value*value;smooth=smooth*.7+Math.min(1,Math.sqrt(sum/samples.length)*5)*.3;this.outputLevel?.(smooth);this.meterFrame=requestAnimationFrame(loop);};loop();}catch{/* Device speech remains usable if a Web Audio meter is unavailable. */}
  }
  private stopMeter(){if(this.meterFrame!==null)cancelAnimationFrame(this.meterFrame);this.meterFrame=null;this.meter=null;this.outputLevel?.(0);void this.meterContext?.close().catch(()=>{});this.meterContext=null;}

  async speak(text:string,onStart?:()=>void,onEnd?:()=>void):Promise<boolean>{
    this.cancel();
    const generation=++this.generation;
    this.lastError='';
    const clean=prepareTextForSpeech(text);
    if(!clean)return false;

    if(requiresLocalInference())return this.speakDevice(clean,generation,onStart,onEnd);

    // 1. Gemini TTS; on failure fall through to Fish Audio (if configured), then device speech.
    if(this.ttsEngine==='gemini'){
      try{
        this.abortController=new AbortController();
        const buffer=await synthesizeGeminiSpeech(clean,{model:this.geminiTtsModel||undefined,voice:this.geminiTtsVoice||undefined,signal:this.abortController.signal});
        if(generation!==this.generation)return false;
        return await this.playBuffer(buffer,'audio/wav','Gemini',clean,generation,onStart,onEnd);
      }catch{
        if(generation!==this.generation)return false;
      }
    }

    // 2. Try Fish Audio TTS if enabled and key is available
    const fishKey=(this.fishAudioApiKey || getFishAudioKey() || '').trim();
    if(this.ttsEngine!=='device' && (fishKey||isFishAudioConfigured())){
      try{
        this.abortController=new AbortController();
        const buffer=await synthesizeFishAudio(clean,{
          apiKey:fishKey,
          model:this.fishAudioModel || getFishAudioModel(),
          signal:this.abortController.signal,
        });
        if(generation!==this.generation)return false;
        return await this.playBuffer(buffer,'audio/mp3','Fish Audio',clean,generation,onStart,onEnd);
      }catch{
        if(generation!==this.generation)return false;
        // Fish Audio failure is recoverable. Keep the primary UI conversation uninterrupted.
        const fallback=await this.speakDevice(clean,generation,onStart,onEnd);
        this.lastError=fallback?'':'Fish Audio is unavailable and device speech could not play.';
        return fallback;
      }
    }

    // 3. Default / Fallback: Device Web Speech Synthesis
    return await this.speakDevice(clean,generation,onStart,onEnd);
  }

  /** Plays synthesized audio; if the WebView cannot play it, falls back to device speech. */
  private playBuffer(buffer:ArrayBuffer,mime:string,label:string,clean:string,generation:number,onStart?:()=>void,onEnd?:()=>void):Promise<boolean>{
        const blob=new Blob([buffer],{type:mime});
        const audioUrl=URL.createObjectURL(blob);
        this.currentAudioUrl=audioUrl;
        const audio=new Audio(audioUrl);
        this.currentAudio=audio;
        audio.playbackRate=Math.min(1.4,Math.max(0.8,this.rate));

        const cleanup=()=>{
          if(this.currentAudio===audio)this.currentAudio=null;
          if(this.currentAudioUrl===audioUrl){
            try{URL.revokeObjectURL(audioUrl);}catch{}
            this.currentAudioUrl=null;
          }
        };

        return new Promise<boolean>((resolve)=>{
          let resolved=false;
          audio.onplay=()=>{
            if(generation!==this.generation)return;
            this.meterAudio(audio);
            this.speaking=true;
            this.changed?.(true);
            onStart?.();
          };
          audio.onended=()=>{
            if(generation!==this.generation)return;
            this.stopMeter();
            this.speaking=false;
            this.changed?.(false);
            cleanup();
            onEnd?.();
            if(!resolved){resolved=true;resolve(true);}
          };
          audio.onerror=()=>{
            this.stopMeter();
            cleanup();
            if(!resolved){
              resolved=true;
              this.speakDevice(clean,generation,onStart,onEnd).then(ok=>{if(!ok)this.lastError=`${label} and device speech could not play.`;else this.lastError='';resolve(ok);});
            }
          };
          audio.play().catch(()=>{
            this.stopMeter();
            cleanup();
            if(!resolved){
              resolved=true;
              this.speakDevice(clean,generation,onStart,onEnd).then(ok=>{if(!ok)this.lastError=`${label} and device speech could not start.`;else this.lastError='';resolve(ok);});
            }
          });
        });
  }

  private async speakDevice(clean:string,generation:number,onStart?:()=>void,onEnd?:()=>void):Promise<boolean>{
    // A late failed network/audio callback must not restart speech after mute/cancel.
    if(generation!==this.generation)return false;
    if(typeof window==='undefined'||!('speechSynthesis' in window)){
      if(!this.lastError)this.lastError='Speech output is unavailable on this device.';
      return false;
    }
    let voices=window.speechSynthesis.getVoices();
    if(!voices.length){
      await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);window.speechSynthesis.removeEventListener('voiceschanged',done);resolve();};const timer=setTimeout(done,1200);window.speechSynthesis.addEventListener('voiceschanged',done);});
      if(generation!==this.generation)return false;voices=window.speechSynthesis.getVoices();
    }
    if(requiresLocalInference()){
      voices=voices.filter(voice=>voice.localService===true);
      if(!voices.length){this.lastError='No local device voice is installed. Text replies still work; no speech was sent to the cloud.';return false;}
    }
    const voice=selectDeviceVoice(voices,this.voiceName,clean,this.language);
    const utterance=new SpeechSynthesisUtterance(clean);this.current=utterance;
    if(voice){utterance.voice=voice;utterance.lang=voice.lang;}
    else{utterance.lang=/[\u0900-\u097f]/u.test(clean)?'hi-IN':'en-IN';}
    utterance.rate=Math.min(1.4,Math.max(.8,this.rate));utterance.pitch=this.pitch;
    utterance.onstart=()=>{if(generation!==this.generation)return;this.speaking=true;this.changed?.(true);onStart?.();};
    const finish=()=>{if(generation!==this.generation)return;this.speaking=false;this.current=null;this.changed?.(false);onEnd?.();};
    utterance.onend=finish;utterance.onerror=()=>{if(!this.lastError)this.lastError='Device speech could not play. Text replies still work.';finish();};
    try{window.speechSynthesis.speak(utterance);return true;}catch{this.current=null;this.lastError="Device speech could not start. Text replies still work.";return false;}
  }

  cancel(){
    this.generation++;
    this.stopMeter();
    if(this.abortController){
      try{this.abortController.abort();}catch{}
      this.abortController=null;
    }
    if(this.currentAudio){
      try{this.currentAudio.pause();this.currentAudio.currentTime=0;this.currentAudio.src='';}catch{}
      this.currentAudio=null;
    }
    if(this.currentAudioUrl){
      try{URL.revokeObjectURL(this.currentAudioUrl);}catch{}
      this.currentAudioUrl=null;
    }
    if(this.current){this.current.onend=null;this.current.onerror=null;this.current.onstart=null;}
    this.current=null;this.speaking=false;
    if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();
  }
  isSpeaking(){return this.speaking;}
}

/** One cancellable microphone stream. RMS/peak samples stay in the browser. */
export class MicrophoneAudioAnalyser {
  private context:AudioContext|null=null;private stream:MediaStream|null=null;private source:MediaStreamAudioSourceNode|null=null;
  private analyser:AnalyserNode|null=null;private frame:number|null=null;private epoch=0;private pending:Promise<boolean>|null=null;
  private onLevel?: (level:number)=>void;private onSample?: (rms:number,peak:number,now:number)=>void;
  public lastError="";
  getStream(){return this.stream;}
  setOnLevel(callback:(level:number)=>void){this.onLevel=callback;}
  setOnSample(callback:(rms:number,peak:number,now:number)=>void){this.onSample=callback;}
  start(detectClaps=false):Promise<boolean>{
    if(this.stream?.getAudioTracks().some(track=>track.readyState==='live'))return Promise.resolve(true);if(this.pending)return this.pending;
    if(this.stream)this.stop();this.lastError="";
    const epoch=++this.epoch;
    this.pending=(async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone capture is unavailable in this runtime. Use the desktop app or a secure localhost/HTTPS page.");
        const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:!detectClaps,autoGainControl:false}});
        if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return false;}
        this.stream=stream;this.context=new AudioContext();await this.context.resume();
        if(epoch!==this.epoch)return false;
        this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;
        this.source=this.context.createMediaStreamSource(stream);this.source.connect(this.analyser);
        const samples=new Float32Array(this.analyser.fftSize);let smoothed=0;
        const loop=()=>{
          if(epoch!==this.epoch||!this.analyser)return;
          this.analyser.getFloatTimeDomainData(samples);let sum=0,peak=0;
          for(const value of samples){sum+=value*value;peak=Math.max(peak,Math.abs(value));}
          const rms=Math.sqrt(sum/samples.length);smoothed=smoothed*.7+Math.min(1,rms*5)*.3;
          this.onLevel?.(smoothed);this.onSample?.(rms,peak,performance.now());
          if(epoch===this.epoch)this.frame=requestAnimationFrame(loop);
        };loop();return true;
      }catch(error){if(epoch===this.epoch){
        const name=error instanceof Error?error.name:'';
        this.lastError=name==='NotAllowedError'?'Microphone access was denied by the system or WebView. Allow AXION microphone access and retry.':name==='NotFoundError'?'No microphone device was found. Connect a microphone and retry.':name==='NotReadableError'?'The microphone could not be opened. Check whether another application is using it.':error instanceof Error?error.message:'Microphone initialization failed.';
        this.stop();}return false;}
      finally{if(epoch===this.epoch)this.pending=null;}
    })();return this.pending;
  }
  stop(){this.epoch++;this.pending=null;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.source?.disconnect();this.source=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;void this.context?.close().catch(()=>{});this.context=null;this.analyser=null;this.onLevel?.(0);}
}

export interface ActivationStatus { micOn:boolean; waitingForWake:boolean; mode:VoiceSettings['listeningMode']; sleeping?:boolean }
/** How long AXION stays awake for a command after waking or replying, before needing its name again. */
export const FOLLOW_UP_MS=12000;
export class VoiceEngine {
  public recognitionAdapter=new SpeechRecognitionAdapter();public synthesisAdapter=new SpeechSynthesisAdapter();public audioAnalyser=new MicrophoneAudioAnalyser();
  private events:VoiceEngineEvents={};private state:VoiceState='idle';private active=false;private accepting=false;private epoch=0;
  private settings:VoiceSettings={language:'auto',voiceName:'Default Voice',speed:1,autoSpeak:true,listeningMode:'continuous',doubleClap:false};
  private status:ActivationStatus={micOn:false,waitingForWake:false,mode:'continuous'};
  private listeners=new Set<()=>void>();private claps=new DoubleClapDetector();private wakeTimeout:ReturnType<typeof setTimeout>|undefined;
  private outputEnabled=true;
  /** Asleep after "AXION so jao": nothing but the name wakes it, in every talk mode. */
  private sleeping=false;
  isSleeping(){return this.sleeping;}
  private unsubscribeMode:()=>void;
  private offlineAudio=()=>{if(requiresLocalInference()){this.recognitionAdapter.stop();this.synthesisAdapter.cancel();}};
  constructor(events?:VoiceEngineEvents){
    this.unsubscribeMode=onInferenceModeChange(this.offlineAudio);
    if(typeof window!=='undefined')window.addEventListener?.('offline',this.offlineAudio);
    this.events=events || {};
    this.audioAnalyser.setOnLevel(level=>this.events.onAudioLevel?.(this.state==='listening'?level:0));
    this.audioAnalyser.setOnSample((rms,peak,now)=>{this.recognitionAdapter.sample(rms,now);if(this.active&&this.status.waitingForWake&&this.settings.doubleClap&&this.claps.sample(rms,peak,now))this.activate();});
    this.recognitionAdapter.setCallbacks((text,final)=>this.receive(text,final),state=>{
      if(state==='listening')this.publish({micOn:true});
      if(this.state!=='speaking'&&this.state!=='thinking')this.setState(state);
    },error=>{this.stopListening();this.events.onError?.(error);});
    this.recognitionAdapter.setLiveAudioCallbacks({
      onOutputLevel:level=>this.events.onAudioLevel?.(this.state==='speaking'?level:0),
      onOutputStarted:()=>{this.accepting=false;this.setState('speaking');},
      onOutputEnded:()=>{if(this.state==='speaking')this.completeTurn();}
    });
    this.synthesisAdapter.setOnOutputLevel(level=>this.events.onAudioLevel?.(this.state==='speaking'?level:0));
  }
  private modeOverride?:VoiceSettings['listeningMode'];
  /** Background wake pins wake-word mode so later configure() calls with the saved talk mode can't widen it. */
  setModeOverride(mode?:VoiceSettings['listeningMode']){this.modeOverride=mode;}
  get backgroundWake(){return this.modeOverride==='wake-word';}
  configure(input:VoiceSettings,outputEnabled=true){
    const settings={...input,listeningMode:this.modeOverride??input.listeningMode};
    this.settings={...settings};this.recognitionAdapter.setRecordedEnabled(!!settings.groqTranscription);
    this.outputEnabled=outputEnabled;
    this.publish({mode:settings.listeningMode});
    this.recognitionAdapter.setMode(settings.listeningMode);
    this.recognitionAdapter.setLanguage(recognitionLocale(settings.language),settings.language==='auto');
    this.synthesisAdapter.setVoiceSettings(
      settings.voiceName,
      settings.speed,
      1,
      'auto',
      settings.ttsEngine || 'fishaudio',
      settings.fishAudioApiKey,
      settings.fishAudioModel,
      settings.geminiTtsModel,
      settings.geminiTtsVoice
    );
  }
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getActivationStatus=()=>this.status;
  private publish(update:Partial<ActivationStatus>){this.status={...this.status,...update};this.listeners.forEach(fn=>fn());}
  setEvents(events:VoiceEngineEvents){this.events=events;}
  setState(state:VoiceState){this.state=state;this.events.onStateChange?.(state);}
  getState(){return this.state;}
  isSupported(){return this.isRecognitionSupported()||this.isSynthesisSupported();}
  isRecognitionSupported(){return this.recognitionAdapter.checkAvailability();}
  isSynthesisSupported(){return this.synthesisAdapter.checkAvailability();}
  startListening(){
    if(this.active&&this.accepting)return;
    this.active=true;this.accepting=true;this.synthesisAdapter.cancel();this.setState('idle');this.publish({waitingForWake:this.sleeping||this.settings.listeningMode==='wake-word'});this.claps.reset();void this.capture();
  }
  private async capture(){
    const epoch=++this.epoch;
    if(!this.isRecognitionSupported()){this.stopListening();this.events.onError?.('Speech recognition is unavailable in this runtime. Microphone permission alone does not enable transcription. Configure the LiveKit voice connection or use a browser with speech recognition.');return;}
    const ok=await this.audioAnalyser.start(this.settings.listeningMode==='wake-word'&&!!this.settings.doubleClap);if(epoch!==this.epoch||!this.active)return;
    if(!ok){this.stopListening();this.events.onError?.(this.audioAnalyser.lastError || 'Microphone initialization failed.');return;}
    this.publish({micOn:true});this.recognitionAdapter.setInputStream(this.audioAnalyser.getStream());this.recognitionAdapter.start();
  }
  private receive(text:string,final:boolean){
    if(!this.accepting||this.state==='speaking')return;
    // Silence and background noise come back as ".", "So", "Thank you": never act on them.
    if(final&&isNoiseTranscript(text)){this.events.onHeard?.(text,false);this.recognitionAdapter.restartIgnoredTurn();return;}
    if(this.status.waitingForWake||this.sleeping){
      if(!final)return;const wake=parseWakePhrase(text);this.events.onHeard?.(text,wake.matched);if(!wake.matched){this.recognitionAdapter.restartIgnoredTurn();return;}
      if(this.sleeping){this.sleeping=false;this.publish({sleeping:false});}
      if(!wake.remainder){this.activate(text);return;}
      this.publish({waitingForWake:false});text=wake.remainder;
    }
    if(final&&detectSleepCommand(text)){this.sleep(text);return;}
    if(final){this.accepting=false;clearTimeout(this.wakeTimeout);this.recognitionAdapter.stop();this.audioAnalyser.stop();this.publish({micOn:false});this.setState('thinking');}
    this.events.onTranscript?.(text,final);
  }
  private activate(phrase?:string){
    if(!this.active)return;this.claps.reset();this.publish({waitingForWake:false});
    if(this.sleeping){this.sleeping=false;this.publish({sleeping:false});}
    if(this.events.onWake?.(phrase))return;
    const ready=()=>{if(!this.active)return;this.accepting=true;void this.capture();clearTimeout(this.wakeTimeout);this.wakeTimeout=setTimeout(()=>{if(this.active&&this.accepting)this.publish({waitingForWake:true});},FOLLOW_UP_MS);};
    const acknowledgement=wakeAcknowledgement(phrase);
    if(this.outputEnabled)void this.speak(acknowledgement,ready,false);else ready();
  }
  /** "AXION so jao" / "chup ho jao" / "go to sleep": stop talking, then listen only for the name. */
  sleep(phrase='',announce=true){
    this.sleeping=true;this.publish({sleeping:true});clearTimeout(this.wakeTimeout);this.synthesisAdapter.cancel();this.events.onSleep?.();
    const rest=()=>{if(!this.active){this.setState('idle');return;}this.accepting=true;this.publish({waitingForWake:true});this.setState('idle');void this.capture();};
    if(announce&&this.outputEnabled)void this.speak(sleepAcknowledgement(phrase).speechText,rest,false);else{this.epoch++;rest();}
  }
  /** PTT release drains the final recognition result; mute/end aborts it. */
  finishListening(){this.active=false;clearTimeout(this.wakeTimeout);this.recognitionAdapter.stop(true);this.audioAnalyser.stop();this.publish({micOn:false});}
  stopListening(){this.active=false;this.accepting=false;this.epoch++;clearTimeout(this.wakeTimeout);this.recognitionAdapter.stop();this.audioAnalyser.stop();this.claps.reset();this.publish({micOn:false,waitingForWake:false});this.setState('idle');}
  pauseForResponse(){this.accepting=false;this.epoch++;this.recognitionAdapter.stop();this.audioAnalyser.stop();this.publish({micOn:false});this.setState('thinking');}
  completeTurn(){
    if(!this.active){this.setState('idle');return;}
    this.accepting=true;
    // Wake mode keeps a short follow-up window after each reply ("Chrome kholo" → "YouTube kholo")
    // before going back to sleep; onboarding (continueConversation) stays awake until it finishes.
    const wake=this.settings.listeningMode==='wake-word',hold=!!this.events.continueConversation?.();
    clearTimeout(this.wakeTimeout);
    if(this.sleeping){this.publish({waitingForWake:true});this.setState('idle');void this.capture();return;}
    if(wake&&!hold)this.wakeTimeout=setTimeout(()=>{if(this.active&&this.accepting)this.publish({waitingForWake:true});},FOLLOW_UP_MS);
    this.publish({waitingForWake:false});this.setState('idle');void this.capture();
  }
  async speak(text:string,onDone?:()=>void,resume=true){
    const epoch=++this.epoch;this.accepting=false;this.recognitionAdapter.stop();this.audioAnalyser.stop();this.publish({micOn:false});
    const done=()=>{if(epoch!==this.epoch)return;if(this.synthesisAdapter.lastError)this.events.onError?.(this.synthesisAdapter.lastError);if(resume)this.completeTurn();else this.setState('idle');onDone?.();};
    const started=await this.synthesisAdapter.speak(text,()=>this.setState('speaking'),done);
    if(!started&&epoch===this.epoch)done();
  }
  interrupt(){this.epoch++;this.synthesisAdapter.cancel();this.events.onAudioLevel?.(0);this.completeTurn();}
  destroy(){this.unsubscribeMode();if(typeof window!=='undefined')window.removeEventListener?.('offline',this.offlineAudio);this.stopListening();this.synthesisAdapter.cancel();this.events={};}
}
export const globalVoiceEngine=new VoiceEngine();
