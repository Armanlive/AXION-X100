import React, { useState } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { MobileNavigation } from './MobileNavigation';
import { MobileChat } from './MobileChat';
import { MobileVoice } from './MobileVoice';
import { MobileWorkspace } from './MobileWorkspace';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { AgentLab } from '../AgentLab';
import { CloudRouter } from '../CloudRouter';
import { DiffReviewGateTab } from '../DiffReviewGateTab';
import { TerminalAudit } from '../TerminalAudit';
import { RollbackVault } from '../RollbackVault';
import { PilotLogViewer } from '../PilotLogViewer';
import { ArrowLeft } from 'lucide-react';

export const MobileShell: React.FC = () => {
  const { currentTab, setCurrentTab, speechMode, setSpeechMode } = useAxionStore();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Return back to main chat
  const handleBackToChat = () => {
    setSpeechMode('chat');
    setCurrentTab('workspace');
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#0b0b0c] text-[#f4f4f5] overflow-hidden select-none font-sans antialiased relative">
      {/* Active Mobile View */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {speechMode === 'speech' ? (
          <MobileVoice />
        ) : currentTab === 'workspace' ? (
          <MobileChat />
        ) : currentTab === 'local_workspace' ? (
          <MobileWorkspace />
        ) : (
          /* Wrapped View for Secondary Tabs (Agent Lab, Cloud Brain, Tools) with Back Navigation */
          <div className="flex-1 flex flex-col h-full overflow-hidden pb-16">
            <header className="h-12 bg-[#09090b]/95 border-b border-zinc-800/80 px-3 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
              <button
                onClick={handleBackToChat}
                className="flex items-center gap-1.5 px-2 py-1 min-h-[44px] text-xs font-medium text-zinc-300 hover:text-white"
                aria-label="Back to Chat"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>Back to Chat</span>
              </button>

              <span className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider">
                {currentTab.replace('_', ' ')}
              </span>
            </header>

            <div className="flex-1 overflow-auto">
              {currentTab === 'agents' && <AgentLab />}
              {currentTab === 'cloud_brain' && <CloudRouter />}
              {currentTab === 'diffs' && <DiffReviewGateTab />}
              {currentTab === 'terminal' && <TerminalAudit isDockedPanel={false} />}
              {currentTab === 'router' && <CloudRouter />}
              {currentTab === 'rollback' && <RollbackVault />}
              {currentTab === 'pilot' && <PilotLogViewer />}
            </div>
          </div>
        )}
      </main>

      {/* Dedicated Fixed Mobile Navigation Bar */}
      <MobileNavigation
        isMoreOpen={isMoreOpen}
        onOpenMore={() => setIsMoreOpen(true)}
      />

      {/* Slide-Up More Features Drawer */}
      <MobileMoreDrawer
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
      />
    </div>
  );
};
