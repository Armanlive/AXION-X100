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


