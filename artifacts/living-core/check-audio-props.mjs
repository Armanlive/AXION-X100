import { chromium } from 'file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();await page.goto('http://127.0.0.1:3000');
const result=await page.evaluate(async()=>{
 const React=(await import('/node_modules/.vite/deps/react.js')).default;
 const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const {AxionLivingCore}=await import('/src/components/voice/AxionLivingCore.tsx');
 const div=document.createElement('div');document.body.append(div);const root=createRoot(div);
 const cases=[{state:'idle',audioLevel:1},{state:'speaking',audioLevel:1},{state:'thinking',audioLevel:1},{state:'listening',audioLevel:1},{state:'listening',audioLevel:1,isMuted:true},{state:'listening',audioLevel:NaN},{state:'listening',audioLevel:4},{state:'listening',audioLevel:-1}];
 root.render(React.createElement('div',null,...cases.map((props,key)=>React.createElement(AxionLivingCore,{...props,key,size:'sm'}))));
 await new Promise(r=>setTimeout(r,200));
 return [...div.querySelectorAll('.ax-input-response')].map(n=>n.style.transform);
});
assert.deepEqual(result,['scale(1)','scale(1)','scale(1)','scale(1.035)','scale(1)','scale(1)','scale(1.035)','scale(1)']);
console.log('PASS: microphone props only influence unmuted listening; stale TTS/idle/thinking, NaN, negative and excess levels handled. Synthetic props only, no claim of live audio validation.');
await browser.close();
