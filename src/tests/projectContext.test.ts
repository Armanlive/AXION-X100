import {it} from 'node:test';
import assert from 'node:assert/strict';
import {selectRelevantFiles,buildSourceExcerpts,formatSourceExcerpts} from '../utils/projectContext.ts';

const paths=['README.md','package.json','src/main.tsx','src/App.tsx','src/components/Header.tsx','src/utils/voiceEngine.ts','.env','node_modules/x/README.md','package-lock.json','assets/logo.png'];

it('reads overview files when asked to read the project',()=>{
  const picked=selectRelevantFiles('bhai mere ye project ko read karo',[],paths);
  assert.deepEqual(picked.slice(0,2),['README.md','package.json']);
  assert.ok(picked.includes('src/main.tsx')&&picked.includes('src/App.tsx'));
  assert.ok(!picked.includes('.env'));
  assert.ok(!picked.includes('node_modules/x/README.md'));
  assert.ok(!picked.includes('package-lock.json'));
});

it('puts a file named in the prompt first',()=>{
  assert.equal(selectRelevantFiles('Header.tsx ka color fix karo',[],paths)[0],'src/components/Header.tsx');
  assert.equal(selectRelevantFiles('voiceEngine mein bug hai',[],paths)[0],'src/utils/voiceEngine.ts');
});

it('follows a file mentioned in recent turns',()=>{
  assert.deepEqual(selectRelevantFiles('ab isko thoda chhota karo',['header file kholo'],paths),['src/components/Header.tsx']);
});

it('selects nothing for small talk',()=>{
  assert.deepEqual(selectRelevantFiles('kaise ho bhai',[],paths),[]);
});

it('keeps excerpts within budget and marks truncation',()=>{
  const files={'a.ts':'x'.repeat(3000),'b.ts':'y'.repeat(3000)};
  const ex=buildSourceExcerpts(['a.ts','b.ts','missing.ts'],files,4000,2500);
  assert.equal(ex.length,2);
  assert.equal(ex[0].content.length,2500);
  assert.equal(ex[0].truncated,true);
  assert.equal(ex[1].content.length,1500);
  assert.match(formatSourceExcerpts(ex),/--- FILE: a\.ts \(truncated\) ---/);
});
// Regression: short follow-ups retain the analysis target, including Hindi requests.
it('keeps overview files for analysis and its short follow-up', () => {
  const paths = ['README.md', 'package.json', 'src/main.ts', '.env'];
  for (const prompt of ['analyse this', 'इस प्रोजेक्ट को समझाओ', 'Sana voice assistant']) {
    const selected = selectRelevantFiles(prompt, ['analyze this project'], paths);
    assert.ok(selected.includes('README.md'));
    assert.ok(!selected.includes('.env'));
  }
});

import {workspaceIdFor, escapeHtml} from '../utils/workspaceService.ts';
it('escapes file content before it reaches an HTML sink', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">&\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
});
it('gives same-named folders in different places different project ids', () => {
  const personal = workspaceIdFor('AXION', 'D:\\Personal\\AXION'), office = workspaceIdFor('AXION', 'D:\\Office\\AXION');
  assert.notEqual(personal, office);
  assert.match(personal, /^axion-[0-9a-f]{8}$/);
  assert.equal(workspaceIdFor('AXION', 'd:/personal/axion/'), personal, 'Windows path spelling and case do not change identity');
  assert.notEqual(workspaceIdFor('app', '/home/a/app'), workspaceIdFor('app', '/home/A/app'), 'POSIX paths stay case-sensitive');
});
