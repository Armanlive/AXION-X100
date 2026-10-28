import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {parseWakePhrase,DoubleClapDetector,selectDeviceVoice,localGreeting} from '../utils/voiceActivation.ts';
import {normalizeVoiceInput,prepareTextForSpeech} from '../utils/voiceNormalizer.ts';
describe('Conversational voice safeguards',()=>{
 it('recognizes English and Hindi wake phrases with a remaining question',()=>{
  assert.deepEqual(parseWakePhrase('Hello AXION, how are you?'),{matched:true,remainder:'how are you?'});
  assert.deepEqual(parseWakePhrase('हेलो एक्सॉन, क्या हाल है?'),{matched:true,remainder:'क्या हाल है?'});
 });
 it('does not wake on unrelated speech or a name substring',()=>{
  for(const text of ['tell me about hello axion','hello axionics','hello there','एक्शन'])assert.equal(parseWakePhrase(text).matched,false);
 });
 it('acknowledges misheard AXION name without creating a technical task',()=>{
  assert.ok(localGreeting('एक्सॉन'));assert.equal(normalizeVoiceInput('एक्शन').actionType,'general_task');assert.equal(normalizeVoiceInput('एक्शन').normalizedEnglish,'एक्शन');
 });
 it('does not infer a header edit from short greeting/dictionary substrings',()=>{
  assert.equal(normalizeVoiceInput('bhai').targetComponent,undefined);assert.equal(normalizeVoiceInput('').targetComponent,undefined);
 });
 it('selects a matching local Hindi voice over the first English or cloud voice',()=>{
  const voices=[{name:'English',lang:'en-US',localService:true},{name:'Cloud Natural Hindi',lang:'hi-IN',localService:false},{name:'Hindi',lang:'hi-IN',localService:true}];
  assert.equal(selectDeviceVoice(voices,'Default Voice','नमस्ते')?.name,'Hindi');assert.equal(selectDeviceVoice(voices,'Cloud Natural Hindi','नमस्ते')?.name,'Hindi');
 });
 it('never fails a reply: falls back rather than returning undefined when only wrong-language voices exist',()=>{
  // Single remote Hindi voice, request default → still returns SOME voice rather than erroring
  const remote=selectDeviceVoice([{name:'Cloud',lang:'hi-IN',localService:false}],'Default Voice','नमस्ते');assert.ok(remote);
  // Only an English local voice for a Hindi reply → falls back to any local voice instead of undefined
  assert.equal(selectDeviceVoice([{name:'English',lang:'en-US',localService:true}],'Default Voice','नमस्ते')?.name,'English');
 });
 it('returns undefined only when no voices exist at all',()=>{
  assert.equal(selectDeviceVoice([],'Default Voice','नमस्ते'),undefined);
 });
 it('preserves explicit installed voice choice and prefers enhanced local voice automatically',()=>{
  const voices=[{name:'Hindi Basic',lang:'hi-IN',localService:true},{name:'Hindi Natural',lang:'hi-IN',localService:true}];
  assert.equal(selectDeviceVoice(voices,'Hindi Basic','नमस्ते')?.name,'Hindi Basic');assert.equal(selectDeviceVoice(voices,'Default Voice','नमस्ते')?.name,'Hindi Natural');
 });
 it('requires two distinct short transients separated by quiet',()=>{
  const d=new DoubleClapDetector();assert.equal(d.sample(.15,.8,100),false);assert.equal(d.sample(.01,.03,130),false);assert.equal(d.sample(.15,.8,430),false);assert.equal(d.sample(.01,.03,460),true);
  assert.equal(d.sample(.15,.8,500),false);
 });
 it('rejects continuous noise, overly fast pulses and widely separated peaks',()=>{
  for(const gap of [70,1000]){const d=new DoubleClapDetector();d.sample(.15,.8,100);d.sample(.01,.02,130);d.sample(.15,.8,100+gap);assert.equal(d.sample(.01,.02,130+gap),false);}
  const d=new DoubleClapDetector();for(let t=0;t<2000;t+=16)assert.equal(d.sample(.3,.8,t),false);assert.equal(d.sample(.01,.02,2100),false);
 });
 it('does not claim spoken code snippets were applied to the workspace',()=>{
  const text=prepareTextForSpeech('```js\nconst x=1;\n```');assert.ok(text.includes('chat'));assert.ok(!text.includes('update ready'));
 });
});

import {parseConversationReply,recoverConversationReply,spokenSummary} from '../utils/conversationLanguage.ts';
describe('Independent display script and spoken language',()=>{
 it('does not expose malformed provider JSON as chat content',()=>{
  assert.throws(()=>parseConversationReply('{"text":"hello"}'));
  assert.throws(()=>parseConversationReply('unstructured text'));
  assert.deepEqual(parseConversationReply('{"text":"Haan","speechText":"हाँ"}'),{text:'Haan',speechText:'हाँ'});
 });
 it('shows the text of a tool-call wrapped reply, never the raw JSON',()=>{
  const raw='Opening it.\n<tool_call>action>\n{"type":"open_app","name":"Excel"}\n{"text":"Opening Excel.","speechText":"Opening Excel."}';
  assert.deepEqual(recoverConversationReply(raw),{text:'Opening Excel.',speechText:'Opening Excel.'});
  const onlyAction=recoverConversationReply('Sure, launching it now. <tool_call>{"type":"open_app","name":"Excel"}</tool_call>');
  assert.equal(onlyAction.text,'Sure, launching it now.');
 });
 it('recovers real answers that ignore or break the JSON format instead of failing over',()=>{
  const md='## Audit\n\n- **Security:** keys are in .env. Rotate them.\n- Perf ok.';
  const plain=recoverConversationReply(md);
  assert.equal(plain.text,md);
  assert.equal(plain.speechText,'Audit Security: keys are in .env. Rotate them. Perf ok.');
  assert.deepEqual(recoverConversationReply('Sure! {"text":"Haan","speechText":"हाँ"} done'),{text:'Haan',speechText:'हाँ'});
  assert.equal(recoverConversationReply('{"text":"hello"}').speechText,'hello');
  const cut=recoverConversationReply('{"text":"## Report\\n- item one\\n- item tw');
  assert.equal(cut.text,'## Report\n- item one\n- item tw');
  assert.throws(()=>recoverConversationReply('   '));
  assert.equal(spokenSummary('```js\nx()\n``` Done. Next.'),'Done. Next.');
 });
});

it('does not force a selected Hindi voice onto an English reply',()=>{
 const voices=[{name:'Hindi',lang:'hi-IN',localService:true},{name:'English',lang:'en-IN',localService:true}];
 assert.equal(selectDeviceVoice(voices,'Hindi','Hello!')?.name,'English');
 assert.equal(selectDeviceVoice(voices,'English','नमस्ते')?.name,'Hindi');
});
