import {chromium} from 'file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const requests=[];
await page.route('https://generativelanguage.googleapis.com/**',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({text:'Fixture answer',speechText:'Fixture answer'})}]}}]})+'\n\n'});});
await page.goto('http://127.0.0.1:3000');await page.evaluate(async()=>{
 const source=await(await fetch('/src/utils/aiOrchestrator.ts')).text();const url=source.match(/from ["']([^"']*store\/useProfileStore[^"']*)["']/)[1];const {useProfileStore}=await import(url);const {orchestrateAIRequest}=await import('/src/utils/aiOrchestrator.ts');
 const profile={version:1,role:'fixture-auto-engineer',projects:'fixture-sync',help:'debugging',style:'concise',shareWithAI:false};
 const context={workspaceName:'None',workspacePath:'',files:{},activeAgent:{},availableAgents:[],isBossLocked:true,geminiApiKey:'fixture-key'};
 const callbacks={onChunk:()=>{},onComplete:()=>{},onError:e=>{throw Error(e)}};
 useProfileStore.setState({profile});await orchestrateAIRequest('Explain types',[],context,callbacks);
 useProfileStore.setState({profile:{...profile,shareWithAI:true}});await orchestrateAIRequest('Explain types',[],context,callbacks);
});
assert.equal(requests.length,2);assert.ok(!JSON.stringify(requests[0]).includes('fixture-auto-engineer'));assert.ok(JSON.stringify(requests[1]).includes('fixture-auto-engineer'));console.log('Intercepted AI context passed: local-only profile excluded, consented profile included.');await browser.close();
