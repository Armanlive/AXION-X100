import {it} from 'node:test';
import assert from 'node:assert/strict';
import {validateResearch, runResearch, describeResearch, type ResearchDeps} from '../utils/agentTools.ts';
import {looksLikeCommandOutput} from '../utils/errorContext.ts';
import {assessReply} from '../utils/replyQuality.ts';
import {parseDesktopAction} from '../utils/desktopActions.ts';
import {replyFields} from '../utils/conversationLanguage.ts';

const files = {
  'src/App.tsx': "import CeoReport from './features/dashboard/CeoReport';\nexport default function App() { return <CeoReport month=\"Oct\" />; }\n",
  'src/features/dashboard/CeoReport.tsx': "fatal: path 'src/features/dashboard/CeoReport.tsx' exists on disk, but not in 'main'\n",
  'src/features/dashboard/CeoReport.mobile.css': '.ceo { display: grid; }\n',
};
const deps: ResearchDeps = {
  files,
  git: async (kind, path, rev) => (kind === 'log' ? 'a1b2c3d 2026-10-20 feat: CEO report' : kind === 'show' ? `// ${path} at ${rev}\nexport default function CeoReport() {}` : ''),
};

it('accepts only safe read-only research requests', () => {
  assert.deepEqual(validateResearch({type: 'read_file', path: '.\\src\\App.tsx'}), {type: 'read_file', path: 'src/App.tsx'});
  assert.deepEqual(validateResearch({type: 'git', kind: 'show', path: 'src/a.ts', rev: 'main~1'}), {type: 'git', kind: 'show', path: 'src/a.ts', rev: 'main~1'});
  for (const bad of [{type: 'read_file', path: '../secrets'}, {type: 'read_file', path: 'C:/Windows/x'}, {type: 'git', kind: 'push'}, {type: 'git', kind: 'show', path: 'a.ts'}, {type: 'delete_file', path: 'a'}])
    assert.equal(validateResearch(bad), null, JSON.stringify(bad));
});

it('never lets the model read secret files, directly or through git', async () => {
  for (const path of ['.env', 'config/.env.local', '.ENV.production', '.git/config', 'certs/server.pem', 'deploy/id_rsa', '.npmrc', 'aws_credentials.json', 'client_secret.json'])
    for (const action of [{type: 'read_file', path}, {type: 'git', kind: 'show', path, rev: 'HEAD~1'}, {type: 'git', kind: 'diff', path}])
      assert.equal(validateResearch(action), null, JSON.stringify(action));
  assert.deepEqual(validateResearch({type: 'read_file', path: '.env.example'}), {type: 'read_file', path: '.env.example'});
  const leaky: ResearchDeps = {files: {...files, '.env': 'API_KEY=fake-not-real'}, readFile: async () => 'API_KEY=fake-not-real', git: async () => 'API_KEY=fake-not-real'};
  for (const action of [{type: 'read_file', path: '.env'}, {type: 'git', kind: 'show', path: '.env', rev: 'HEAD'}, {type: 'search_code', query: 'API_KEY'}] as const)
    assert.doesNotMatch(await runResearch(action, leaky), /fake-not-real/, action.type);
});

it('reads, searches, lists and asks git', async () => {
  assert.match(await runResearch({type: 'read_file', path: 'src/App.tsx'}, deps), /FILE src\/App\.tsx \(3 lines/);
  assert.match(await runResearch({type: 'read_file', path: 'src/Missing.tsx'}, deps), /File not found/);
  const hits = await runResearch({type: 'search_code', query: 'ceoreport'}, deps);
  assert.match(hits, /src\/App\.tsx:1: import CeoReport/);
  assert.match(hits, /src\/App\.tsx:2: .*<CeoReport month="Oct"/);
  assert.match(await runResearch({type: 'list_files', prefix: 'src/features/'}, deps), /2 files under src\/features\//);
  assert.match(await runResearch({type: 'git', kind: 'show', path: 'src/x.ts', rev: 'a1b2c3d'}, deps), /at a1b2c3d/);
  assert.match(await runResearch({type: 'git', kind: 'log'}, {files}), /only available in the AXION desktop app/);
  assert.equal(describeResearch({type: 'git', kind: 'log', path: 'src/a.ts'}), 'Checking git log for src/a.ts');
});

it('spots a file whose content was replaced by a command error', () => {
  assert.equal(looksLikeCommandOutput(files['src/features/dashboard/CeoReport.tsx']), true);
  assert.equal(looksLikeCommandOutput("'tsc' is not recognized as an internal or external command"), true);
  assert.equal(looksLikeCommandOutput(files['src/App.tsx']), false);
});

it('a research request is a valid move, not an "unsupported tool"', () => {
  const raw = JSON.stringify({text: 'Checking git history for this file.', speechText: 'x', action: {type: 'git', kind: 'log', path: 'src/features/dashboard/CeoReport.tsx'}});
  assert.equal(assessReply(raw, 'fix this error', {editsAllowed: true, errorReport: true}), null);
  assert.equal(parseDesktopAction(raw), null, 'not run as a desktop action');
  assert.deepEqual(validateResearch(replyFields(raw).action), {type: 'git', kind: 'log', path: 'src/features/dashboard/CeoReport.tsx'});
});
