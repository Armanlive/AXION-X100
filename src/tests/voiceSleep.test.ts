import {it} from 'node:test';
import assert from 'node:assert/strict';
import {VoiceEngine,recognitionLocale} from '../utils/voiceEngine.ts';

/** Engine with mic, recognizer and speech stubbed out; returns a way to feed final phrases. */
function harness(){
  const engine=new VoiceEngine();
  const r=engine.recognitionAdapter as any, a=engine.audioAnalyser as any, s=engine.synthesisAdapter as any;
  r.start=()=>{};r.stop=()=>{};r.restartIgnoredTurn=()=>{};r.checkAvailability=()=>true;
  r.setInputStream=()=>{};r.setMode=()=>{};r.setLanguage=()=>{};r.setRecordedEnabled=()=>{};
  a.start=async()=>true;a.stop=()=>{};a.getStream=()=>null;
  const spoken:string[]=[];
  s.speak=async(text:string,_start:()=>void,done:()=>void)=>{spoken.push(text);done();return true;};s.cancel=()=>{};s.setVoiceSettings=()=>{};
  const transcripts:string[]=[];
  engine.setEvents({onTranscript:(t,f)=>{if(f)transcripts.push(t);}});
  // Feed final recognizer results straight into the engine.
  const say=(t:string)=>(engine as any).receive(t,true);
  return {engine,say,spoken,transcripts};
}

it('sleeps on command, ignores everything until its name, then wakes',async()=>{
  const {engine,say,spoken,transcripts}=harness();
  engine.configure({language:'auto',voiceName:'x',speed:1,autoSpeak:true,listeningMode:'continuous',doubleClap:false},true);
  engine.startListening();
  say('AXION so jao');
  await new Promise(r=>setTimeout(r,0));
  assert.equal(engine.isSleeping(),true);
  assert.match(spoken.at(-1)!,/Going quiet/);
  assert.equal(engine.getActivationStatus().waitingForWake,true);
  say('Chrome kholo');
  assert.deepEqual(transcripts,[],'nothing reaches AXION while asleep');
  say('AXION, Chrome kholo');
  assert.equal(engine.isSleeping(),false);
  assert.deepEqual(transcripts,['Chrome kholo']);
  engine.destroy();
});

it('listens in the user\'s own language, not always Hindi',()=>{
  assert.equal(recognitionLocale('auto','es-ES'),'es-ES');
  assert.equal(recognitionLocale('auto','ar-SA'),'ar-SA');
  assert.equal(recognitionLocale('en','fr-FR'),'en-US');
  assert.equal(recognitionLocale('en','en-GB'),'en-GB');
  assert.equal(recognitionLocale('hinglish','en-US'),'hi-IN');
  assert.equal(recognitionLocale('hi','en-US'),'hi-IN');
});
