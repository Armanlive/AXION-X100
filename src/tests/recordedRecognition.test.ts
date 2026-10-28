import {it,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {RecordedRecognition} from '../utils/recordedRecognition.ts';
let recorder:any;
class FakeRecorder {
 static isTypeSupported(){return true;}state='inactive';onstop?:()=>void;ondataavailable?:(e:any)=>void;onerror?:()=>void;
 constructor(){recorder=this;}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['real-test-bytes'])});queueMicrotask(()=>this.onstop?.());}
}
const stream:any={getAudioTracks:()=>[{readyState:'ended'}]};
const tick=()=>new Promise(r=>setTimeout(r,10));
afterEach(()=>delete (globalThis as any).MediaRecorder);
it('flush submits a voiced utterance once, never fabricates text',async()=>{
 (globalThis as any).MediaRecorder=FakeRecorder;let calls=0;const texts:string[]=[];
 const input=new RecordedRecognition(async bytes=>{calls++;assert.ok(bytes.length);return 'Hello AXION';},text=>texts.push(text),assert.fail);
 input.start(stream);input.sample(.05,performance.now());input.stop(true);await tick();assert.equal(calls,1);assert.deepEqual(texts,['Hello AXION']);input.stop();
});
it('mute drops pending transcripts, and silence never uploads',async()=>{
 (globalThis as any).MediaRecorder=FakeRecorder;let calls=0;let resolve!:(s:string)=>void;const texts:string[]=[];
 const input=new RecordedRecognition(async()=>{calls++;return new Promise(r=>resolve=r);},t=>texts.push(t),assert.fail);
 input.start(stream);input.stop(true);await tick();assert.equal(calls,0);
 input.start(stream);input.sample(.06,performance.now());input.stop(true);await tick();assert.equal(calls,1);input.stop();resolve('late');await tick();assert.deepEqual(texts,[]);
});
it('cancel before recorder stop never uploads',async()=>{
 (globalThis as any).MediaRecorder=FakeRecorder;const input=new RecordedRecognition(async()=>{assert.fail('unexpected upload');return '';},assert.fail,assert.fail);
 input.start(stream);input.sample(.1,performance.now());input.stop();await tick();
});
