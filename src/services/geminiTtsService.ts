import {invoke,isTauri} from '@tauri-apps/api/core';

/**
 * Gemini text-to-speech through the desktop `provider_request` proxy, so the
 * Gemini key saved in Cloud Brain never reaches the renderer.
 * gemini-2.5-flash-preview-tts shuts down on 2026-11-17; the 3.8 models replace it.
 */
export const GEMINI_TTS_MODELS=[
 {id:'gemini-3.8-flash-lite-tts',name:'Gemini 3.8 Flash-Lite TTS',description:'Fastest, cheapest; made for voice assistants'},
 {id:'gemini-3.8-flash-tts',name:'Gemini 3.8 Flash TTS',description:'Most expressive, slower'},
 {id:'gemini-2.5-flash-preview-tts',name:'Gemini 2.5 Flash TTS (preview)',description:'Shuts down 17 Nov 2026'},
];
export const GEMINI_TTS_VOICES=[
 {id:'Achird',description:'Friendly'},{id:'Sulafat',description:'Warm'},{id:'Charon',description:'Informative'},
 {id:'Algieba',description:'Smooth'},{id:'Zubenelgenubi',description:'Casual'},{id:'Puck',description:'Upbeat'},
 {id:'Vindemiatrix',description:'Gentle'},{id:'Kore',description:'Firm'},
];
export const DEFAULT_GEMINI_TTS_MODEL='gemini-3.8-flash-lite-tts';
export const DEFAULT_GEMINI_TTS_VOICE='Achird';
/** Short and constant per Google's guidance: long persona prompts make the voice drift. */
export const HINGLISH_STYLE='warm, relaxed and conversational, like a friend chatting, natural pace';
const SAMPLE_RATE=24000;

export interface GeminiTtsOptions {model?:string;voice?:string;style?:string;signal?:AbortSignal;}

/** 3.8 models take style as speechMetadata; older models read it as a spoken-style prefix. */
export function buildGeminiTtsRequest(text:string,options:GeminiTtsOptions={}){
 const model=options.model||DEFAULT_GEMINI_TTS_MODEL;
 const style=options.style??HINGLISH_STYLE;
 const transcript=text.trim();
 const part=model.startsWith('gemini-3.8')
  ?{text:transcript,...(style?{speechMetadata:{style}}:{})}
  :{text:style?`Say this in a ${style} tone: ${transcript}`:transcript};
 return {
  model,
  payload:{
   contents:[{role:'user',parts:[part]}],
   generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:options.voice||DEFAULT_GEMINI_TTS_VOICE}}}},
  },
 };
}

function decodeBase64(data:string):Uint8Array{
 const binary=atob(data);const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}

/** Wraps headerless 16-bit mono PCM in a RIFF header so an <audio> element can play it. */
export function pcmToWav(pcm:Uint8Array,sampleRate=SAMPLE_RATE):Uint8Array{
 const out=new Uint8Array(44+pcm.length);const view=new DataView(out.buffer);
 const ascii=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)out[offset+i]=value.charCodeAt(i);};
 ascii(0,'RIFF');view.setUint32(4,36+pcm.length,true);ascii(8,'WAVE');ascii(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 ascii(36,'data');view.setUint32(40,pcm.length,true);out.set(pcm,44);
 return out;
}

/** 3.8 models return WAV by default; earlier ones return raw `audio/L16;rate=24000` PCM. */
export function extractGeminiAudio(response:any):Uint8Array{
 const parts:any[]=response?.candidates?.[0]?.content?.parts||[];
 const audio=parts.find(p=>p?.inlineData?.data);
 if(!audio)throw Error('Gemini returned no audio');
 const bytes=decodeBase64(audio.inlineData.data);
 if(!bytes.length)throw Error('Gemini returned empty audio');
 const isWav=bytes.length>12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF';
 if(isWav)return bytes;
 const rate=Number(/rate=(\d+)/.exec(audio.inlineData.mimeType||'')?.[1])||SAMPLE_RATE;
 return pcmToWav(bytes,rate);
}

export async function synthesizeGeminiSpeech(text:string,options:GeminiTtsOptions={}):Promise<ArrayBuffer>{
 if(options.signal?.aborted)throw Error('Speech cancelled');
 if(!isTauri())throw Error('Gemini speech requires the desktop credential vault.');
 const {model,payload}=buildGeminiTtsRequest(text,options);
 const response=await invoke('provider_request',{provider:'gemini',model,payload});
 if(options.signal?.aborted)throw Error('Speech cancelled');
 const wav=extractGeminiAudio(response);
 return wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength) as ArrayBuffer;
}
