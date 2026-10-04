import React, { useState, useEffect } from 'react';
import { useAxionStore } from './store/useAxionStore';
import { DesktopShell } from './components/DesktopShell';
import { MobileShell } from './components/mobile/MobileShell';
import { PaidModelModal } from './components/PaidModelModal';
import { DiffViewer } from './components/DiffViewer';
import { X } from 'lucide-react';

function useIsMobile(breakpoint = 1024): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < breakpoint;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

export default function App() {
  const isMobile = useIsMobile(1024);
  const { activeDiffModal, closeDiffModal } = useAxionStore();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b0b0c] text-[#f4f4f5]">
      {/* Dedicated Shell: Mobile (<1024px) or Desktop (>=1024px) */}
      {isMobile ? <MobileShell /> : <DesktopShell />}

      {/* Global Diff Inspection Modal */}
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
                aria-label="Close diff modal"
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
