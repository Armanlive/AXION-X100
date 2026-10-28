import {it} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoute,providerForModel,providerPayload,providerText,getFallbackChain,isRateLimitOrTemporaryError} from '../utils/providerRouting.ts';
import type {AIModel,CloudProvider} from '../types/index.ts';
const provider=(type:CloudProvider['type']):CloudProvider=>({id:type,name:type,type,description:'',icon:'',isConnected:false,isPrimary:false,status:'untested',tier:'free',models:[],configured:true});
const names:Record<string,string>={gemini:'Google Gemini',openrouter:'OpenRouter',groq:'Groq',cloudflare:'Cloudflare',ollama:'Ollama Local'};
const model=(type:string):AIModel=>({id:type,name:type,provider:names[type],providerModelId:type==='openrouter'?'openrouter/free':type==='gemini'?'models/gemini-2.5-flash':'test-model',tier:'free',costPer1kTokens:'',contextWindow:'',status:'untested'});
it('every requested provider routes the exact selected model without requiring a fake connected flag',()=>{
 for(const type of Object.keys(names)){const p=provider(type as CloudProvider['type']);const route=resolveRoute(model(type),[p]);assert.equal(route.provider,p);assert.equal(route.modelId,type==='gemini'?'gemini-2.5-flash':model(type).providerModelId);}
});
it('missing credentials, unsupported routes, and paid OpenRouter fallback fail closed',()=>{
 assert.throws(()=>resolveRoute(model('groq'),[{...provider('groq'),configured:false}]),/Configure groq/);
 assert.throws(()=>resolveRoute({...model('openrouter'),providerModelId:'openrouter/auto'},[provider('openrouter')]),/free model/);
 assert.throws(()=>resolveRoute({...model('gemini'),tier:'paid_blocked'},[provider('gemini')]),/Paid/);
 assert.equal(providerForModel(undefined,[]),undefined);
});
it('payloads preserve conversation roles, selected model and voice JSON instruction',()=>{
 const contents=[{role:'user',parts:[{text:'Hello'}]},{role:'model',parts:[{text:'Hi'}]}];
 for(const type of ['groq','openrouter','cloudflare','ollama']){const body:any=providerPayload(type,'chosen','JSON text and speechText',contents);assert.equal(body.model,'chosen');assert.equal(body.messages[2].role,'assistant');assert.equal(body.stream,false);}
 const gemini:any=providerPayload('gemini','chosen','JSON',contents);assert.equal(gemini.contents,contents);assert.equal(gemini.systemInstruction.parts[0].text,'JSON');
});
it('visual consent stays scoped to Gemini and empty/error results never count as a reply',()=>{
 assert.throws(()=>providerPayload('groq','x','s',[{parts:[{inlineData:{}}]}]),/No image was sent/);
 assert.throws(()=>providerText('groq',{error:'failure'}),/no reply/);
 assert.equal(providerText('groq',{choices:[{message:{content:'ok'}}]}),'ok');
 assert.equal(providerText('ollama',{message:{content:'local'}}),'local');
 assert.equal(providerText('gemini',{candidates:[{content:{parts:[{text:'yes'}]}}]}),'yes');
});
it('detects 429 and rate limit exhaustion errors accurately',()=>{
 assert.equal(isRateLimitOrTemporaryError({status: 429}), true);
 assert.equal(isRateLimitOrTemporaryError(new Error('Rate limit exceeded')), true);
 assert.equal(isRateLimitOrTemporaryError(new Error('Resource has been exhausted (e.g. check quota)')), true);
 assert.equal(isRateLimitOrTemporaryError(new Error('Invalid API Key')), false);
 assert.equal(isRateLimitOrTemporaryError(null), false);
});
it('builds prioritized fallback chains across configured free providers and honors strategies',()=>{
 const pGemini = provider('gemini');
 const pOpenRouter = provider('openrouter');
 const mGemini = model('gemini');
 const mOpenRouter = model('openrouter');
 const chain = getFallbackChain(mGemini, [mGemini, mOpenRouter], [pGemini, pOpenRouter], { strategy: 'balanced', autoFallback: true });
 assert.equal(chain.length, 2);
 assert.equal(chain[0].provider.type, 'gemini');
 assert.equal(chain[1].provider.type, 'openrouter');
 const disabledChain = getFallbackChain(mGemini, [mGemini, mOpenRouter], [pGemini, pOpenRouter], { autoFallback: false });
 assert.equal(disabledChain.length, 1);
});



