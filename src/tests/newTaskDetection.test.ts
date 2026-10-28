import {it} from 'node:test';
import assert from 'node:assert/strict';
import {detectNewTask,keywords} from '../utils/newTaskDetection.ts';

const thread=[
  {sender:'user',text:'Header component ka color cyan kar do aur font thoda bada'},
  {sender:'boss_agent',text:'Done Sir, updated Header.tsx with a cyan color and larger font.'}
];

it('never offers a split in an empty thread',()=>{
  assert.equal(detectNewTask('Build a login page with Supabase auth',[]).isNewTask,false);
  assert.equal(detectNewTask('Build a login page with Supabase auth',[{sender:'system',text:'Welcome'}]).isNewTask,false);
});

it('treats short replies and follow-up markers as the same task',()=>{
  assert.equal(detectNewTask('haan theek hai',thread).isNewTask,false);
  assert.equal(detectNewTask('also make the footer match this style please',thread).isNewTask,false);
  assert.equal(detectNewTask('isko thoda aur bold bana do header mein',thread).isNewTask,false);
});

it('keeps related work in the thread',()=>{
  const v=detectNewTask('Add a hover glow to the header component title',thread);
  assert.equal(v.isNewTask,false);
  assert.equal(v.reason,'related-topic');
});

it('flags an unrelated task',()=>{
  const v=detectNewTask('Create a Supabase migration for the payments ledger table',thread);
  assert.equal(v.isNewTask,true);
  assert.equal(v.reason,'unrelated-topic');
});

it('flags an explicit new task in English and Hinglish',()=>{
  assert.equal(detectNewTask('ok new task: dark mode toggle',thread).isNewTask,true);
  assert.equal(detectNewTask('ek naya kaam hai, voice settings page',thread).isNewTask,true);
  assert.equal(detectNewTask('ab ek alag task hai voice settings page ka',thread).isNewTask,true);
});

it('does not flag questions without a task verb',()=>{
  assert.equal(detectNewTask('What is the difference between Tauri and Electron runtimes',thread).isNewTask,false);
});

it('extracts content keywords without stop words',()=>{
  assert.deepEqual([...keywords('Please add the Header colors')].sort(),['add','color','header']);
});
