import {PluginsHub} from './PluginsHub';
import React from 'react';
import {useAxionStore} from '../store/useAxionStore';
import {Header} from './Header';
import {DesktopSidebar} from './DesktopSidebar';
import {WorkspaceChat} from './WorkspaceChat';
import {CodeStudio} from './CodeStudio';
import {LocalWorkspacePage} from './LocalWorkspacePage';
import {LiveSpeechMode} from './LiveSpeechMode';
import {AgentLab} from './AgentLab';
import {DiffReviewGateTab} from './DiffReviewGateTab';
import {TerminalAudit} from './TerminalAudit';
import {CloudRouter} from './CloudRouter';
import {RollbackVault} from './RollbackVault';
import {PilotLogViewer} from './PilotLogViewer';

export const DesktopShell:React.FC=()=>{
 const {currentTab,speechMode}=useAxionStore();
 return <div className="h-screen w-screen flex flex-col bg-[#050508] text-[#e2f1fd] overflow-hidden">
  <Header/>
  <div className="flex-1 flex overflow-hidden"><DesktopSidebar/>
   <main className="flex-1 min-w-0 flex overflow-hidden">
    {speechMode==='speech'?<LiveSpeechMode/>:<>
     {currentTab==='plugins'&&<PluginsHub/>}
     {currentTab==='workspace'&&<section className="flex-1 min-w-0 flex flex-col" aria-label="Chat workspace"><header className="p-3 border-b border-cyan-500/20 text-xs text-cyan-200">Chat · Conversation only · No project attached</header><WorkspaceChat/></section>}
     {currentTab==='code_studio'&&<CodeStudio/>}
     {currentTab==='local_workspace'&&<LocalWorkspacePage/>}
     {currentTab==='agents'&&<AgentLab/>}
     {currentTab==='diffs'&&<DiffReviewGateTab/>}
     {currentTab==='terminal'&&<TerminalAudit isDockedPanel={false}/>}
     {(currentTab==='router'||currentTab==='cloud_brain')&&<CloudRouter/>}
     {currentTab==='rollback'&&<RollbackVault/>}
     {currentTab==='pilot'&&<PilotLogViewer/>}
    </>}
   </main>
  </div>
 </div>;
};
