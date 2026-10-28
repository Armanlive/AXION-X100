import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {GhostMonitor,isErrorOutput,redactLog,safeContextPath,parseGhostProposal,MUTATION_BLOCK} from '../utils/ghostMonitor.ts';
describe('Ghost Operator observation and proposal boundary',()=>{
 it('detects TypeScript, Cargo, Python and runtime failures',()=>{
  for(const text of ['src/app.ts(3,2): error TS2322: mismatch','error[E0308]: mismatched types','Traceback (most recent call last):','TypeError: undefined','thread main panicked at line 2','Build failed'])assert.equal(isErrorOutput(text),true,text);
  for(const text of ['Build successful','0 errors','Test passed'])assert.equal(isErrorOutput(text),false,text);
 });
 it('assembles fragmented output including ANSI and traceback continuation',()=>{
  const logs:string[]=[];const m=new GhostMonitor(s=>logs.push(s));
  m.feed('\x1b[31mer');m.feed('ror TS2322: mismatch\x1b[0m\n');m.feed(' at src/app.ts:2');m.flush();m.reset();
  assert.equal(logs.length,1);assert.match(logs[0],/src\/app.ts/);assert.ok(!logs[0].includes('\x1b'));
 });
 it('deduplicates identical incidents and cancels pending work on reset',async()=>{
  const logs:string[]=[];const m=new GhostMonitor(s=>logs.push(s));m.feed('Error: broken');m.flush();m.feed('Error: broken');m.flush();assert.equal(logs.length,1);
  m.feed('Error: another');m.reset();await new Promise(r=>setTimeout(r,650));assert.equal(logs.length,1);
 });
 it('keeps log buffers bounded and filters known secrets',()=>{
  const logs:string[]=[];const m=new GhostMonitor(s=>logs.push(s));m.feed('a'.repeat(50000)+'\nError: token=private-value');m.flush();m.reset();assert.ok(logs[0].length<=16000);assert.ok(!logs[0].includes('private-value'));
  assert.ok(!redactLog('authorization=secret Bearer abcdef gsk_abcdefghijklmnop').includes('abcdefghijklmnop'));
 });
 it('rejects traversal, absolute, sensitive and dependency paths',()=>{
  for(const path of ['../app.ts','C:/app.ts','/app.ts','.env','src/credentials.ts','node_modules/a.ts','src/../a.ts'])assert.equal(safeContextPath(path),false,path);
  assert.equal(safeContextPath('src/app.tsx'),true);
 });
 it('rejects invented targets, mismatched originals and duplicate targets',()=>{
  const files={'src/app.ts':'const x=1;'};const patch={path:'src/app.ts',original:files['src/app.ts'],proposed:'const x=2;'};
  const encode=(patches:unknown[])=>JSON.stringify({summary:'Proposed fix',patches,validation:'npm test'});
  assert.equal(parseGhostProposal(encode([patch]),files).patches.length,1);
  assert.throws(()=>parseGhostProposal(encode([{...patch,original:'stale'}]),files));
  assert.throws(()=>parseGhostProposal(encode([{...patch,path:'src/other.ts'}]),files));
  assert.throws(()=>parseGhostProposal(encode([patch,patch]),files));
 });
 it('reports unavailable recovery and verification without creating authority',()=>{
  assert.match(MUTATION_BLOCK,/No snapshot created/);assert.match(MUTATION_BLOCK,/validation not run/);
 });
});
