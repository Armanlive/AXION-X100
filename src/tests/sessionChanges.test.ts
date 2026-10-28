import {it} from 'node:test';
import assert from 'node:assert/strict';
import {countLineChanges,toSessionChange,upsertSessionChange,countChangedFiles,sortChanges} from '../utils/sessionChanges.ts';

const diff=(id:string,filePath='src/a.ts')=>({id,taskId:'#AX-1',filePath,oldContent:'a\nb\nc',newContent:'a\nB\nc\nd',summary:'edit'});

it('counts added and removed lines',()=>{
  assert.deepEqual(countLineChanges('a\nb\nc','a\nB\nc\nd'),{added:2,removed:1});
  assert.deepEqual(countLineChanges('same','same'),{added:0,removed:0});
  assert.deepEqual(countLineChanges('','x\ny'),{added:2,removed:0});
});

it('stores metadata only, never file contents',()=>{
  const c=toSessionChange(diff('d1'),'proposed',new Date('2026-10-21T10:00:00Z'));
  assert.deepEqual(Object.keys(c).sort(),['added','diffId','filePath','removed','status','summary','taskId','timestamp']);
  assert.equal(c.timestamp,'2026-10-21T10:00:00.000Z');
});

it('records a change on the active session only',()=>{
  const sessions:{id:string;changes?:any[]}[]=[{id:'s1'},{id:'s2'}];
  const out=upsertSessionChange(sessions,'s2',toSessionChange(diff('d1'),'proposed'));
  assert.equal(out[0].changes,undefined);
  assert.equal(out[1].changes?.length,1);
});

it('updates the owning session when a diff is approved from another thread',()=>{
  let sessions:any[]=[{id:'s1'},{id:'s2'}];
  sessions=upsertSessionChange(sessions,'s1',toSessionChange(diff('d1'),'proposed'));
  sessions=upsertSessionChange(sessions,'s2',toSessionChange(diff('d1'),'applied'));
  assert.equal(sessions[0].changes.length,1);
  assert.equal(sessions[0].changes[0].status,'applied');
  assert.equal(sessions[1].changes,undefined);
});

it('ignores unknown sessions and counts distinct files',()=>{
  const sessions=[{id:'s1'}];
  assert.equal(upsertSessionChange(sessions,'missing',toSessionChange(diff('d1'),'applied')),sessions);
  const changes=[toSessionChange(diff('d1'),'applied'),toSessionChange(diff('d2'),'rejected'),toSessionChange(diff('d3','src/b.ts'),'proposed')];
  assert.equal(countChangedFiles(changes),2);
  assert.equal(countChangedFiles(undefined),0);
});

it('sorts newest first',()=>{
  const a=toSessionChange(diff('d1'),'applied',new Date('2026-01-01'));
  const b=toSessionChange(diff('d2'),'applied',new Date('2026-02-01'));
  assert.deepEqual(sortChanges([a,b]).map(c=>c.diffId),['d2','d1']);
});
