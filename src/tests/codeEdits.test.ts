import {it} from 'node:test';
import assert from 'node:assert/strict';
import {writeWorkspaceFileDirect} from '../utils/workspaceService.ts';

it('never reports a save when no writable workspace exists or permission is denied', async () => {
  const ws:any = {absolutePath:'E:/project'};
  assert.equal((await writeWorkspaceFileDirect(ws,'main.ts','new')).success,false);
  ws.dirHandle={getFileHandle:async()=>{throw new Error('Permission denied');}};
  const denied=await writeWorkspaceFileDirect(ws,'main.ts','new');
  assert.equal(denied.success,false);
  assert.match(denied.error!,/Permission denied/);
});

it('only reports saved content after matching read-back', async () => {
  let disk='';
  const handle={createWritable:async()=>({write:async(text:string)=>{disk=text;},close:async()=>{}}),getFile:async()=>({text:async()=>disk})};
  const ws:any={absolutePath:'E:/project',dirHandle:{getFileHandle:async()=>handle}};
  assert.equal((await writeWorkspaceFileDirect(ws,'main.ts','updated')).success,true);
  assert.equal((await writeWorkspaceFileDirect(ws,'main.ts','overwrite','stale')).success,false);
  assert.equal(disk,'updated');
  handle.getFile=async()=>({text:async()=>'unexpected'});
  assert.equal((await writeWorkspaceFileDirect(ws,'main.ts','updated')).success,false);
});
import {parseCodeEdits, buildEditDiffs, replaceOnce, isSafeRelativePath} from '../utils/codeEdits.ts';

const files = {
  'src/App.tsx': 'export function App() {\n  return <h1>Hello</h1>;\n}\n',
  'src/win.ts': 'const a = 1;   \r\nconst b = 2;\r\n',
};

it('reads edits from the model reply and drops unsafe ones', () => {
  const raw = JSON.stringify({text: 'Done', speechText: 'Done', edits: [
    {path: 'src/App.tsx', find: '<h1>Hello</h1>', replace: '<h1>Hi</h1>'},
    {path: 'src/new.ts', content: 'export const x = 1;\n'},
    {path: '../outside.ts', content: 'x'},
    {path: 'C:/Windows/evil.ts', content: 'x'},
    {path: '.env', content: 'KEY=1'},
    {path: 'config/.env.local', content: 'KEY=1'},
    {path: 'node_modules/a/index.js', content: 'x'},
    {path: 'src/App.tsx', find: '', replace: 'x'},
  ]});
  const edits = parseCodeEdits(raw);
  assert.deepEqual(edits.map((e) => e.path), ['src/App.tsx', 'src/new.ts']);
  assert.deepEqual(parseCodeEdits('{"text":"no edits"}'), []);
  assert.deepEqual(parseCodeEdits('not json'), []);
  assert.equal(isSafeRelativePath('src\\utils\\x.ts'), true);
});

it('builds one diff per file for approval, applying several edits in order', () => {
  const {diffs, problems} = buildEditDiffs([
    {path: 'src/App.tsx', find: '<h1>Hello</h1>', replace: '<h1>Hi</h1>'},
    {path: 'src/App.tsx', find: 'export function App()', replace: 'export default function App()'},
    {path: 'src/new.ts', content: 'export const x = 1;\n'},
  ], files, 'Greeting tweak', '#AX-1', 1000);
  assert.deepEqual(problems, []);
  assert.equal(diffs.length, 2);
  assert.equal(diffs[0].newContent, 'export default function App() {\n  return <h1>Hi</h1>;\n}\n');
  assert.equal(diffs[0].oldContent, files['src/App.tsx']);
  assert.equal(diffs[0].status, 'pending_approval');
  assert.match(diffs[0].summary, /^Update src\/App.tsx/);
  assert.equal(diffs[1].oldContent, '');
  assert.match(diffs[1].summary, /^Create src\/new.ts/);
});

it('reports edits that cannot be applied instead of guessing', () => {
  const {diffs, problems} = buildEditDiffs([
    {path: 'src/App.tsx', find: 'not in the file', replace: 'x'},
    {path: 'src/missing.ts', find: 'a', replace: 'b'},
  ], files, 's', '#AX-2');
  assert.equal(diffs.length, 0);
  assert.match(problems[0], /not found/);
  assert.match(problems[1], /not in the connected project/);
  const twice = replaceOnce('x = 1; x = 1;', 'x = 1;', 'y');
  assert.equal(twice.ok, false);
});

it('tolerates line-ending and trailing-space differences and keeps CRLF files CRLF', () => {
  const r = replaceOnce(files['src/win.ts'], 'const a = 1;\nconst b = 2;', 'const a = 10;\nconst b = 20;');
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.text, 'const a = 10;\r\nconst b = 20;\r\n');
  const literal = replaceOnce('price = 1', 'price = 1', 'cost = $1 and $&');
  assert.ok(literal.ok && literal.text === 'cost = $1 and $&', 'replacement text is literal');
});
