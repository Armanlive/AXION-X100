import { chromium } from 'file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1031},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:3000');await page.waitForTimeout(1400);
await page.screenshot({path:'artifacts/terminal-core/desktop-1920.png',fullPage:true});
const sizes=[];
for(const [width,height] of [[1440,900],[1280,720]]) {
 await page.setViewportSize({width,height});await page.waitForTimeout(300);
 const core=await page.locator('.axion-living-core').boundingBox();
 const title=await page.getByRole('heading',{name:'Local intelligence. Your workspace.'}).boundingBox();
 assert(core.y>=44);assert(title.y>core.y+core.height-1);
 sizes.push({width,height,core});
 await page.screenshot({path:`artifacts/terminal-core/desktop-${width}.png`,fullPage:true});
}
// Actual mobile UI, deliberately muted: no microphone permission or fabricated input.
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'Voice Tab',exact:true}).click();
await page.getByText('AXION VOICE',{exact:true}).waitFor();
const mute=page.getByRole('button',{name:'Mute microphone',exact:true});
if(await mute.count()) await mute.click();
await page.waitForTimeout(500);
await page.screenshot({path:'artifacts/terminal-core/mobile-390.png',fullPage:true});
for(const [width,height] of [[360,800],[404,756],[430,932]]) {
 await page.setViewportSize({width,height});await page.waitForTimeout(200);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const core=await page.locator('.axion-living-core').boundingBox();assert(core.x>=0&&core.x+core.width<=width);
 const end=await page.getByRole('button',{name:'End voice and return to chat',exact:true}).boundingBox();assert(end&&end.y+end.height<=height-56);
 sizes.push({width,height,core});
 await page.screenshot({path:`artifacts/terminal-core/mobile-${width}.png`,fullPage:true});
}
// Isolated render fixture, never installed as an application route or state timer.
await page.setViewportSize({width:1600,height:550});
await page.evaluate(async()=>{
 const React=(await import('/node_modules/.vite/deps/react.js')).default;
 const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
 const {AxionLivingCore}=await import('/src/components/voice/AxionLivingCore.tsx');
 const fixture=document.createElement('div');document.body.replaceChildren(fixture);
 fixture.style.cssText='background:#030810;color:#cce9ef;min-height:100vh;padding:24px;font-family:system-ui';
 const root=createRoot(fixture);
 const h=React.createElement;
 root.render(h('div',null,h('p',null,'COMPONENT VISUAL FIXTURE · explicit states · no live microphone / TTS playback'),h('div',{style:{display:'flex',justifyContent:'space-around'}},...['idle','listening','thinking','speaking'].map(state=>h('div',{key:state,style:{textAlign:'center'}},h(AxionLivingCore,{state,size:'hero',audioLevel:0}),h('p',null,state.toUpperCase()))))));
});
await page.waitForTimeout(700);
const ids=await page.locator('svg defs [id]').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(ids.length,new Set(ids).size);
await page.screenshot({path:'artifacts/terminal-core/states-fixture.png',fullPage:true});
await page.emulateMedia({reducedMotion:'reduce'});
assert(await page.locator('.axion-living-core *').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).animationName==='none')));
await page.screenshot({path:'artifacts/terminal-core/states-reduced-motion.png',fullPage:true});
assert.deepEqual(errors,[]);
await writeFile('artifacts/terminal-core/browser-checks.json',JSON.stringify({errors,sizes,checks:['Unique SVG definition IDs across four simultaneous instances','Reduced motion disables all Core CSS animations','Mobile Core stays within viewport','Desktop hero stays below header and above title'],note:'State montage is a component fixture, not proof of microphone or TTS runtime.'},null,2));
console.log('Browser checks passed; desktop, mobile, four-state and reduced-motion screenshots saved.');
await browser.close();

