import {chromium} from 'file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);
await page.addInitScript(()=>{
 window.__spoken=[];window.__recognitions=[];
 window.SpeechRecognition=class{constructor(){window.__recognitions.push(this);}start(){queueMicrotask(()=>this.onstart?.());}abort(){queueMicrotask(()=>this.onend?.());}stop(){this.abort();}emit(text){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});}};
 class Synth extends EventTarget{getVoices(){return[{name:'Fixture English',lang:'en-IN',localService:true},{name:'Fixture Hindi',lang:'hi-IN',localService:true}];}cancel(){}speak(u){window.__spoken.push(u.text);queueMicrotask(()=>u.onstart?.());setTimeout(()=>u.onend?.(),50);}}
 Object.defineProperty(window,'speechSynthesis',{value:new Synth(),configurable:true});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>({getTracks:()=>[{stop(){}}]}),configurable:true});
 window.AudioContext=class{async resume(){}async close(){}createAnalyser(){return {fftSize:2048,getFloatTimeDomainData:a=>a.fill(0)}}createMediaStreamSource(){return {connect(){},disconnect(){}}}};
});
await page.goto('http://127.0.0.1:3000');await page.getByRole('button',{name:'Use voice',exact:true}).click();await page.getByRole('combobox',{name:'Talk mode'}).selectOption('wake-word');
const enable=page.getByRole('button',{name:'Enable microphone',exact:true});if(await enable.count())await enable.click();
await page.waitForTimeout(500);await page.evaluate(()=>window.__recognitions.at(-1).emit('Hello AXION'));await page.waitForTimeout(500);
assert.equal(await page.evaluate(()=>window.__spoken.length),1);
await page.evaluate(()=>window.__recognitions.at(-1).emit('Automobile engineering'));await page.getByText('Thanks. What are you building or working on right now?',{exact:true}).waitFor();await page.waitForTimeout(300);
assert.equal(await page.evaluate(()=>window.__spoken.length),2);assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('Automobile engineering'));
console.log('Synthetic voice integration passed: wake asks first question, next spoken answer advances interview, one playback per question, no plaintext persistence.');await browser.close();