// Mode commands are handled before any provider call, including on a disconnected desktop.
import {detectModeCommand, setInferenceMode, requiresLocalInference, assertInferenceAllowed} from '../utils/hybridMode.ts';
it('voice mode switches are exact commands, not quoted project instructions', () => {
 assert.equal(detectModeCommand('AXION, switch to offline mode'), 'offline');
 assert.equal(detectModeCommand('Go local'), 'offline');
 assert.equal(detectModeCommand('Switch to online mode.'), 'online');
 assert.equal(detectModeCommand('Explain how to go local'), null);
 assert.equal(detectModeCommand('Go local and delete files'), null);
});
it('offline mode fails closed for every cloud adapter and reconnect does not override it', () => {
 try {
  setInferenceMode('offline');
  assert.equal(requiresLocalInference(true), true);
  for(const type of ['gemini','anthropic','openai','deepseek']) assert.throws(() => assertInferenceAllowed(type), /cloud inference is disabled/);
  assert.doesNotThrow(() => assertInferenceAllowed('ollama'));
  setInferenceMode('online');
  assert.equal(requiresLocalInference(false), true);
  assert.equal(requiresLocalInference(true), false);
  assert.doesNotThrow(() => assertInferenceAllowed('openai'));
 } finally { setInferenceMode('online'); }
});


import {hasProjectScope} from '../utils/workspaceScope.ts';
import {githubRepository,githubSources} from '../utils/githubProject.ts';
import {zipSync,strToU8} from 'fflate';
it('general chat cannot inherit files from a mounted project or a stale coding session',()=>{
 const session={isWorkspaceBound:true,workspaceId:'alpha'};
 assert.equal(hasProjectScope('workspace',session,'alpha'),false);
 assert.equal(hasProjectScope('code_studio',session,'beta'),false);
 assert.equal(hasProjectScope('code_studio',{isWorkspaceBound:false},'alpha'),false);
 assert.equal(hasProjectScope('code_studio',session,'alpha'),true);
 assert.equal(hasProjectScope('code_studio',undefined,undefined),false);
});
it('GitHub linking accepts exact repository identities and rejects credentials and foreign hosts',()=>{
 assert.equal(githubRepository('https://github.com/Armanlive/AXION-X100').url,'https://github.com/Armanlive/AXION-X100');
 assert.equal(githubRepository('owner/repository.git').repo,'repository');
 for(const value of ['https://evil.test/a/b','https://user:pass@github.com/a/b','a/../b','a/b/tree/main'])assert.throws(()=>githubRepository(value));
});
it('GitHub imports source files without credentials, dependency caches or path traversal',()=>{
 const files=githubSources(zipSync({'repo/src/main.ts':strToU8('export const ready=true;'),'repo/.env':strToU8('SECRET=fixture'),'repo/node_modules/a.ts':strToU8('cache')}));
 assert.deepEqual(Object.keys(files),['src/main.ts']);
 assert.throws(()=>githubSources(zipSync({'repo/../escape.ts':strToU8('no')})),/Unsafe/);
});

import {importGithubProject} from '../utils/githubProject.ts';
it('GitHub import pins raw files to the resolved commit and reports live progress',async()=>{
 const original=globalThis.fetch;const calls:string[]=[];const steps:string[]=[];
 const sha='a'.repeat(40);
 try{
  globalThis.fetch=async(input)=>{
   const url=String(input);calls.push(url);
   return url.startsWith('https://api.github.com/')?Response.json({sha,tree:[{type:'blob',mode:'100644',path:'src/main.ts',size:5},{type:'blob',mode:'100644',path:'.env',size:4}]}):new Response('hello');
  };
  const project=await importGithubProject('owner/repo',s=>steps.push(s));
  assert.equal(project.files['src/main.ts'],'hello');assert.equal(project.files['.env'],undefined);
  assert.equal(calls[1],`https://raw.githubusercontent.com/owner/repo/${sha}/src/main.ts`);
  assert.ok(steps.length>=2);
  globalThis.fetch=async()=>Response.json({sha,tree:[],truncated:true});
  await assert.rejects(()=>importGithubProject('owner/repo',()=>{}),/Incomplete/);
 }finally{globalThis.fetch=original;}
});

import {isLocalVisionModel} from '../utils/providerRouting.ts';
it('Ollama receives image pixels locally and text-only local models are excluded from vision routes',()=>{
 const local={...model('ollama'),providerModelId:'qwen2.5vl:7b'};
 assert.equal(isLocalVisionModel(local),true);
 assert.equal(isLocalVisionModel({...local,providerModelId:'qwen2.5-coder:7b'}),false);
 const payload:any=providerPayload('ollama','qwen2.5vl:7b','Describe the photo',[{role:'user',parts:[{text:'What is here?'},{inlineData:{mimeType:'image/jpeg',data:'fixture-image'}}]}]);
 assert.deepEqual(payload.messages[1].images,['fixture-image']);
 assert.throws(()=>providerPayload('ollama','qwen2.5vl:7b','s',[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:'fixture'}}]}]),/not PDFs/);
});
