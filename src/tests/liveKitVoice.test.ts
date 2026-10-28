import {it,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {RoomEvent} from 'livekit-client';
import {configureLiveKit,liveKitConfigured,LiveKitRecognition,LiveSessionManager} from '../utils/liveKitVoice.ts';
afterEach(()=>configureLiveKit(null));
const setup=()=>{configureLiveKit({url:'ws://127.0.0.1:7880',token:'test-not-a-real-token',agent:'worker'});};
function fixture(){
 const callbacks=new Map<string,Function>();const sent:any[]=[];let disconnected=0,stopped=0,published=0;
 const room:any={remoteParticipants:new Map([['worker',{}]]),on:(event:string,fn:Function)=>callbacks.set(event,fn),connect:async()=>{},disconnect:async()=>{disconnected++;},localParticipant:{publishData:async(bytes:Uint8Array)=>{sent.push(JSON.parse(new TextDecoder().decode(bytes)));},publishTrack:async()=>{published++;}}};
 const stream:any={getAudioTracks:()=>[{readyState:'live',clone:()=>({})}]};
 const track:any={stop:()=>{stopped++;}};
 return {room,stream,track,callbacks,sent,counts:()=>({disconnected,stopped,published})};
}
it('rejects insecure remote transport and keeps configuration optional',()=>{
 assert.equal(liveKitConfigured(),false);
 assert.throws(()=>configureLiveKit({url:'ws://public.example',token:'x',agent:'worker'}));
 assert.throws(()=>configureLiveKit({url:'wss://user:pass@example.com',token:'x',agent:'worker'}));
 setup();assert.equal(liveKitConfigured(),true);
 assert.equal(LiveSessionManager,LiveKitRecognition);
});
it('accepts only scoped worker transcripts for the current turn and cleans up',async()=>{
 setup();const f=fixture();const replies:string[]=[];let listening=0;
 const adapter=new LiveKitRecognition(t=>replies.push(t),()=>listening++,()=>assert.fail('Unexpected transport failure'),()=>f.room,()=>f.track);
 await adapter.start(f.stream,'continuous');assert.equal(listening,1);assert.equal(f.counts().published,1);
 const deliver=f.callbacks.get(RoomEvent.DataReceived)!;
 const bytes=(turn:string)=>new TextEncoder().encode(JSON.stringify({turnId:turn,text:'hello'}));
 deliver(bytes(f.sent[0].turnId),{identity:'other'},null,'axion.stt');
 deliver(bytes('old-turn'),{identity:'worker'},null,'axion.stt');assert.equal(replies.length,0);
 deliver(bytes(f.sent[0].turnId),{identity:'worker'},null,'axion.stt');assert.deepEqual(replies,['hello']);
 adapter.stop();assert.equal(f.counts().stopped,1);
 deliver(bytes(f.sent[0].turnId),{identity:'worker'},null,'axion.stt');assert.equal(replies.length,1);
});
it('cancellation during connection never publishes a late microphone',async()=>{
 setup();const f=fixture();let release!:()=>void;f.room.connect=()=>new Promise<void>(resolve=>release=resolve);
 const adapter=new LiveKitRecognition(()=>{},()=>assert.fail('Late listening'),()=>{},()=>f.room,()=>f.track);
 const start=adapter.start(f.stream,'continuous');adapter.stop();release();await start;
 assert.equal(f.counts().published,0);assert.equal(f.sent.length,0);
});
it('PTT release stops the outgoing track and commits exactly the current turn',async()=>{
 setup();const f=fixture();const adapter=new LiveKitRecognition(()=>{},()=>{},()=>{},()=>f.room,()=>f.track);
 await adapter.start(f.stream,'push-to-talk');adapter.stop(true);
 assert.equal(f.counts().stopped,1);assert.equal(f.sent[1].command,'commit');assert.equal(f.sent[1].turnId,f.sent[0].turnId);adapter.stop();
});
it('announces the negotiated PCM format while retaining the compatible microphone track',async()=>{
 setup();const f=fixture();const adapter=new LiveKitRecognition(()=>{},()=>{},()=>{},()=>f.room,()=>f.track);
 await adapter.start(f.stream,'continuous');const start=f.sent[0];assert.equal(start.command,'start');assert.deepEqual(start.audioFormat,{codec:'pcm_s16le',sampleRate:16000,channels:1,frameSamples:320,topic:'axion.audio.pcm'});assert.equal(f.counts().published,1);adapter.stop();
});
