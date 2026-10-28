import {invoke,isTauri} from '@tauri-apps/api/core';
export const FISH_AUDIO_API_URL='https://api.fish.audio/v1/tts';
export const DEFAULT_FISH_AUDIO_KEY='';
export const DEFAULT_FISH_AUDIO_MODEL='s2.1-pro';
export const FISH_AUDIO_MODELS=[{id:'s2.1-pro',name:'Fish Audio S2.1 Pro',description:'Neural speech'},{id:'s2-pro',name:'Fish Audio S2 Pro',description:'Neural speech'},{id:'drama-3',name:'Fish Audio Drama 3',description:'Expressive speech'}];
let configured=false;
export function setFishAudioConfigured(value:boolean){configured=value;}
export function isFishAudioConfigured(){return configured;}
export function getFishAudioKey(){return '';}
export function saveFishAudioKey(_key:string){/* Credentials are saved only through connectProvider and the native vault. */}
export function getFishAudioModel(){try{return localStorage.getItem('axion_fish_audio_model')||DEFAULT_FISH_AUDIO_MODEL;}catch{return DEFAULT_FISH_AUDIO_MODEL;}}
export function saveFishAudioModel(model:string){localStorage.setItem('axion_fish_audio_model',model);}
export interface FishAudioOptions {
  apiKey?: string;
  model?: string;
  referenceId?: string;
  format?: 'mp3' | 'wav' | 'opus';
  signal?: AbortSignal;
}


export async function synthesizeFishAudio(text:string,options?:FishAudioOptions):Promise<ArrayBuffer>{
 if(options?.signal?.aborted)throw Error('Speech cancelled');
 if(!isTauri())throw Error('Fish Audio requires the desktop credential vault. Device speech remains available.');
 const bytes=await invoke<number[]>('fish_audio_tts',{text:text.trim(),apiKey:options?.apiKey||null,model:options?.model||getFishAudioModel(),referenceId:options?.referenceId||null});
 if(options?.signal?.aborted)throw Error('Speech cancelled');
 if(!bytes.length)throw Error('Fish Audio returned empty audio');
 return new Uint8Array(bytes).buffer;
}
export async function testFishAudioConnection(apiKey?:string):Promise<{success:boolean;statusCode?:number;latencyMs?:number;message?:string}>{
 if(!isTauri())return {success:false,message:'Test Fish Audio in the desktop app.'};
 try{return await invoke('fish_audio_test',{apiKey:apiKey||null});}catch(error){return {success:false,message:String(error)};}
}
