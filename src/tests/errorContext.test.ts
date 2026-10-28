import {it} from 'node:test';
import assert from 'node:assert/strict';
import {isErrorReport,extractErrorLocations,resolveWorkspacePath,buildErrorExcerpt,formatErrorContext} from '../utils/errorContext.ts';
import {isPromiseOnly,assessReply,decideContinuation,MAX_DELIVERY_RETRIES} from '../utils/replyQuality.ts';

const root = 'E:/Project Falcon/dhruvdesh-mis';
const known = ['src/features/dashboard/CeoReport.tsx', 'src/main.tsx', 'vite.config.ts', 'package.json'];
// The Vite overlay Sir pasted, trimmed.
const viteError = `[plugin:vite:oxc] Transform failed with 1 error:

[PARSE_ERROR] Adjacent JSX elements must be wrapped in an enclosing tag.
    ╭─[ src/features/dashboard/CeoReport.tsx:610:15 ]
    │
610 │               <button
    │
    │ Help: Did you want a JSX fragment \`<>...</>\`?
E:/Project Falcon/dhruvdesh-mis/src/features/dashboard/CeoReport.tsx
    at transformWithOxc (file:///E:/Project%20Falcon/dhruvdesh-mis/node_modules/vite/dist/node/chunks/node.js:4090:19)
    at async loadAndTransform (file:///E:/Project%20Falcon/dhruvdesh-mis/node_modules/vite/dist/node/chunks/node.js:20594:26)
Click outside, press Esc key, or fix the code to dismiss.
You can also disable this overlay by setting server.hmr.overlay to false in vite.config.ts.
please fix ths error.`;

it('recognises a pasted build error and finds the file and line it points at', () => {
  assert.equal(isErrorReport(viteError), true);
  assert.equal(isErrorReport('please fix the header'), false);
  const locations = extractErrorLocations(viteError, root, known);
  assert.deepEqual(locations[0], {path: 'src/features/dashboard/CeoReport.tsx', line: 610, column: 15});
  assert.ok(!locations.some((l) => l.path.includes('node_modules')), 'vite internals are not project files');
});

it('resolves absolute, backslashed and other-style paths onto the project', () => {
  assert.equal(resolveWorkspacePath('E:\\Project Falcon\\dhruvdesh-mis\\src\\main.tsx', root, known), 'src/main.tsx');
  assert.equal(resolveWorkspacePath('/app/src/main.tsx', root, known), 'src/main.tsx');
  assert.equal(resolveWorkspacePath('Falcon/dhruvdesh-mis/src/new/Thing.tsx', root, known), 'src/new/Thing.tsx');
  assert.equal(resolveWorkspacePath('node_modules/vite/dist/node.js', root, known), null);
  assert.equal(resolveWorkspacePath('C:/other/place/x.ts', root, known), null);
  const ts = extractErrorLocations('src/main.tsx(12,5): error TS2322: Type string is not assignable', root, known);
  assert.deepEqual(ts[0], {path: 'src/main.tsx', line: 12, column: 5});
  const py = extractErrorLocations('Traceback:\n  File "app/server.py", line 42, in run\nKeyError', root, ['app/server.py']);
  assert.deepEqual(py[0], {path: 'app/server.py', line: 42, column: undefined});
});

it('reads the lines around the error, verbatim and mostly above it', () => {
  const lines = Array.from({length: 1200}, (_, i) => `line ${i + 1} ${'x'.repeat(40)}`);
  const ex = buildErrorExcerpt('src/a.tsx', lines.join('\n'), 610, 6000);
  assert.equal(ex.whole, false);
  assert.ok(ex.startLine < 610 && ex.endLine > 610);
  assert.ok(610 - ex.startLine > ex.endLine - 610, 'more context before the reported line');
  assert.equal(ex.text.split('\n')[610 - ex.startLine], lines[609]);
  const small = buildErrorExcerpt('src/b.tsx', 'a\nb\nc', 2);
  assert.equal(small.whole, true);
  const section = formatErrorContext([ex], true);
  assert.match(section, /ERROR FILE: src\/a\.tsx/);
  assert.match(section, /line 610, which is: "line 610 x+"/);
  assert.match(section, /"edits"/);
});

it('detects replies that only promise to look', () => {
  const stalled = JSON.stringify({text: "I'll check the file around line 610 to see the JSX structure issue.", speechText: 'x'});
  assert.equal(isPromiseOnly(stalled, {editsAllowed: true}), true);
  assert.equal(isPromiseOnly(JSON.stringify({text: 'Line 610 file dekhta hoon.', speechText: 'x'}), {editsAllowed: true}), true);
  const fixed = JSON.stringify({text: "I'll explain: the <div> at 598 was never closed.", speechText: 'x', edits: [{path: 'src/features/dashboard/CeoReport.tsx', find: '<div>', replace: '<>'}]});
  assert.equal(isPromiseOnly(fixed, {editsAllowed: true}), false);
  const code = JSON.stringify({text: 'Let me show it:\n```tsx\n<>\n  <Header />\n  <button onClick={go}>Go</button>\n</>\n```', speechText: 'x'});
  assert.equal(isPromiseOnly(code, {editsAllowed: false}), false);
});

it('re-asks a stalled fix with a fix-specific prompt, and stops after the retry limit', () => {
  const stalled = JSON.stringify({text: "I'll check the file around line 610 to see the JSX structure issue.", speechText: 'x'});
  const problem = assessReply(stalled, 'please fix ths error', {editsAllowed: true, errorReport: true});
  assert.equal(problem?.kind, 'empty-promise');
  assert.match(problem!.followUp, /ERROR LOCATION/);
  // "fix" alone is an action request now, even without the pasted error.
  assert.equal(assessReply(stalled, 'header fix karo', {editsAllowed: true})?.kind, 'empty-promise');

  const first = decideContinuation(stalled, viteError, 0, {editsAllowed: true, errorReport: true});
  assert.equal(first.retry, true);
  assert.equal(first.reason, 'empty-promise');
  assert.equal(decideContinuation(stalled, viteError, MAX_DELIVERY_RETRIES, {editsAllowed: true, errorReport: true}).retry, false, 'bounded');
  assert.equal(decideContinuation(stalled, viteError, 0, {editsAllowed: true, audit: true}).retry, false, 'audits are never re-asked');
  const delivered = JSON.stringify({text: 'Wrapped the two siblings in a fragment.', speechText: 'x', edits: [{path: 'src/features/dashboard/CeoReport.tsx', find: '<button', replace: '<><button'}]});
  assert.equal(decideContinuation(delivered, viteError, 0, {editsAllowed: true, errorReport: true}).retry, false);
  const chat = JSON.stringify({text: "I'll explain: closures capture variables from their scope.", speechText: 'x'});
  assert.equal(decideContinuation(chat, 'what is a closure?', 0, {editsAllowed: false}).retry, false, 'questions are not re-asked');
});
