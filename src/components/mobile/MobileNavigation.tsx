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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#050508]/95 backdrop-blur-md border-t border-cyan-500/25 px-2 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-5px_20px_rgba(0,0,0,0.8)]"
    >
      <div className="grid grid-cols-4 items-center h-14 max-w-md mx-auto">
        {/* 1. Chat Tab */}
        <button
          onClick={handleNavChat}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-all ${
            isChatActive ? 'text-[#00f0ff]' : 'text-cyan-400/50 hover:text-cyan-200'
          }`}
          aria-label="Chat Tab"
          aria-current={isChatActive ? 'page' : undefined}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${isChatActive ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]' : 'text-cyan-500/40'}`} />
            {isChatActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-1 font-semibold">Chat</span>
        </button>

        {/* 2. Voice Tab (Hero) */}
        <button
          onClick={handleNavVoice}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-all ${
            isVoiceActive ? 'text-[#00f0ff]' : 'text-cyan-400/50 hover:text-cyan-200'
          }`}
          aria-label="Voice Tab"
          aria-current={isVoiceActive ? 'page' : undefined}
        >
          <div className="relative">
            <Mic className={`w-5 h-5 ${isVoiceActive ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]' : 'text-cyan-500/40'}`} />
            {isVoiceActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-1 font-semibold">Voice</span>
        </button>

        {/* 3. Workspace Tab */}
        <button
          onClick={handleNavWorkspace}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-all ${
            isWorkspaceActive ? 'text-[#00f0ff]' : 'text-cyan-400/50 hover:text-cyan-200'
          }`}
          aria-label="Workspace Tab"
          aria-current={isWorkspaceActive ? 'page' : undefined}
        >
          <div className="relative">
            <Folder className={`w-5 h-5 ${isWorkspaceActive ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]' : 'text-cyan-500/40'}`} />
            {isWorkspaceActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-1 font-semibold">Workspace</span>
        </button>

        {/* 4. More Tab */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center min-h-[44px] h-full py-1 transition-all ${
            isMoreOpen ? 'text-[#00f0ff]' : 'text-cyan-400/50 hover:text-cyan-200'
          }`}
          aria-label="More Features"
          aria-expanded={isMoreOpen}
        >
          <div className="relative">
            <MoreHorizontal className={`w-5 h-5 ${isMoreOpen ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]' : 'text-cyan-500/40'}`} />
            {isMoreOpen && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-1 font-semibold">More</span>
        </button>
      </div>
    </nav>
  );
};
