import {it} from 'node:test';
import assert from 'node:assert/strict';
import {desktopFolderRequest, desktopFolderRenameRequest} from '../utils/desktopFolder.ts';

it('desktop folder creation requires an explicit request, not a mention or negation', () => {
  assert.deepEqual(desktopFolderRequest('Create a folder named Sana on desktop.'), {name:'Sana'});
  assert.deepEqual(desktopFolderRequest('Desktop pe "Sana" folder banao'), {name:'Sana'});
  assert.deepEqual(desktopFolderRequest('desktop pe folder create karo'), {name:'New Folder'});
  assert.deepEqual(desktopFolderRequest('desktp pe ek foldr bna do'), {name:'New Folder'}, 'tolerates spelling typos');
  assert.equal(desktopFolderRequest('open desktop folder'), null);
  assert.equal(desktopFolderRequest('do not create a folder on desktop'), null);
  assert.equal(desktopFolderRequest('डेस्कटॉप पर फोल्डर मत बनाओ'), null);
});

it('recognizes desktop folder rename requests in English and Hinglish', () => {
  assert.deepEqual(desktopFolderRenameRequest('rename desktop folder "OldProject" to "NewProject"'), {oldName: 'OldProject', newName: 'NewProject'});
  assert.deepEqual(desktopFolderRenameRequest('desktop pe folder "Old" ko "New" rename kar do'), {oldName: 'Old', newName: 'New'});
  assert.deepEqual(desktopFolderRenameRequest('rename folder Alpha to Beta on desktop'), {oldName: 'Alpha', newName: 'Beta'});
  assert.deepEqual(desktopFolderRenameRequest('desktop pe folder Test ka naam badal ke Demo kar do'), {oldName: 'Test', newName: 'Demo'});
  assert.equal(desktopFolderRenameRequest('do not rename folder on desktop'), null);
});
import {
  parseDesktopAction,
  validateAction,
  runDesktopAction,
  describeDriveReport,
  formatBytes,
  type DesktopDeps,
  type ProjectMatch,
} from '../utils/desktopActions.ts';

const GB = 1024 ** 3;

function deps(over: Partial<DesktopDeps> = {}, log: string[] = []): DesktopDeps {
  return {
    findProject: async () => [],
    openProject: async (p) => { log.push(`project:${p}`); },
    openInstalledApp: async (n) => { log.push(`app:${n}`); return 'Visual Studio Code'; },
    openFolder: async (t) => { log.push(`folder:${t}`); },
    openWebsite: async (t, q) => { log.push(`web:${t}:${q ?? ''}`); },
    driveReport: async (d) => ({drive: `${d}:\\`, total_bytes: 100 * GB, free_bytes: 5 * GB, partial: false,
      top_folders: [{path: 'C:\\Users', bytes: 60 * GB}], largest_subfolders: [{path: 'C:\\Users\\ADMIN', bytes: 55 * GB}]}),
    runChecks: async () => { log.push('checks'); return [{label: 'TypeScript', command: 'tsc --noEmit', success: false, exit_code: 2, timed_out: false, output: 'src/a.ts(1,1): error TS2304'}]; },
    ...over,
  };
}

it('reads the action the model chose and rejects anything else', () => {
  assert.deepEqual(parseDesktopAction('{"text":"Khol raha hoon","speechText":"x","action":{"type":"open_project","name":"Sana","drive":"e:"}}'),
    {type: 'open_project', name: 'Sana', drive: 'E'});
  assert.deepEqual(parseDesktopAction('```json\n{"text":"a","action":{"type":"open_app","name":"Excel"}}\n```'), {type: 'open_app', name: 'Excel'});
  assert.equal(parseDesktopAction('{"text":"hi","speechText":"hi"}'), null);
  assert.equal(parseDesktopAction('plain text'), null);
  assert.equal(validateAction({type: 'delete_files', path: 'C:\\'}), null);
  assert.equal(validateAction({type: 'drive_report', drive: 'C:\\Windows'}), null);
  assert.equal(validateAction({type: 'open_folder', target: 'C:\\secret'}), null);
  assert.equal(validateAction({type: 'open_website', target: 'search'}), null, 'search needs a query');
  assert.deepEqual(validateAction({type: 'drive_report', drive: 'c'}), {type: 'drive_report', drive: 'C'});
});

