import {BootSequence} from './components/BootSequence';
import { initializeWorkspace } from './services/workspaceStartup';
import {PerceptionPanel} from './components/PerceptionPanel';
import {VisionModule} from './components/VisionModule';
import {BackgroundWake} from './components/voice/BackgroundWake';
import {ProfileOnboarding} from './components/ProfileOnboarding';
import {CloudBrainWelcome} from './components/CloudBrainWelcome';
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
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [bootVisible,setBootVisible]=useState(true);
  useEffect(()=>{if(!workspaceReady)return;const timer=setTimeout(()=>setBootVisible(false),450);return()=>clearTimeout(timer);},[workspaceReady]);
  const [providersChecked,setProvidersChecked]=useState(false);
  useEffect(()=>{void useAxionStore.getState().refreshProviders().catch(error=>useAxionStore.setState({scanStatusMessage:`Provider vault: ${String(error)}`})).finally(()=>setProvidersChecked(true));},[]);
  useEffect(() => { let mounted = true; void initializeWorkspace().finally(() => { if (mounted) setWorkspaceReady(true); }); return () => { mounted = false; }; }, []);
  const { activeDiffModal, closeDiffModal, speechMode } = useAxionStore();

  if (!workspaceReady) return <BootSequence/>;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050508] text-[#e2f1fd]">
      {bootVisible&&<BootSequence ready/>}
      {/* Dedicated Shell: Mobile (<1024px) or Desktop (>=1024px) */}
      {isMobile ? <MobileShell /> : <DesktopShell />}

      <CloudBrainWelcome checked={providersChecked && !bootVisible} />
      <ProfileOnboarding />
      <PerceptionPanel />
      {!isMobile && <VisionModule />}
      {/* The Voice screen owns the mic itself; elsewhere AXION sleeps until called by name. */}
      {!isMobile && speechMode !== 'speech' && <BackgroundWake />}
      {/* Global Diff Inspection Modal */}
      {activeDiffModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070c18] border border-cyan-500/35 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_40px_rgba(0,240,255,0.2)] animate-in fade-in duration-150">
            <div className="p-3 bg-[#0a1224] border-b border-cyan-500/25 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-cyan-200">
                Detailed Diff Inspection • {activeDiffModal.filePath}
              </span>
              <button
                onClick={closeDiffModal}
                className="p-1 rounded-lg hover:bg-cyan-950 text-cyan-400 hover:text-white transition"
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
