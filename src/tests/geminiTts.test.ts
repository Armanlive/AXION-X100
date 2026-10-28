import {it,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {buildGeminiTtsRequest,extractGeminiAudio,synthesizeGeminiSpeech,pcmToWav,HINGLISH_STYLE,DEFAULT_GEMINI_TTS_MODEL,DEFAULT_GEMINI_TTS_VOICE} from '../services/geminiTtsService.ts';
import {setFishAudioConfigured} from '../services/fishAudioService.ts';
import {SpeechSynthesisAdapter} from '../utils/voiceEngine.ts';
afterEach(()=>{setFishAudioConfigured(false);delete (globalThis as any).window;delete (globalThis as any).isTauri;});
const ascii=(bytes:Uint8Array,start:number,end:number)=>String.fromCharCode(...bytes.subarray(start,end));
function mockDeviceSpeech(){
 const spoken:string[]=[];
 class Utterance {lang='';rate=1;pitch=1;voice:any;onstart:()=>void=()=>{};onend:()=>void=()=>{};onerror:()=>void=()=>{};text:string;constructor(text:string){this.text=text;}}
 (globalThis as any).SpeechSynthesisUtterance=Utterance;
 return {spoken,speechSynthesis:{getVoices:()=>[],addEventListener:()=>{},removeEventListener:()=>{},cancel:()=>{},speak:(u:any)=>{spoken.push(u.text);u.onstart();u.onend();}}};
}

it('builds a 3.8 request with the Hinglish style as speech metadata, not spoken text',()=>{
 const {model,payload}=buildGeminiTtsRequest('  नमस्ते सर  ');
 assert.equal(model,DEFAULT_GEMINI_TTS_MODEL);
 assert.deepEqual(payload.contents[0].parts[0],{text:'नमस्ते सर',speechMetadata:{style:HINGLISH_STYLE}});
 assert.deepEqual(payload.generationConfig.responseModalities,['AUDIO']);
 assert.equal(payload.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,DEFAULT_GEMINI_TTS_VOICE);
 assert.ok(!JSON.stringify(payload).match(/key/i));
});
it('older preview models get the style as a spoken-style prefix',()=>{
 const {payload}=buildGeminiTtsRequest('Hello',{model:'gemini-2.5-flash-preview-tts',voice:'Kore'});
 assert.match((payload.contents[0].parts[0] as any).text,/^Say this in a .*tone: Hello$/);
 assert.equal(payload.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Kore');
});
it('wraps raw 24 kHz PCM in a WAV header and passes WAV through untouched',()=>{
 const pcm=new Uint8Array([1,2,3,4]);
 const fromPcm=extractGeminiAudio({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;codec=pcm;rate=24000',data:Buffer.from(pcm).toString('base64')}}]}}]});
 assert.equal(ascii(fromPcm,0,4),'RIFF');assert.equal(ascii(fromPcm,8,12),'WAVE');
 assert.equal(new DataView(fromPcm.buffer).getUint32(24,true),24000);assert.deepEqual([...fromPcm.subarray(44)],[1,2,3,4]);
 const wav=pcmToWav(pcm,16000);
 const passed=extractGeminiAudio({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/wav',data:Buffer.from(wav).toString('base64')}}]}}]});
 assert.deepEqual([...passed],[...wav]);
 assert.throws(()=>extractGeminiAudio({candidates:[{content:{parts:[{text:'no audio'}]}}]}),/no audio/);
});
it('desktop synthesis goes through the vault-backed provider proxy without a key',async()=>{
 let call:any;
 (globalThis as any).isTauri=true;
 (globalThis as any).window={isTauri:true,__TAURI_INTERNALS__:{invoke:async(command:string,args:any)=>{call={command,args};return {candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:Buffer.from([0,0]).toString('base64')}}]}}]};}}};
 const audio=await synthesizeGeminiSpeech('Hello');
 assert.equal(call.command,'provider_request');assert.equal(call.args.provider,'gemini');assert.equal(call.args.model,DEFAULT_GEMINI_TTS_MODEL);
 assert.equal(call.args.apiKey,undefined);assert.equal(audio.byteLength,46);
});
it('Gemini failure falls back to device speech without surfacing an error',async()=>{
 const device=mockDeviceSpeech();
 (globalThis as any).isTauri=true;
 (globalThis as any).window={isTauri:true,speechSynthesis:device.speechSynthesis,__TAURI_INTERNALS__:{invoke:async()=>{throw 'Provider HTTP 429: Quota or rate limit reached';}}};
 const adapter=new SpeechSynthesisAdapter();adapter.setVoiceSettings('Default',1,1,'auto','gemini');
 let started=0,ended=0;
 assert.equal(await adapter.speak('Hello Sir',()=>started++,()=>ended++),true);
 assert.equal(adapter.lastError,'');assert.deepEqual(device.spoken,['Hello Sir']);assert.equal(started,1);assert.equal(ended,1);
});
it('Gemini failure falls back to Fish Audio when it is configured',async()=>{
 const commands:string[]=[];
 setFishAudioConfigured(true);
 (globalThis as any).isTauri=true;
 (globalThis as any).window={isTauri:true,speechSynthesis:mockDeviceSpeech().speechSynthesis,__TAURI_INTERNALS__:{invoke:async(command:string)=>{commands.push(command);throw 'offline';}}};
 const adapter=new SpeechSynthesisAdapter();adapter.setVoiceSettings('Default',1,1,'auto','gemini');
 assert.equal(await adapter.speak('Hello'),true);
 assert.deepEqual(commands,['provider_request','fish_audio_tts']);
});