it('opens a clearly matching project, asks when several match', async () => {
  const log: string[] = [];
  const one: ProjectMatch[] = [{name: 'Sana-AI', path: 'E:\\work\\Sana-AI', is_project: true}];
  const opened = await runDesktopAction({type: 'open_project', name: 'sana', drive: 'E'}, deps({findProject: async () => one}, log));
  assert.deepEqual(log, ['project:E:\\work\\Sana-AI']);
  assert.match(opened.reply.text, /"Sana-AI" is open as the project/);

  const many: ProjectMatch[] = [{name: 'sana-v1', path: 'E:\\a\\sana-v1', is_project: true}, {name: 'sana-v2', path: 'E:\\b\\sana-v2', is_project: true}];
  const asked = await runDesktopAction({type: 'open_project', name: 'sana'}, deps({findProject: async () => many}, log));
  assert.equal(log.length, 1, 'nothing opened on an ambiguous match');
  assert.match(asked.reply.text, /Which one should I open\?/);

  const none = await runDesktopAction({type: 'open_project', name: 'ghost', drive: 'E'}, deps());
  assert.match(none.reply.text, /couldn't find a folder called "ghost" on the E: drive/);
});

it('turns failures into an honest reply instead of throwing', async () => {
  const failed = await runDesktopAction({type: 'open_app', name: 'Photoshop'},
    deps({openInstalledApp: async () => { throw new Error('No installed app named "Photoshop"'); }}));
  assert.match(failed.reply.text, /didn't work: No installed app named "Photoshop"/);
});

it('reports drive usage with real numbers for the model to explain', async () => {
  const r = await runDesktopAction({type: 'drive_report', drive: 'C'}, deps());
  assert.ok(r.observation);
  assert.match(r.observation!, /95 GB used of 100 GB \(95%\), 5\.0 GB free/);
  assert.match(r.observation!, /C:\\Users\\ADMIN: 55 GB/);
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.match(describeDriveReport({drive: 'D:\\', total_bytes: 0, free_bytes: 0, top_folders: [], largest_subfolders: [], partial: true}), /time limit/);
});

it('runs simple open actions', async () => {
  const log: string[] = [];
  await runDesktopAction({type: 'open_app', name: 'vs code'}, deps({}, log));
  await runDesktopAction({type: 'open_folder', target: 'downloads'}, deps({}, log));
  await runDesktopAction({type: 'open_website', target: 'youtube'}, deps({}, log));
  assert.deepEqual(log, ['app:vs code', 'folder:downloads', 'web:youtube:']);
  const app = await runDesktopAction({type: 'open_app', name: 'vs code'}, deps());
  assert.equal(app.keepModelText, true, "the model's own line, in the user's language, is kept");
});

it('reads an action from a tool-call wrapped reply (seen from Qwen)', () => {
  const raw = 'I\'ll open the workspace.\n<tool_call>action>\n{"type": "open_project", "name": "Sana-ai-voice-assistant", "drive": "E"}\n{\n"text": "Opening the workspace.",\n"speechText": "Opening it."\n}';
  assert.deepEqual(parseDesktopAction(raw), {type: 'open_project', name: 'Sana-ai-voice-assistant', drive: 'E'});
});

it('never re-opens the project that is already open', async () => {
  const log: string[] = [];
  const r = await runDesktopAction({type: 'open_project', name: 'Sana-ai-voice-assistant', drive: 'E'},
    {...deps({}, log), activeProjectPath: 'E:\\Sana-ai-voice-assistant'});
  assert.deepEqual(log, [], 'no search, no re-mount');
  assert.match(r.reply.text, /already the open project/);
});

it('runs the real project checks for a scan and hands the output to the model', async () => {
  const log: string[] = [];
  const r = await runDesktopAction({type: 'run_checks'}, deps({}, log));
  assert.deepEqual(log, ['checks']);
  assert.match(r.observation!, /TS2304/);
  assert.match(r.observationTask!, /real errors/);
  assert.deepEqual(validateAction({type: 'run_checks'}), {type: 'run_checks'});
  const web = await runDesktopAction({type: 'run_checks'}, deps({runChecks: async () => null}));
  assert.match(web.reply.text, /needs the AXION desktop app/);
});

import {INTEGRATIONS,connectIntegration,requestIntegration} from '../services/integrationService.ts';
import {setInferenceMode} from '../utils/hybridMode.ts';
it('integration actions validate service IDs and pass actual results through the desktop bridge',async()=>{
 assert.equal(validateAction({type:'integration_read',service:'unknown'}),null);
 assert.equal(validateAction({type:'integration_write',service:'github',title:'x'}),null);
 const action=validateAction({type:'integration_write',service:'github',resource:'owner/repo',title:'Fix',content:'Details'})!;
 let written=false;
 const result=await runDesktopAction(action,deps({integration:async(service,operation,resource,title,content)=>{
  assert.deepEqual([service,operation,resource,title,content],['github','write','owner/repo','Fix','Details']);written=true;
  return {summary:'github creation succeeded.',items:[{id:'123',title:'Fix'}]};
 }}));
 assert.equal(written,true);assert.equal(result.reply.text,'github creation succeeded.');assert.match(result.observation!,/123/);
});
it('plugin credentials use native IPC and never enter browser persistence; offline requests fail before IPC',async()=>{
 const calls:{command:string;args:any}[]=[];
 (globalThis as any).isTauri=true;
 (globalThis as any).window={isTauri:true,__TAURI_INTERNALS__:{invoke:async(command:string,args:any)=>{calls.push({command,args});return {summary:'Verified',items:[]};}}};
 try{
  setInferenceMode('online');
  assert.equal(INTEGRATIONS.length,7);
  await connectIntegration('github','fixture-not-a-real-token');
  assert.equal(calls[0].command,'integration_connect');assert.equal(calls[0].args.token,'fixture-not-a-real-token');
  setInferenceMode('offline');await assert.rejects(()=>requestIntegration('github','read'),/online mode/);
  assert.equal(calls.length,1);
 }finally{setInferenceMode('online');delete (globalThis as any).window;delete (globalThis as any).isTauri;}
});
