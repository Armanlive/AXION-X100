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
import { ErrorBoundary } from './components/ErrorBoundary';
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
    isFilePanelOpen,
    isPreviewPanelOpen,
    auxPanelWidth,
    setAuxPanelWidth
  } = useAxionStore();

  const [isDraggingTerminalDivider, setIsDraggingTerminalDivider] = useState(false);
  const dragTerminalStartRef = useRef<{ startX: number; startY: number; startDim: number }>({
    startX: 0,
    startY: 0,
    startDim: 0
  });

  const [isDraggingAuxDivider, setIsDraggingAuxDivider] = useState(false);
  const dragAuxStartRef = useRef<{ startX: number; startW: number }>({
    startX: 0,
    startW: 0
  });

  const handleMouseDownTerminalDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTerminalDivider(true);
    dragTerminalStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDim: terminalDockPosition === 'bottom' ? terminalHeight : terminalWidth
    };
  };

  const handleMouseDownAuxDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAuxDivider(true);
    dragAuxStartRef.current = {
      startX: e.clientX,
      startW: auxPanelWidth
    };
  };

  // Terminal drag listener
  useEffect(() => {
    if (!isDraggingTerminalDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (terminalDockPosition === 'bottom') {
        const delta = dragTerminalStartRef.current.startY - e.clientY;
        const newH = Math.max(120, Math.min(dragTerminalStartRef.current.startDim + delta, 650));
        setTerminalHeight(newH);
      } else if (terminalDockPosition === 'right') {
        const delta = dragTerminalStartRef.current.startX - e.clientX;
        const newW = Math.max(260, Math.min(dragTerminalStartRef.current.startDim + delta, 800));
        setTerminalWidth(newW);
      } else if (terminalDockPosition === 'left') {
        const delta = e.clientX - dragTerminalStartRef.current.startX;
        const newW = Math.max(260, Math.min(dragTerminalStartRef.current.startDim + delta, 800));
        setTerminalWidth(newW);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingTerminalDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTerminalDivider, terminalDockPosition, terminalHeight, terminalWidth, setTerminalHeight, setTerminalWidth]);

  // Auxiliary panel drag listener
  useEffect(() => {
    if (!isDraggingAuxDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragAuxStartRef.current.startX - e.clientX;
      const newW = Math.max(260, Math.min(dragAuxStartRef.current.startW + delta, 750));
      setAuxPanelWidth(newW);
    };

    const handleMouseUp = () => {
      setIsDraggingAuxDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingAuxDivider, auxPanelWidth, setAuxPanelWidth]);

  return (
    <div
      className={`h-screen w-screen flex flex-col bg-[#0b0b0c] text-[#f4f4f5] overflow-hidden select-none font-sans antialiased ${
        isDraggingTerminalDivider
          ? terminalDockPosition === 'bottom'
            ? 'cursor-row-resize'
            : 'cursor-col-resize'
          : isDraggingAuxDivider
          ? 'cursor-col-resize'
          : ''
      }`}
    >
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
                        onMouseDown={handleMouseDownTerminalDivider}
                        className="w-1 bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 cursor-col-resize shrink-0 transition-colors z-20"
                        title="Drag to resize terminal panel"
                      />
                    </>
                  )}

                  {/* Center Area: Chat + Filesystem/Preview + Bottom Terminal */}
                  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {/* Upper Area: Chat + On-Demand Resizable Auxiliary Right Panel (Files or Preview) */}
                    <div className="flex-1 flex overflow-hidden min-w-0 relative">
                      <WorkspaceChat />

                      {/* On-Demand Right Auxiliary Panel (Files / Preview) */}
                      {(isFilePanelOpen || isPreviewPanelOpen) && (
                        <>
                          <div
                            onMouseDown={handleMouseDownAuxDivider}
                            className="w-1 bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 cursor-col-resize shrink-0 transition-colors z-20"
                            title="Drag to resize right panel"
                          />
                          <div
                            style={{ width: `${auxPanelWidth}px` }}
                            className="h-full shrink-0 flex overflow-hidden bg-[#0c0c0e] animate-in slide-in-from-right-2 duration-150 border-l border-zinc-800/80"
                          >
                            {isFilePanelOpen && (
                              <ErrorBoundary fallbackTitle="File Viewer Unavailable">
                                <CodeFileViewer />
                              </ErrorBoundary>
                            )}
                            {isPreviewPanelOpen && (
                              <ErrorBoundary fallbackTitle="Preview & Activity Drawer Unavailable">
                                <PreviewActivityDrawer />
                              </ErrorBoundary>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bottom Docked Terminal */}
                    {isTerminalOpen && terminalDockPosition === 'bottom' && (
                      <>
                        <div
                          onMouseDown={handleMouseDownTerminalDivider}
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
                        onMouseDown={handleMouseDownTerminalDivider}
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
