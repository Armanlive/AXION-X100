import {it} from 'node:test';
import assert from 'node:assert/strict';
import {buildModelPool,getFallbackChain,resolveRoute} from '../utils/providerRouting.ts';
import type {AIModel,CloudProvider} from '../types/index.ts';

const provider=(type:CloudProvider['type'],tier:CloudProvider['tier'],models:string[],configured=true):CloudProvider=>({id:`provider-${type}`,name:type,type,description:'',icon:'',isConnected:configured,isPrimary:false,status:configured?'connected':'not_configured',tier,models,configured});
const gemini:AIModel={id:'gemini-2.5-flash',name:'Gemini',provider:'Google Gemini',providerModelId:'models/gemini-2.5-flash',tier:'free',costPer1kTokens:'',contextWindow:'',status:'untested'};
const gpt:AIModel={id:'gpt-4o',name:'GPT-4o',provider:'OpenAI',tier:'paid_blocked',costPer1kTokens:'',contextWindow:'',status:'untested'};
const providers=[
 provider('gemini','free',['gemini-2.5-flash']),
 provider('groq','free',['llama-3.3-70b-versatile']),
 provider('deepseek','paid',['deepseek-chat']),
 provider('openai','paid',['gpt-4o']),
 provider('mistral','paid',['mistral-small-latest'],false),
];

it('every connected free key feeds the pool without duplicating known models',()=>{
 const pool=buildModelPool([gemini,gpt],providers);
 assert.ok(pool.some(m=>m.id==='groq:llama-3.3-70b-versatile'&&m.tier==='free'));
 assert.equal(pool.filter(m=>(m.providerModelId||m.id).includes('gemini-2.5-flash')).length,1);
 assert.ok(!pool.some(m=>m.id.startsWith('mistral:')),'unconfigured keys stay out');
});
it('paid keys join automatic routing only after approval',()=>{
 const without=buildModelPool([gemini,gpt],providers);
 assert.ok(!without.some(m=>m.id==='deepseek:deepseek-chat'));
 assert.equal(without.find(m=>m.id==='gpt-4o')?.tier,'paid_blocked');
 assert.ok(!getFallbackChain(gemini,without,providers).some(c=>c.provider.type==='openai'||c.provider.type==='deepseek'));
 const approved=buildModelPool([gemini,gpt],providers,new Set(['deepseek','openai']));
 assert.equal(approved.find(m=>m.id==='gpt-4o')?.tier,'paid_allowed');
 const chain=getFallbackChain(gemini,approved,providers).map(c=>`${c.provider.type}:${c.modelId}`);
 assert.ok(chain.includes('deepseek:deepseek-chat')&&chain.includes('openai:gpt-4o')&&chain.includes('groq:llama-3.3-70b-versatile'));
 assert.equal(chain[0],'gemini:gemini-2.5-flash','selected model stays first');
});
it('a pool model can be selected directly and an approved paid model resolves',()=>{
 const pool=buildModelPool([gemini,gpt],providers,new Set(['deepseek']));
 const deepseek=pool.find(m=>m.id==='deepseek:deepseek-chat')!;
 assert.equal(resolveRoute(deepseek,providers).modelId,'deepseek-chat');
 assert.throws(()=>resolveRoute(gpt,providers),/Paid/);
 assert.equal(resolveRoute({...gpt,tier:'paid_allowed'},providers).provider.type,'openai');
});
