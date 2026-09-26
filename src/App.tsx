import React from 'react';
import { useAxionStore } from './store/useAxionStore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WorkspaceChat } from './components/WorkspaceChat';
import { AgentLab } from './components/AgentLab';
import { DiffReviewGateTab } from './components/DiffReviewGateTab';
import { TerminalAudit } from './components/TerminalAudit';
import { CloudRouter } from './components/CloudRouter';
import { RollbackVault } from './components/RollbackVault';
import { PilotLogViewer } from './components/PilotLogViewer';
import { PaidModelModal } from './components/PaidModelModal';
import { CodeFileViewer } from './components/CodeFileViewer';

export default function App() {
  const { currentTab } = useAxionStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090d16] text-[#e2e8f0] overflow-hidden select-none font-sans antialiased">
      {/* Top Application Header */}
      <Header />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Center Content Tab View */}
        <main className="flex-1 flex overflow-hidden">
          {currentTab === 'workspace' && (
            <div className="flex-1 flex overflow-hidden">
              <WorkspaceChat />
              <CodeFileViewer />
            </div>
          )}

          {currentTab === 'agents' && <AgentLab />}

          {currentTab === 'diffs' && <DiffReviewGateTab />}

          {currentTab === 'terminal' && <TerminalAudit />}

          {currentTab === 'router' && <CloudRouter />}

          {currentTab === 'rollback' && <RollbackVault />}

          {currentTab === 'pilot' && <PilotLogViewer />}
        </main>
      </div>

      {/* Paid Model Override Dialog */}
      <PaidModelModal />
    </div>
  );
}
