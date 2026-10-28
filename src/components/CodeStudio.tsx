import {TerminalAudit} from './TerminalAudit';
import React,{useState} from 'react';
import {useAxionStore} from '../store/useAxionStore';
import {WorkspaceChat} from './WorkspaceChat';
import {CodeFileViewer} from './CodeFileViewer';
import {LocalWorkspacePage} from './LocalWorkspacePage';
import {NativeWorkspaceService} from '../services/nativeWorkspace';
import {importGithubProject} from '../utils/githubProject';
import {runShadowChecks,summarizeChecks} from '../utils/projectChecks';
import {requiresLocalInference} from '../utils/hybridMode';

/** Development tools and project conversations share a surface, never general chat history. */
export function CodeStudio(){
 const store=useAxionStore();
 const [projects,setProjects]=useState(false),[repository,setRepository]=useState('');
 const [status,setStatus]=useState('Choose a project to begin.'),[busy,setBusy]=useState(false);
 const [showFiles,setShowFiles]=useState(()=>typeof window!=='undefined'&&window.innerWidth>=1024);
 async function linkRepository(){
  setBusy(true);
  try{
   if(requiresLocalInference())throw Error('GitHub import needs online mode. Local projects remain available offline.');
   if(NativeWorkspaceService.isNative())throw Error('Open an authenticated local GitHub clone with Projects / Open folder. Browser imports are source snapshots, not Git clones.');
   const project=await importGithubProject(repository,setStatus);
   store.loadDirectoryFiles(`${project.owner}-${project.repo}`,`github:${project.owner}/${project.repo}`,project.files);
   store.createWorkspaceChat();
   setStatus(`✓ Linked ${project.owner}/${project.repo}: ${Object.keys(project.files).length} text files. Source snapshot; no Git push or native tests available.`);
  }catch(error){setStatus(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
 }
 async function check(){
  setBusy(true);setStatus('🧪 Running checks in a shadow sandbox…');
  try{
   if(store.activeWorkspace?.runtimeMode!=='native-tauri')throw Error('Shadow tests require a native local project. Browser snapshots support source review only.');
   const checks=await runShadowChecks([]);
   setStatus(checks?summarizeChecks(checks).text:'Native test runner is unavailable. No tests ran.');
  }catch(error){setStatus(String(error));}finally{setBusy(false);}
 }
 return <section className="flex-1 min-w-0 flex flex-col overflow-hidden" aria-label="Code Studio">
  <header className="p-3 border-b border-cyan-500/25 space-y-2 bg-[#080d1a]">
   <div className="flex flex-wrap items-center gap-3 text-xs">
    <strong className="text-cyan-100">Code Studio</strong><span>{store.activeWorkspace?.name || 'No project selected'}</span>
    <button disabled={busy||store.isWorking} onClick={()=>setProjects(!projects)} className="text-cyan-300">Projects / Open folder</button>
    <button onClick={()=>setShowFiles(!showFiles)} className="text-cyan-300">{showFiles?'Hide':'Show'} files</button>
    <button disabled={!store.activeWorkspace||busy||store.isWorking} onClick={()=>void check()} className="text-cyan-300">Run shadow checks</button>
    <button disabled={store.isWorking} onClick={()=>store.createWorkspaceChat()} className="text-cyan-300">New coding thread</button>
   </div>
   <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void linkRepository();}}>
    <input aria-label="GitHub repository URL" placeholder="https://github.com/owner/repository" value={repository} onChange={e=>setRepository(e.target.value)} className="min-w-0 flex-1 bg-black/30 border border-cyan-500/25 rounded px-2 py-1 text-xs"/>
    <button disabled={busy||store.isWorking||!repository.trim()} className="text-xs text-cyan-300">Import public GitHub</button>
   </form>
   <p role="status" aria-live="polite" className="text-xs text-cyan-200 whitespace-pre-wrap">{store.isScanningProject ? store.scanStatusMessage : status}</p>
  </header>
  {projects?<LocalWorkspacePage/>:<div className="flex-1 min-h-0 flex overflow-hidden">
   {showFiles&&<aside aria-label="Project files and editor" className="w-full lg:w-1/2 min-w-0 border-r border-cyan-500/25 overflow-hidden"><CodeFileViewer embedded/></aside>}
   <div className={`${showFiles?'hidden lg:flex':'flex'} flex-1 min-w-0 h-full`}><WorkspaceChat/></div>
  </div>}
  {store.isTerminalOpen&&<div style={{height:store.terminalHeight}} className="shrink-0 border-t border-cyan-500/25 overflow-hidden"><TerminalAudit isDockedPanel/></div>}
 </section>;
}
