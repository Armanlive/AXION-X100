import React from 'react';
import { MessageSquare, Mic, Folder, MoreHorizontal } from 'lucide-react';
import { useAxionStore, TabType } from '../../store/useAxionStore';

interface MobileNavigationProps {
  onOpenMore: () => void;
  isMoreOpen: boolean;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onOpenMore,
  isMoreOpen
}) => {
  const { currentTab, setCurrentTab, speechMode, setSpeechMode } = useAxionStore();

  const isChatActive = currentTab === 'workspace' && speechMode === 'chat' && !isMoreOpen;
  const isVoiceActive = speechMode === 'speech' && !isMoreOpen;
  const isWorkspaceActive = currentTab === 'local_workspace' && speechMode === 'chat' && !isMoreOpen;

  const handleNavChat = () => {
    setSpeechMode('chat');
    setCurrentTab('workspace');
  };

  const handleNavVoice = () => {
    setSpeechMode('speech');
  };

  const handleNavWorkspace = () => {
    setSpeechMode('chat');
    setCurrentTab('local_workspace');
  };

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-800/80 px-2 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="grid grid-cols-4 items-center h-14 max-w-md mx-auto">
        {/* 1. Chat Tab */}
        <button
          onClick={handleNavChat}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-colors ${
            isChatActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Chat Tab"
          aria-current={isChatActive ? 'page' : undefined}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${isChatActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
            {isChatActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1">Chat</span>
        </button>

        {/* 2. Voice Tab (Hero) */}
        <button
          onClick={handleNavVoice}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-colors ${
            isVoiceActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Voice Tab"
          aria-current={isVoiceActive ? 'page' : undefined}
        >
          <div className="relative">
            <Mic className={`w-5 h-5 ${isVoiceActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
            {isVoiceActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1">Voice</span>
        </button>

        {/* 3. Workspace Tab */}
        <button
          onClick={handleNavWorkspace}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-colors ${
            isWorkspaceActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Workspace Tab"
          aria-current={isWorkspaceActive ? 'page' : undefined}
        >
          <div className="relative">
            <Folder className={`w-5 h-5 ${isWorkspaceActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
            {isWorkspaceActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1">Workspace</span>
        </button>

        {/* 4. More Tab */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-colors ${
            isMoreOpen ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="More Features"
          aria-expanded={isMoreOpen}
        >
          <div className="relative">
            <MoreHorizontal className={`w-5 h-5 ${isMoreOpen ? 'text-cyan-400' : 'text-zinc-500'}`} />
            {isMoreOpen && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1">More</span>
        </button>
      </div>
    </nav>
  );
};
