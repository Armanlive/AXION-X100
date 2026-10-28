import {it} from 'node:test';
import assert from 'node:assert/strict';
import {GestureEngine,gestureAction,type Landmark} from '../utils/gestureEngine.ts';
import {getTaskRoutedChain} from '../utils/providerRouting.ts';
import type {AIModel,CloudProvider} from '../types/index.ts';

/** Synthetic hand: wrist at (x,y), hand size `size`, thumb–index gap `gap` (in hand sizes). */
function hand(x:number,y:number,size=.2,gap=1):Landmark[]{
 const points:Landmark[]=Array.from({length:21},()=>({x,y:y-size/2}));
 points[0]={x,y};points[9]={x,y:y-size};
 points[4]={x:x-gap*size/2,y:y-size};points[8]={x:x+gap*size/2,y:y-size};
 return points;
}
const run=(engine:GestureEngine,frames:[Landmark[]|null,number][])=>frames.map(([h,t])=>engine.update(h,t)).filter(Boolean);

it('quick pinch-and-release is an air-tap; a long hold is not',()=>{
 assert.deepEqual(run(new GestureEngine(),[[hand(.5,.6),0],[hand(.5,.6,.2,.1),50],[hand(.5,.6,.2,.1),150],[hand(.5,.6),200]]),[{type:'tap'}]);
 assert.deepEqual(run(new GestureEngine(),[[hand(.5,.6,.2,.1),0],[hand(.5,.6,.2,.1),600],[hand(.5,.6),700]]),[]);
});
it('pinch-hold while pulling toward / pushing away from the camera zooms, and suppresses the tap',()=>{
 const e=new GestureEngine();
 assert.deepEqual(run(e,[[hand(.5,.6,.2,.1),0],[hand(.5,.6,.25,.1),60],[hand(.5,.6,.25,.1),100],[hand(.5,.6,.25),150]]),[{type:'zoom',direction:'in'}]);
 assert.deepEqual(run(new GestureEngine(),[[hand(.5,.6,.25,.1),0],[hand(.5,.6,.2,.1),60]]),[{type:'zoom',direction:'out'}]);
});
it('fast open-hand sweeps become swipes, mirrored to the user\'s point of view',()=>{
 const sweep=(dx:number,dy:number,mirrored=true)=>run(new GestureEngine({mirrored}),[0,1,2,3].map(i=>[hand(.5+dx*i/3,.6+dy*i/3),i*80] as [Landmark[],number]));
 assert.deepEqual(sweep(-.3,0),[{type:'swipe',direction:'right'}]);
 assert.deepEqual(sweep(-.3,0,false),[{type:'swipe',direction:'left'}]);
 assert.deepEqual(sweep(0,-.3),[{type:'swipe',direction:'up'}]);
 assert.deepEqual(sweep(.05,.05),[],'small drift is ignored');
});
it('slow drift, lost tracking and cooldown never fire gestures',()=>{
 const e=new GestureEngine();
 assert.deepEqual(run(e,[0,1,2,3,4,5,6,7,8,9,10].map(i=>[hand(.5-i*.03,.6),i*200] as [Landmark[],number])),[]);
 assert.deepEqual(run(new GestureEngine(),[[hand(.5,.6),0],[null,40],[hand(.2,.6),80]]),[]);
 const c=new GestureEngine();
 const frames:[Landmark[],number][]=[[hand(.8,.6),0],[hand(.7,.6),80],[hand(.6,.6),160],[hand(.5,.6),240],[hand(.4,.6),320],[hand(.3,.6),400],[hand(.2,.6),480]];
 assert.equal(run(c,frames).length,1,'one sweep is one swipe');
});
it('gestures map to file navigation, opening, panel and bounded zoom',()=>{
 const t={files:['a.ts','b.ts','c.ts'],cursor:0,zoom:1};
 assert.deepEqual(gestureAction({type:'swipe',direction:'right'},t),{kind:'focusFile',index:1});
 assert.deepEqual(gestureAction({type:'swipe',direction:'left'},t),{kind:'focusFile',index:2});
 assert.deepEqual(gestureAction({type:'tap'},t),{kind:'openFile',path:'a.ts'});
 assert.deepEqual(gestureAction({type:'swipe',direction:'up'},t),{kind:'filePanel',open:true});
 assert.deepEqual(gestureAction({type:'zoom',direction:'in'},t),{kind:'zoom',level:1.1});
 assert.equal(gestureAction({type:'zoom',direction:'in'},{...t,zoom:1.5}).kind,'none');
 assert.equal(gestureAction({type:'tap'},{files:[],cursor:0,zoom:1}).kind,'none');
});

const provider=(type:CloudProvider['type']):CloudProvider=>({id:type,name:type,type,description:'',icon:'',isConnected:false,isPrimary:false,status:'untested',tier:'free',models:[],configured:true});
const gemini:AIModel={id:'gemini',name:'Gemini',provider:'Google Gemini',providerModelId:'models/gemini-2.5-flash',tier:'free',costPer1kTokens:'',contextWindow:'',status:'untested'};
const router:AIModel={id:'or',name:'OpenRouter Free',provider:'OpenRouter',providerModelId:'openrouter/free',tier:'free',costPer1kTokens:'',contextWindow:'',status:'untested'};
it('frame analysis is heavy and only routes to providers that can carry images',()=>{
 const routed=getTaskRoutedChain('what is this?',router,[gemini,router],[provider('gemini'),provider('openrouter')],{vision:true});
 assert.equal(routed.tier,'heavy');assert.deepEqual(routed.chain.map(c=>c.provider.type),['gemini']);
 assert.equal(getTaskRoutedChain('what is this?',router,[router],[provider('openrouter')],{vision:true}).chain.length,0);
});
