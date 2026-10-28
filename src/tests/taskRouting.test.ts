import {it} from 'node:test';
import assert from 'node:assert/strict';
import {classifyTaskTier,getTaskRoutedChain} from '../utils/providerRouting.ts';
import {guardRawContext} from '../core/context/eccManager.ts';
import {detectAppIntent,parseClarificationAnswer,ClarificationSession,clarificationQuestion,LAUNCHABLE_APPS,detectFolderCommand,folderConfirmation} from '../services/commandService.ts';
import type {AIModel,CloudProvider} from '../types/index.ts';
const provider=(type:CloudProvider['type']):CloudProvider=>({id:type,name:type,type,description:'',icon:'',isConnected:false,isPrimary:false,status:'untested',tier:'free',models:[],configured:true});
const gemini:AIModel={id:'gemini',name:'Gemini',provider:'Google Gemini',providerModelId:'models/gemini-2.5-flash',tier:'free',costPer1kTokens:'',contextWindow:'',status:'untested',codingScore:95};
const router:AIModel={id:'or',name:'OpenRouter Free',provider:'OpenRouter',providerModelId:'openrouter/free',tier:'free',costPer1kTokens:'',contextWindow:'',status:'untested',codingScore:80};
const paid:AIModel={...gemini,id:'claude',name:'Claude',provider:'Anthropic',tier:'paid_blocked'};
const providers=[provider('gemini'),provider('openrouter'),provider('anthropic')];

it('classifies architecture and debugging as heavy, UI edits and scaffolding as light',()=>{
 for(const p of ['Debug this race condition in the voice engine','Refactor the provider architecture','why does the build fail with this stack trace'])assert.equal(classifyTaskTier(p),'heavy');
 for(const p of ['make the header padding smaller','scaffold a StatsCard component','hey, how are you?'])assert.equal(classifyTaskTier(p),'light');
});
it('heavy work keeps the primary brain first; light work prefers the free gateway',()=>{
 const models=[gemini,router,paid];
 assert.equal(getTaskRoutedChain('debug this crash',gemini,models,providers).chain[0].model.id,'gemini');
 const light=getTaskRoutedChain('change the button color',gemini,models,providers);
 assert.equal(light.tier,'light');assert.equal(light.chain[0].provider.type,'openrouter');assert.ok(light.chain.some(c=>c.model.id==='gemini'));
 assert.ok(!light.chain.some(c=>c.model.tier!=='free'),'never routes to paid models');
 assert.equal(getTaskRoutedChain('change the button color',gemini,models,providers,{autoFallback:false}).chain[0].model.id,'gemini','respects disabled fallback');
});
it('ECC guard folds raw code bodies out of oversized context',()=>{
 const big='Look:\n```ts\n'+'const x=1;\n'.repeat(800)+'```\nthanks';
 const guarded=guardRawContext(big);assert.ok(guarded.length<=4100);assert.match(guarded,/omitted by ECC guard/);assert.doesNotMatch(guarded,/const x=1/);
 assert.equal(guardRawContext('short'),'short');
});
it('asks before opening apps that exist on both web and desktop',()=>{
 assert.deepEqual(detectAppIntent('Open WhatsApp')?.target,null);
 assert.equal(detectAppIntent('whatsapp kholo')?.app.id,'whatsapp');
 assert.equal(detectAppIntent('open whatsapp web')?.target,'web');
 assert.equal(detectAppIntent('launch the spotify desktop app')?.target,'desktop');
 assert.equal(detectAppIntent('open Microsoft Teams')?.app.id,'teams');
 for(const chat of ['how do I open WhatsApp chats from code?','open the WhatsApp integration file','what is slack'])assert.equal(detectAppIntent(chat),null);
 assert.match(clarificationQuestion(LAUNCHABLE_APPS.find(a=>a.id==='whatsapp')!).text,/^Should I open WhatsApp Web in the browser, or launch the desktop app\?$/);
});
it('only a timely answer resolves the pending question',()=>{
 assert.equal(parseClarificationAnswer('browser'),'web');assert.equal(parseClarificationAnswer('desktop app wala'),'desktop');assert.equal(parseClarificationAnswer('rehne do'),'cancel');
 assert.equal(parseClarificationAnswer('explain the ECC manager to me in detail please'),null);
 let now=0;const session=new ClarificationSession(1000,()=>now);
 session.ask(LAUNCHABLE_APPS[0]);assert.deepEqual(session.resolve('in the browser'),{app:LAUNCHABLE_APPS[0],target:'web'});
 assert.equal(session.resolve('browser'),null,'answer is consumed once');
 session.ask(LAUNCHABLE_APPS[0]);now=5000;assert.equal(session.resolve('browser'),null,'stale question expires');
});

it('opens known folders by name only, from Hinglish, Hindi and English',()=>{
  assert.equal(detectFolderCommand('Downloads folder kholo'),'downloads');
  assert.equal(detectFolderCommand('bhai desktop pe documents folder open karo'),'documents');
  assert.equal(detectFolderCommand('desktop kholo'),'desktop');
  assert.equal(detectFolderCommand('डाउनलोड फोल्डर खोलो'),'downloads');
  assert.equal(detectFolderCommand('open my pictures folder'),'pictures');
  assert.equal(detectFolderCommand('project ka folder kholo'),'project');
  assert.equal(detectFolderCommand('file explorer kholo'),'home');
  assert.equal(detectFolderCommand('project kholo'),null,'project view, not the folder');
  assert.equal(detectFolderCommand('WhatsApp desktop pe kholo'),null);
  assert.equal(detectFolderCommand('how do I open the downloads folder in code?'),null);
  assert.equal(detectFolderCommand('downloads aur documents kholo'),null);
  assert.equal(folderConfirmation('downloads').text,'Opening your Downloads folder.');
});
