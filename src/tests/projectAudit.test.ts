import {it} from 'node:test';
import assert from 'node:assert/strict';
import {detectAuditIntent, chooseAuditFiles, formatAuditData, type Inventory} from '../utils/projectAudit.ts';
import {recoverConversationReply, replyFields} from '../utils/conversationLanguage.ts';
import {parseDesktopAction} from '../utils/desktopActions.ts';

const inv: Inventory = {
  name: 'Sana-ai-voice-assistant', files: 30, lines: 2026,
  languages: [{language: 'TypeScript', files: 14, lines: 1848}],
  structure: [['src/', 14], ['public/', 6]],
  largest_files: [{path: 'src/App.tsx', lines: 866}, {path: 'src/services/liveService.ts', lines: 229}],
  manifests: ['package.json', 'tsconfig.json'], scripts: [['lint', 'tsc --noEmit'], ['build', 'vite build']],
  dependencies: ['react', 'firebase'], dev_dependencies: ['typescript'], not_installed: ['typescript'],
  test_files: 0, has_readme: true, env_files: ['.env'], env_ignored_by_git: true,
  todos: [], todo_count: 0, secrets: [{path: 'src/firebase.ts', line: 6, kind: 'Google API key'}],
  git: {branch: '(no commits yet)', commits: 0, first_commit: null, last_commit: null, uncommitted_files: 11, remote: null},
  oldest_file_date: '2026-04-13', newest_file_date: '2026-07-17', partial: false,
};

it('recognises scan/audit requests in English, Hinglish and Hindi', () => {
  for (const t of ['bhai project ko scan karo', 'scan this project for bugs', '@workspace audit', 'is project ka code review karo', 'प्रोजेक्ट स्कैन करो', 'find bugs in the code', 'project ki jaanch karo', 'scan karo', 'audit it'])
    assert.equal(detectAuditIntent(t), true, t);
  for (const t of ['open chrome', 'what is a scanner?', 'make the header smaller']) assert.equal(detectAuditIntent(t), false, t);
});

it('picks entry points and the biggest files to read', () => {
  const paths = ['README.md', 'package.json', 'src/main.tsx', 'src/App.tsx', 'src/services/liveService.ts', 'src/utils/x.ts', 'public/logo.png'];
  assert.deepEqual(chooseAuditFiles(paths, inv), ['README.md', 'package.json', 'src/main.tsx', 'src/App.tsx', 'src/services/liveService.ts']);
});

it('gives the model the real measured facts', () => {
  const data = formatAuditData(inv, []);
  assert.match(data, /untrusted data/);
  assert.match(data, /Declared but NOT installed: typescript/);
  assert.match(data, /src\/firebase\.ts:6 Google API key/);
  assert.match(data, /git initialised but no commits yet; 11/);
  assert.match(data, /No type-check, tests or build found/);
  assert.match(formatAuditData(null, null), /needs the AXION desktop app/);
});

it('understands <|tool_call_start|> function calls and never shows the markup', () => {
  const raw = '<|tool_call_start|>[run_checks()]<|tool_call_end|>\n\nScanning the project now.';
  assert.deepEqual(parseDesktopAction(raw), {type: 'run_checks'});
  assert.equal(recoverConversationReply(raw).text, 'Scanning the project now.');
  assert.deepEqual(replyFields('<tool_call>open_app(name="VS Code")</tool_call>').action, {type: 'open_app', name: 'VS Code'});
  assert.equal(recoverConversationReply('<|tool_call_start|>[run_checks()]<|tool_call_end|>').text, 'On it.');
});
