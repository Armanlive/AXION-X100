import {it} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechRecognitionAdapter, MicrophoneAudioAnalyser} from '../utils/voiceEngine.ts';
it('unsupported recognition reports transport availability, not denied permission',()=>{
 const adapter=new SpeechRecognitionAdapter();let error='';
 adapter.setCallbacks(()=>{},()=>{},value=>error=value);adapter.start();
 assert.match(error,/runtime/);assert.match(error,/LiveKit/);
});
it('microphone device errors preserve their cause and release state',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{throw new DOMException('Busy','NotReadableError');}}}});
 const analyser=new MicrophoneAudioAnalyser();assert.equal(await analyser.start(),false);
 assert.match(analyser.lastError,/another application/);assert.equal(analyser.getStream(),null);
});
it('recognition restart waits for abort completion and ignores late transcripts',async()=>{
 let rec:any;let starts=0;let results=0;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{SpeechRecognition:class {constructor(){rec=this;}start(){starts++;}abort(){}stop(){}}}});
 const adapter=new SpeechRecognitionAdapter();adapter.setCallbacks(()=>results++,()=>{},()=>{});
 adapter.start();rec.onstart();adapter.stop();adapter.start();assert.equal(starts,1);
 rec.onresult({resultIndex:0,results:[Object.assign([{transcript:'late'}],{isFinal:true})]});assert.equal(results,0);
 rec.onend();await new Promise(resolve=>setTimeout(resolve,280));assert.equal(starts,2);adapter.stop();
 delete (globalThis as any).window;
});
