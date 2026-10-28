import {chromium} from 'file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();page.setDefaultTimeout(10000);const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
await page.goto('http://127.0.0.1:3000');
const engineChecks=await page.evaluate(async()=>{
 const fixture={recognitions:[],utterances:[],tracks:[]};window.__voiceFixture=fixture;
 class Recognition {
  start(){queueMicrotask(()=>this.onstart?.());}abort(){queueMicrotask(()=>this.onend?.());}stop(){queueMicrotask(()=>this.onend?.());}
  constructor(){fixture.recognitions.push(this);}
  emit(text,final=true){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});}
 }
 window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=Recognition;
 const localVoices=[{name:'Local Hindi',lang:'hi-IN',localService:true},{name:'Local English',lang:'en-IN',localService:true}];
 class Synth extends EventTarget {getVoices(){return localVoices;}cancel(){}speak(u){fixture.utterances.push(u);queueMicrotask(()=>u.onstart?.());}}
 Object.defineProperty(window,'speechSynthesis',{value:new Synth(),configurable:true});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 const stream=()=>{const track={stopped:false,stop(){this.stopped=true;}};fixture.tracks.push(track);return {getTracks:()=>[track]};};
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>stream(),configurable:true,writable:true});
 window.AudioContext=class{state='running';async resume(){}async close(){this.state='closed';}createAnalyser(){return{fftSize:2048,getFloatTimeDomainData:a=>a.fill(0)}}createMediaStreamSource(){return{connect(){},disconnect(){}}}};
 const {VoiceEngine}=await import('/src/utils/voiceEngine.ts');const checks=[];const check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};const tick=()=>new Promise(r=>setTimeout(r,35));
 const transcript=[];const errors=[];const engine=new VoiceEngine({onTranscript:(s,f)=>{if(f)transcript.push(s)},onError:e=>errors.push(e)});
 const settings={language:'hi',voiceName:'Default Voice',speed:1,autoSpeak:true,listeningMode:'wake-word',doubleClap:false};
 engine.configure(settings);engine.startListening();await tick();const recognition=fixture.recognitions.at(-1);
 check(engine.getActivationStatus().micOn,'Mic indicator follows acquired stream');recognition.emit('background television');check(transcript.length===0,'Background speech is ignored while waiting for wake');
 recognition.emit('Hello AXION');await tick();check(fixture.utterances.length===1,'Wake phrase produces one acknowledgement');check(!engine.getActivationStatus().micOn,'Microphone releases while acknowledgement plays');
 fixture.utterances.at(-1).onend();await tick();check(engine.getActivationStatus().micOn&&!engine.getActivationStatus().waitingForWake,'Wake acknowledgement arms next question');
 recognition.emit('आज मौसम कैसा है');recognition.emit('duplicate recognition');check(transcript.length===1,'One final question submits once and suppresses duplicate results');
 engine.completeTurn();await tick();check(engine.getActivationStatus().waitingForWake,'Completed turn returns to wake waiting');
 recognition.emit('Hello AXION, मेरी बात सुनो');check(transcript.at(-1)==='मेरी बात सुनो','Wake prefix is removed from combined wake-and-question');
 engine.completeTurn();await tick();engine.stopListening();recognition.emit('late transcript');check(transcript.length===2&&!engine.getActivationStatus().micOn,'Mute rejects late speech and clears mic indicator');
 check(fixture.tracks.every(t=>t.stopped),'All acquired tracks stop after mute');
 engine.configure({...settings,listeningMode:'push-to-talk'});engine.startListening();await tick();engine.finishListening();recognition.emit('बटन से बात');await tick();check(transcript.at(-1)==='बटन से बात','PTT release drains the final result');engine.completeTurn();await tick();check(!engine.getActivationStatus().micOn,'PTT does not restart after release/reply');
 const before=fixture.utterances.length;await engine.speak('नमस्ते');await tick();check(fixture.utterances.length===before+1,'One speak request queues one device utterance');fixture.utterances.at(-1).onend();engine.destroy();
 const clapEngine=new VoiceEngine();clapEngine.configure({...settings,doubleClap:true},false);clapEngine.startListening();await tick();
 clapEngine.audioAnalyser.onSample(.15,.8,100);clapEngine.audioAnalyser.onSample(.01,.03,130);clapEngine.audioAnalyser.onSample(.15,.8,430);clapEngine.audioAnalyser.onSample(.01,.03,460);await tick();
 check(!clapEngine.getActivationStatus().waitingForWake&&clapEngine.getActivationStatus().micOn,'Two synthetic clap transients arm the question listener');clapEngine.destroy();
 let release;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>new Promise(r=>release=r),configurable:true});
 const pending=new VoiceEngine();pending.configure(settings);pending.startListening();pending.destroy();const late=stream();release(late);await tick();check(late.getTracks()[0].stopped,'Late permission result is released after destroy');
 return {checks,errors,note:'Synthetic browser speech/microphone adapters for lifecycle tests; no live microphone/TTS hardware verification.'};
});
let body;let fail=false;
await page.route('https://generativelanguage.googleapis.com/**',async route=>{
 body=route.request().postDataJSON();if(fail){await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:403,message:'fixture denied',status:'PERMISSION_DENIED'}})});return;}
 await route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({text:'Main theek hoon. Aap kaise hain?',speechText:'मैं ठीक हूँ। आप कैसे हैं?'})}]},finishReason:'STOP'}]})+'\n\n'});
});
const conversationChecks=await page.evaluate(async()=>{
 const {orchestrateAIRequest,detectCommandIntent}=await import('/src/utils/aiOrchestrator.ts');const checks=[];const check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 const context={workspaceName:'No Active Workspace',workspacePath:'Disconnected',files:{},activeAgent:{name:'Fullstack'},isBossLocked:true,availableAgents:[],isVoice:true};
 async function run(text,key){let complete='',error='',chunks='';await orchestrateAIRequest(text,[],{...context,geminiApiKey:key},{onChunk:s=>chunks=s,onComplete:s=>complete=s,onError:s=>error=s});return{complete,error,chunks};}
 const greeting=await run('एक्शन');check(greeting.complete.includes('sun raha')&&!greeting.complete.includes('Fullstack'),'AXION name receives a greeting without old specialist template');
 const missing=await run('मुझे कहानी सुनाओ');check(missing.error.includes('API key')&&!missing.complete,'Missing provider clearly asks for configuration instead of fake AI output');
 check(detectCommandIntent('Do not open terminal')===null,'Mentioned/negated controls do not execute');check(detectCommandIntent('टर्मिनल खोलो')==='open_terminal','Direct Hindi panel command is recognized');
 const real=await run('तुम कैसे हो?','fixture-not-a-real-key');check(real.complete==='Main theek hoon. Aap kaise hain?','Provider stream returns conversational content');return checks;
});
assert.equal(body.contents.filter(x=>x.role==='user').length,1);assert.equal(body.contents[0].parts[0].text,'तुम कैसे हो?');conversationChecks.push('Original prompt occurs once with no technical-intent rewrite');
fail=true;
const providerFailure=await page.evaluate(async()=>{const {orchestrateAIRequest}=await import('/src/utils/aiOrchestrator.ts');let error='';await orchestrateAIRequest('मुझे कहानी सुनाओ',[],{workspaceName:'None',workspacePath:'',files:{},activeAgent:{name:'AXION'},isBossLocked:true,availableAgents:[],geminiApiKey:'fixture-key'},{onChunk:()=>{},onComplete:()=>{},onError:e=>error=e});return error;});assert.ok(providerFailure.includes('API key'));conversationChecks.push('Provider rejection is surfaced without repeating the fallback template');
assert.deepEqual(pageErrors,[]);await writeFile('artifacts/voice-conversation/browser-checks.json',JSON.stringify({engineChecks,conversationChecks,pageErrors},null,2));console.log(JSON.stringify({engineChecks,conversationChecks},null,2));await browser.close();
