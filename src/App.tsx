import React, { useState, useEffect, useRef } from 'react';
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
import { DiffViewer } from './components/DiffViewer';
import { LiveSpeechMode } from './components/LiveSpeechMode';
import { PreviewActivityDrawer } from './components/PreviewActivityDrawer';
import { LocalWorkspacePage } from './components/LocalWorkspacePage';
import { X } from 'lucide-react';

export default function App() {
  const {
    currentTab,
    isTerminalOpen,
    terminalDockPosition,
    terminalHeight,
    terminalWidth,
    setTerminalHeight,
    setTerminalWidth,
    activeDiffModal,
    closeDiffModal,
    speechMode,
    isPreviewPanelOpen
  } = useAxionStore();

  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; startDim: number }>({
    startX: 0,
    startY: 0,
    startDim: 0
  });

  const handleMouseDownDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDim: terminalDockPosition === 'bottom' ? terminalHeight : terminalWidth
    };
  };

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (terminalDockPosition === 'bottom') {
        const delta = dragStartRef.current.startY - e.clientY;
        const newH = Math.max(120, Math.min(dragStartRef.current.startDim + delta, 650));
        setTerminalHeight(newH);
      } else if (terminalDockPosition === 'right') {
        const delta = dragStartRef.current.startX - e.clientX;
        const newW = Math.max(260, Math.min(dragStartRef.current.startDim + delta, 800));
        setTerminalWidth(newW);
      } else if (terminalDockPosition === 'left') {
        const delta = e.clientX - dragStartRef.current.startX;
        const newW = Math.max(260, Math.min(dragStartRef.current.startDim + delta, 800));
        setTerminalWidth(newW);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, terminalDockPosition, terminalHeight, terminalWidth, setTerminalHeight, setTerminalWidth]);

  return (
    <div className={`h-screen w-screen flex flex-col bg-[#0b0b0c] text-[#f4f4f5] overflow-hidden select-none font-sans antialiased ${
      isDraggingDivider ? (terminalDockPosition === 'bottom' ? 'cursor-row-resize' : 'cursor-col-resize') : ''
    }`}>
      {/* Top Minimalist Header */}
      <Header />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Compact Navigation Sidebar */}
        <Sidebar />

        {/* Center Content Tab View */}
        <main className="flex-1 flex overflow-hidden relative min-w-0">
          {speechMode === 'speech' ? (
            <LiveSpeechMode />
          ) : (
            <>
              {currentTab === 'workspace' && (
                <div className="flex-1 flex overflow-hidden min-w-0">
                  {/* Left Docked Terminal */}
                  {isTerminalOpen && terminalDockPosition === 'left' && (
                    <>
                      <div style={{ width: `${terminalWidth}px` }} className="h-full shrink-0 flex overflow-hidden">
                        <TerminalAudit isDockedPanel={true} />
                      </div>
                      <div
                        onMouseDown={handleMouseDownDivider}
                        className="w-1 bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 cursor-col-resize shrink-0 transition-colors z-20"
                        title="Drag to resize terminal panel"
                      />
                    </>
                  )}

                  {/* Center Area: Chat + Filesystem + Bottom Terminal */}
                  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {/* Upper Area: Chat + Filesystem + Preview/Activity Drawer */}
                    <div className="flex-1 flex overflow-hidden min-w-0">
                      <WorkspaceChat />
                      <CodeFileViewer />
                      {isPreviewPanelOpen && <PreviewActivityDrawer />}
                    </div>

                    {/* Bottom Docked Terminal */}
                    {isTerminalOpen && terminalDockPosition === 'bottom' && (
                      <>
                        <div
                          onMouseDown={handleMouseDownDivider}
                          className="h-1 bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 cursor-row-resize shrink-0 transition-colors z-20"
                          title="Drag to resize terminal panel"
                        />
                        <div style={{ height: `${terminalHeight}px` }} className="w-full shrink-0 flex overflow-hidden">
                          <TerminalAudit isDockedPanel={true} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Docked Terminal */}
                  {isTerminalOpen && terminalDockPosition === 'right' && (
                    <>
                      <div
                        onMouseDown={handleMouseDownDivider}
                        className="w-1 bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 cursor-col-resize shrink-0 transition-colors z-20"
                        title="Drag to resize terminal panel"
                      />
                      <div style={{ width: `${terminalWidth}px` }} className="h-full shrink-0 flex overflow-hidden">
                        <TerminalAudit isDockedPanel={true} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentTab === 'agents' && <AgentLab />}

              {currentTab === 'local_workspace' && <LocalWorkspacePage />}

              {currentTab === 'diffs' && <DiffReviewGateTab />}

              {currentTab === 'terminal' && <TerminalAudit isDockedPanel={false} />}

              {(currentTab === 'router' || currentTab === 'cloud_brain') && <CloudRouter />}

              {currentTab === 'rollback' && <RollbackVault />}

              {currentTab === 'pilot' && <PilotLogViewer />}
            </>
          )}
        </main>
      </div>

      {/* Full Diff Modal if triggered */}
      {activeDiffModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f0f12] border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in duration-150">
            <div className="p-3 bg-[#141417] border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-zinc-200">
                Detailed Diff Inspection • {activeDiffModal.filePath}
              </span>
              <button
                onClick={closeDiffModal}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <DiffViewer
                diff={activeDiffModal}
                isModal={true}
                onApprove={() => closeDiffModal()}
                onReject={() => closeDiffModal()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Paid Model Override Dialog */}
      <PaidModelModal />
    </div>
  );
}
