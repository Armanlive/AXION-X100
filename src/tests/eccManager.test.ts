import {it} from 'node:test';
import assert from 'node:assert/strict';
import {ECCManager,compactMap,fileSignatures,calculateTokenBudget,type ECCSnapshot} from '../core/context/eccManager.ts';
it('compact context excludes dependencies, build outputs, lockfiles and secrets',()=>{
 const map=compactMap({'src/app.ts':'export const answer = "private literal";\nexport function run() { return "body"; }','node_modules/x.ts':'export const bad=1','Cargo.lock':'private','.env.local':'TOKEN=secret','dist/a.js':'export const nope=1'});
 assert.match(map,/const answer/);assert.match(map,/function run/);for(const banned of ['private literal','body','node_modules','Cargo.lock','.env','dist/'])assert.ok(!map.includes(banned));
});
it('declaration extraction does not copy literals or implementations',()=>{assert.deepEqual(fileSignatures('export function greet(secret="password") { return secret; }\nconst hidden=12;\nexport { greet as hello };'),['function greet','export greet as hello']);});
it('budget savings are computed from actual compared strings, including no-savings cases',()=>{const a=calculateTokenBudget('hello',{'app.ts':'export function work(){'+ 'return 1;'.repeat(100)+'}'});assert.ok(a.savedPercent>80);assert.ok(a.promptTokens>0);assert.equal(calculateTokenBudget('',{}).savedPercent,0);});
it('cache invalidates same HEAD for dirty edits, additions and workspace switches',async()=>{
 let snapshot:ECCSnapshot={root:'/one',head:'abc',diffStat:'',files:[['src/a.ts','export const one=1;']],truncated:false};
 const ecc=new ECCManager(async()=>structuredClone(snapshot));assert.equal(await ecc.initialize('/one'),'abc');
 const first=await ecc.getCompactGitMap('/one');assert.equal(first.cacheHit,false);assert.equal((await ecc.getCompactGitMap('/one')).cacheHit,true);
 snapshot.files=[['src/a.ts','export const two=2;']];assert.match((await ecc.getCompactGitMap('/one')).map,/two/);
 snapshot.files.push(['src/new.ts','export class New {}']);assert.match((await ecc.getCompactGitMap('/one')).map,/class New/);
 snapshot={...snapshot,root:'/two',head:null};assert.equal((await ecc.getCompactGitMap('/two')).cacheHit,false);assert.equal(await ecc.getGitDiffStat(),'');
});
