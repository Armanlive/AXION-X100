import {Room,RoomEvent,LocalAudioTrack,Track} from 'livekit-client';

export interface LiveKitVoiceConfig {url:string;token:string;agent:string;pcmStreaming?:boolean}
type AudioCallbacks={onOutputLevel?:(level:number)=>void;onOutputStarted?:()=>void;onOutputEnded?:()=>void};
let config:LiveKitVoiceConfig|null=null;
export function configureLiveKit(value:LiveKitVoiceConfig|null){
 if(value){const url=new URL(value.url);if(url.protocol!=='wss:'&&!(url.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Use WSS, or WS only on localhost.');if(url.username||url.password||!value.token.trim()||!value.agent.trim())throw Error('A scoped token and worker identity are required.');}
 config=value;
}
export const liveKitConfigured=()=>!!config;
const PCM_RATE=16_000,PCM_FRAME=320;
const clamp=(value:number)=>Math.max(-1,Math.min(1,value));
function int16(bytes:Uint8Array){const values=new Int16Array(Math.floor(bytes.byteLength/2));for(let index=0;index<values.length;index++)values[index]=bytes[index*2]|(bytes[index*2+1]<<8);return values;}

/** Actual microphone samples, resampled to 16 kHz. This class never opens a network connection. */
class PcmCapture {
 private context:AudioContext|null=null;private source:MediaStreamAudioSourceNode|null=null;private processor:ScriptProcessorNode|null=null;private pending:number[]=[];
 private send:(pcm:Uint8Array<ArrayBuffer>)=>void;
 constructor(send:(pcm:Uint8Array<ArrayBuffer>)=>void){this.send=send;}
 async start(stream:MediaStream){
  if(typeof AudioContext==='undefined'||typeof ScriptProcessorNode==='undefined')return false;
  try{this.context=new AudioContext();await this.context.resume();this.source=this.context.createMediaStreamSource(stream);this.processor=this.context.createScriptProcessor(2048,1,1);const rate=this.context.sampleRate;
   this.processor.onaudioprocess=event=>{event.outputBuffer.getChannelData(0).fill(0);const source=event.inputBuffer.getChannelData(0),output:number[]=[],ratio=rate/PCM_RATE;for(let position=0;position<source.length;position+=ratio){const low=Math.floor(position),high=Math.min(source.length-1,low+1),fraction=position-low;output.push(source[low]*(1-fraction)+source[high]*fraction);}this.pending.push(...output);while(this.pending.length>=PCM_FRAME){const frame=this.pending.splice(0,PCM_FRAME),bytes=new Uint8Array(PCM_FRAME*2);frame.forEach((sample,index)=>{const value=Math.round(clamp(sample)*32767);bytes[index*2]=value&255;bytes[index*2+1]=(value>>8)&255;});this.send(bytes);}};
   this.source.connect(this.processor);this.processor.connect(this.context.destination);return true;
  }catch{return false;}
 }
 stop(){this.pending=[];this.source?.disconnect();this.processor?.disconnect();if(this.processor)this.processor.onaudioprocess=null;this.source=null;this.processor=null;void this.context?.close().catch(()=>{});this.context=null;}
}

/** Schedules genuine 16 kHz PCM chunks through Web Audio. No timer-generated audio is used. */
class PcmPlayer {
 private context:AudioContext|null=null;private nextTime=0;private sources=new Set<AudioBufferSourceNode>();private tail:ReturnType<typeof setTimeout>|undefined;private active=false;
 private callbacks:AudioCallbacks;
 constructor(callbacks:AudioCallbacks){this.callbacks=callbacks;}
 async play(bytes:Uint8Array){
  if(!bytes.byteLength||typeof AudioContext==='undefined')return;
  try{if(!this.context)this.context=new AudioContext();await this.context.resume();const samples=int16(bytes);if(!samples.length)return;const buffer=this.context.createBuffer(1,samples.length,PCM_RATE),channel=buffer.getChannelData(0);let sum=0;for(let index=0;index<samples.length;index++){channel[index]=samples[index]/32768;sum+=channel[index]*channel[index];}const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);source.onended=()=>this.sources.delete(source);const now=this.context.currentTime;this.nextTime=Math.max(this.nextTime,now+.015);source.start(this.nextTime);this.nextTime+=buffer.duration;this.sources.add(source);if(!this.active){this.active=true;this.callbacks.onOutputStarted?.();}this.callbacks.onOutputLevel?.(Math.min(1,Math.sqrt(sum/samples.length)*5));clearTimeout(this.tail);this.tail=setTimeout(()=>this.finish(),Math.ceil((this.nextTime-now)*1000)+180);
  }catch{/* Optional direct playback must not discard an otherwise valid transcript. */}
 }
 private finish(){if(!this.active)return;this.active=false;this.callbacks.onOutputLevel?.(0);this.callbacks.onOutputEnded?.();}
 stop(){clearTimeout(this.tail);for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();this.nextTime=0;this.finish();void this.context?.close().catch(()=>{});this.context=null;}
}

/** LiveKit transport: WebRTC microphone track plus compatible 16 kHz PCM data packets. */
export class LiveSessionManager {
 private room:Room|null=null;private epoch=0;private timer:ReturnType<typeof setTimeout>|undefined;private turn='';private mic:LocalAudioTrack|null=null;private pcm:PcmCapture|null=null;private player:PcmPlayer;
 private transcript:(text:string,final:boolean)=>void;private listening:()=>void;private error:(message:string)=>void;
 private createRoom:()=>Room;private createTrack:(track:MediaStreamTrack)=>LocalAudioTrack;
 constructor(transcript:(text:string,final:boolean)=>void,listening:()=>void,error:(message:string)=>void,createRoom:()=>Room=()=>new Room(),createTrack:(track:MediaStreamTrack)=>LocalAudioTrack=track=>new LocalAudioTrack(track,undefined,true),audio:AudioCallbacks={}){this.transcript=transcript;this.listening=listening;this.error=error;this.createRoom=createRoom;this.createTrack=createTrack;this.player=new PcmPlayer(audio);}
 async start(stream:MediaStream|null,mode:string){
  if(!config||!stream){this.error('LiveKit or microphone stream is unavailable.');return;}this.stop();const epoch=this.epoch,settings={...config},room=this.room=this.createRoom(),turn=this.turn=crypto.randomUUID();
  room.on(RoomEvent.DataReceived,(bytes,participant,_kind,topic)=>{if(epoch!==this.epoch||participant?.identity!==settings.agent)return;if(topic==='axion.audio.pcm'){void this.player.play(bytes);return;}if(topic!=='axion.stt'||bytes.length>12000)return;try{const data=JSON.parse(new TextDecoder().decode(bytes));if(data.turnId!==turn)return;if(data.error){this.stop();this.error('LiveKit transcription failed. Check the worker configuration.');}else if(typeof data.text==='string'&&data.text.trim()){clearTimeout(this.timer);this.transcript(data.text.trim(),true);}}catch{/* Ignore unrelated worker data. */}});
  room.on(RoomEvent.Disconnected,()=>{if(epoch===this.epoch){this.stop();this.error('LiveKit disconnected. Enable the microphone to reconnect.');}});
  try{await room.connect(settings.url,settings.token,{autoSubscribe:true});if(epoch!==this.epoch){await room.disconnect();return;}if(!room.remoteParticipants.has(settings.agent))throw Error('Worker unavailable');await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({command:'start',turnId:turn,mode,audioFormat:settings.pcmStreaming===false?undefined:{codec:'pcm_s16le',sampleRate:PCM_RATE,channels:1,frameSamples:PCM_FRAME,topic:'axion.audio.pcm'}})),{reliable:true,topic:'axion.control',destinationIdentities:[settings.agent]});if(epoch!==this.epoch){await room.disconnect();return;}const input=stream.getAudioTracks()[0];if(!input||input.readyState!=='live')throw Error('Microphone ended');this.mic=this.createTrack(input.clone());await room.localParticipant.publishTrack(this.mic,{source:Track.Source.Microphone});if(settings.pcmStreaming!==false){this.pcm=new PcmCapture(bytes=>{if(epoch===this.epoch&&this.room===room)void room.localParticipant.publishData(bytes,{reliable:false,topic:'axion.audio.pcm',destinationIdentities:[settings.agent]}).catch(()=>{});});await this.pcm.start(stream);}if(epoch!==this.epoch){this.stop();return;}this.listening();}
  catch{if(epoch===this.epoch){this.stop();this.error('LiveKit connection failed. Check server, scoped token and running worker.');}}
 }
 stop(flush=false){if(flush&&this.room){const room=this.room,turnId=this.turn;this.mic?.stop();this.mic=null;this.pcm?.stop();this.pcm=null;void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({command:'commit',turnId})),{reliable:true,topic:'axion.control',destinationIdentities:config?[config.agent]:[]}).catch(()=>{this.stop();this.error('Could not submit the voice turn.');});clearTimeout(this.timer);this.timer=setTimeout(()=>{this.stop();this.error('Transcription timed out.');},15000);return;}this.epoch++;clearTimeout(this.timer);this.mic?.stop();this.mic=null;this.pcm?.stop();this.pcm=null;this.player.stop();const room=this.room;this.room=null;if(room)void room.disconnect(true).catch(()=>{});}
}
/** Backward-compatible name used by the existing speech-recognition adapter. */
export {LiveSessionManager as LiveKitRecognition};
