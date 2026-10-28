import {chromium} from 'file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();let request;
await page.route('https://generativelanguage.googleapis.com/**',async route=>{request=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Fixture analysis only',patches:[{path:'src/example.ts',original:'const count: number = "1";',proposed:'const count: number = 1;'}],validation:'npm test'})}]}}]})});});
await page.goto('http://127.0.0.1:3000');
const result=await page.evaluate(async()=>{
 const source=await (await fetch('/src/utils/ghostAnalysis.ts')).text();const storeUrl=source.match(/from ["']([^"']*store\/useAxionStore[^"']*)["']/)[1];const nativeUrl=source.match(/from ["']([^"']*services\/nativeWorkspace[^"']*)["']/)[1];const {useAxionStore}=await import(storeUrl);const {NativeWorkspaceService}=await import(nativeUrl);const {analyzeGhostError}=await import('/src/utils/ghostAnalysis.ts');
 useAxionStore.setState({activeWorkspace:{id:'fixture',absolutePath:'E:/fixture'},filesIndex:[{relativePath:'src/example.ts'}],cloudProviders:[{type:'gemini',isPrimary:true,apiKey:'fixture-key'}]});
 NativeWorkspaceService.readTextFile=async()=> 'const count: number = "1";';
 const proposal=await analyzeGhostError('error TS2322 at src/example.ts','E:/fixture');
 let rejected=false;try{await analyzeGhostError('error: wrong workspace','E:/other');}catch{rejected=true;}
 return {proposal,rejected};
});
assert.equal(result.proposal.patches[0].proposed,'const count: number = 1;');assert.equal(result.rejected,true);assert.ok(JSON.stringify(request).includes('src/example.ts'));console.log('Intercepted provider + synthetic native reader: source context, validated proposal and workspace mismatch checks passed.');await browser.close();
