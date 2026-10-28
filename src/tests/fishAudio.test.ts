import {it,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {getFishAudioKey,saveFishAudioKey,isFishAudioConfigured,setFishAudioConfigured,synthesizeFishAudio,testFishAudioConnection,DEFAULT_FISH_AUDIO_KEY} from '../services/fishAudioService.ts';
import {SpeechSynthesisAdapter} from '../utils/voiceEngine.ts';
afterEach(()=>{setFishAudioConfigured(false);delete (globalThis as any).window;delete (globalThis as any).isTauri;});
it('does not ship a default credential or manufacture verified connectivity',()=>{assert.equal(DEFAULT_FISH_AUDIO_KEY,'');assert.equal(getFishAudioKey(),'');assert.equal(isFishAudioConfigured(),false);saveFishAudioKey('fake-test-key');assert.equal(getFishAudioKey(),'');});
it('desktop speech uses the saved vault key without returning it to renderer',async()=>{
 let args:any;
 (globalThis as any).isTauri=true;
 (globalThis as any).window={isTauri:true,__TAURI_INTERNALS__:{invoke:async(command:string,payload:any)=>{assert.equal(command,'fish_audio_tts');args=payload;return [73,68,51];}}};
 const audio=await synthesizeFishAudio('Hello');assert.equal(audio.byteLength,3);assert.equal(args.apiKey,null);assert.equal(args.text,'Hello');
});
it('browser preview cannot pretend a provider verification succeeded',async()=>{const result=await testFishAudioConnection();assert.equal(result.success,false);await assert.rejects(()=>synthesizeFishAudio('Hello'),/desktop/);});
it('Fish Audio failure falls back to device speech without surfacing a false hard failure',async()=>{
 setFishAudioConfigured(true);let started=0,ended=0;
 class Utterance {lang='';rate=1;pitch=1;voice:any;onstart:()=>void=()=>{};onend:()=>void=()=>{};onerror:()=>void=()=>{};constructor(_text:string){}}
 (globalThis as any).SpeechSynthesisUtterance=Utterance;
 (globalThis as any).window={speechSynthesis:{getVoices:()=>[],addEventListener:()=>{},removeEventListener:()=>{},cancel:()=>{},speak:(utterance:any)=>{utterance.onstart();utterance.onend();}}};
 const adapter=new SpeechSynthesisAdapter();adapter.setVoiceSettings('Default',1,1,'auto','fishaudio');assert.equal(await adapter.speak('Hello',()=>started++,()=>ended++),true);assert.equal(adapter.lastError,'');assert.equal(started,1);assert.equal(ended,1);
});
