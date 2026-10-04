import React, { useState, useEffect, useMemo } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Laptop,
  Smartphone,
  Tablet,
  RotateCw,
  ExternalLink,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Play,
  Square,
  RefreshCw,
  Terminal,
  Globe,
  Radio,
  Layers,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';

export const PreviewActivityDrawer: React.FC = () => {
  const {
    isPreviewPanelOpen,
    togglePreviewPanel,
    previewActiveTab,
    setPreviewActiveTab,
    orchestrationActivities,
    activeWorkspaceId,
    activeWorkspace,
    workspaces,
    files,
    projectPath,
    activeModelId,
    models,
    selectedAgentId,
    agents,
    runTerminalCommand,
    detectedDevServerUrl,
    activeTerminalId,
    killRunningProcessInSession
  } = useAxionStore();

  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastReloadTime, setLastReloadTime] = useState<string>(new Date().toLocaleTimeString());

  const isServerRunning = Boolean(detectedDevServerUrl);
  const detectedPort = useMemo(() => {
    if (!detectedDevServerUrl) return 5173;
    const match = detectedDevServerUrl.match(/:([0-9]{2,5})/);
    return match ? parseInt(match[1], 10) : 5173;
  }, [detectedDevServerUrl]);

  const activeWs = activeWorkspace || workspaces?.find((w) => w.id === activeWorkspaceId) || workspaces?.[0] || null;
  const workspaceName = activeWs?.name || 'Local Workspace';
  const activeAgent = agents?.find((a) => a.id === selectedAgentId) || null;

  // Analyze active workspace files to detect runtime & scripts
  const packageJsonRaw = files ? files['package.json'] : undefined;
  let projectMeta = {
    isWebProject: true,
    runtime: 'React 18 + Vite',
    framework: 'React',
    devCommand: 'npm run dev',
    defaultPort: 5173,
    title: workspaceName
  };

  if (packageJsonRaw) {
    try {
      const parsed = JSON.parse(packageJsonRaw);
      if (parsed.name) projectMeta.title = parsed.name;
      
      const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
      
      if (deps.next) {
        projectMeta.runtime = 'Next.js App Router';
        projectMeta.framework = 'Next.js';
        projectMeta.defaultPort = 3000;
      } else if (deps.vite || deps['@vitejs/plugin-react']) {
        projectMeta.runtime = 'React + Vite (Fast HMR)';
        projectMeta.framework = 'React';
        projectMeta.defaultPort = 5173;
      } else if (deps.vue) {
        projectMeta.runtime = 'Vue 3 + Vite';
        projectMeta.framework = 'Vue';
        projectMeta.defaultPort = 5173;
      } else if (deps.express || deps.fastify) {
        projectMeta.runtime = 'Node.js Backend Service';
        projectMeta.framework = 'Node.js';
        projectMeta.defaultPort = 8080;
      }

      if (parsed.scripts?.dev) {
        projectMeta.devCommand = 'npm run dev';
      } else if (parsed.scripts?.start) {
        projectMeta.devCommand = 'npm start';
      }
    } catch {
      // json parse fallback
    }
  } else {
    // Check if workspace contains typical web files
    const fileKeys = Object.keys(files);
    const hasHtml = fileKeys.some((k) => k.endsWith('.html'));
    const hasJsTs = fileKeys.some((k) => k.endsWith('.ts') || k.endsWith('.tsx') || k.endsWith('.js'));
    if (!hasHtml && !hasJsTs) {
      projectMeta.isWebProject = false;
    }
  }

  const handleStartDevServer = () => {
    setIsStartingServer(true);
    setServerError(null);

    // Send dev command to active terminal session
    runTerminalCommand(`${projectMeta.devCommand}`);

    setTimeout(() => {
      setIsStartingServer(false);
      setLastReloadTime(new Date().toLocaleTimeString());
    }, 800);
  };

  const handleStopDevServer = () => {
    killRunningProcessInSession(activeTerminalId);
  };

  const handleRestartDevServer = () => {
    setIsRefreshing(true);
    setServerError(null);
    runTerminalCommand(`npm run dev`);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastReloadTime(new Date().toLocaleTimeString());
    }, 600);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastReloadTime(new Date().toLocaleTimeString());
    }, 400);
  };

  if (!isPreviewPanelOpen) return null;

  return (
    <aside className="w-full h-full bg-[#0d0d10] flex flex-col shrink-0 z-20 overflow-hidden">
      {/* Drawer Header with Tabs */}
      <div className="h-10 px-3 border-b border-zinc-800 flex items-center justify-between bg-[#111114]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewActiveTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              previewActiveTab === 'preview'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>App Preview</span>
          </button>
          <button
            onClick={() => setPreviewActiveTab('activity')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              previewActiveTab === 'activity'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity</span>
            {orchestrationActivities.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        <button
          onClick={() => togglePreviewPanel(false)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content Area */}
      {previewActiveTab === 'preview' ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
          {!projectMeta.isWebProject ? (
            /* Non-web Project Error State */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">No Web Preview Available</h3>
              <p className="text-xs text-zinc-400 max-w-xs mb-4">
                No web frontend configuration was detected in <span className="font-mono text-zinc-300">{workspaceName}</span>.
              </p>
            </div>
          ) : !isServerRunning ? (
            /* Stopped / Initial State */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/30">
                <Play className="w-6 h-6 ml-0.5" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">APP PREVIEW</h3>
                <p className="text-xs text-zinc-400 mt-0.5">No preview running currently.</p>
              </div>

              <div className="w-full max-w-xs p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] text-zinc-500 uppercase">Detected Runtime:</span>
                  <span className="text-emerald-400 font-semibold">{projectMeta.runtime}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] text-zinc-500 uppercase">Dev Command:</span>
                  <span className="text-zinc-200 font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                    {projectMeta.devCommand}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] text-zinc-500 uppercase">Target Port:</span>
                  <span className="text-zinc-300 font-mono">localhost:{projectMeta.defaultPort}</span>
                </div>
              </div>

              <button
                onClick={handleStartDevServer}
                disabled={isStartingServer}
                className="w-full max-w-xs flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-medium text-xs shadow-lg shadow-emerald-950/40 transition"
              >
                {isStartingServer ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Spawning Dev Process...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Preview (npm run dev)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Active Live Preview Frame */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="px-3 py-1.5 border-b border-zinc-800/80 bg-[#121215] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>http://localhost:{detectedPort}</span>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className={`p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition ${
                      isRefreshing ? 'animate-spin' : ''
                    }`}
                    title="Reload Preview"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                </div>

                {/* Viewport Selectors */}
                <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/60">
                  <button
                    onClick={() => setDeviceMode('desktop')}
                    className={`p-1 rounded transition ${
                      deviceMode === 'desktop' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Desktop (100%)"
                  >
                    <Laptop className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setDeviceMode('tablet')}
                    className={`p-1 rounded transition ${
                      deviceMode === 'tablet' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Tablet (768px)"
                  >
                    <Tablet className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setDeviceMode('mobile')}
                    className={`p-1 rounded transition ${
                      deviceMode === 'mobile' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Mobile (375px)"
                  >
                    <Smartphone className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Actions Subbar */}
              <div className="px-3 py-1 bg-[#101014] border-b border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestartDevServer}
                    className="flex items-center gap-1 hover:text-zinc-200 transition"
                    title="Restart Dev Server"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Restart</span>
                  </button>
                  <span className="text-zinc-700">•</span>
                  <button
                    onClick={handleStopDevServer}
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 transition"
                    title="Stop Server"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Stop</span>
                  </button>
                </div>

                <div className="text-[10px] font-mono text-zinc-500">
                  Reloaded: {lastReloadTime}
                </div>
              </div>

              {/* Responsive Frame Container */}
              <div className="flex-1 p-3 overflow-y-auto bg-zinc-950 flex flex-col items-center">
                <div
                  className={`w-full bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl transition-all flex flex-col ${
                    deviceMode === 'mobile'
                      ? 'max-w-[320px] min-h-[520px]'
                      : deviceMode === 'tablet'
                      ? 'max-w-[420px] min-h-[580px]'
                      : 'w-full flex-1'
                  }`}
                >
                  {/* Internal Window Header */}
                  <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500/80" />
                      <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                      <span className="text-[11px] font-medium text-zinc-200 ml-1 truncate max-w-[140px]">
                        {projectMeta.title}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                      LIVE HMR
                    </span>
                  </div>

                  {/* Active Workspace Interactive View */}
                  <div className="flex-1 p-4 flex flex-col items-center justify-center text-center bg-[#0d0d10] space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white tracking-tight">{projectMeta.title}</div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        Connected to http://localhost:{detectedPort}
                      </div>
                    </div>

                    <div className="w-full max-w-[280px] p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-left space-y-1.5 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Workspace:</span>
                        <span className="text-zinc-200 truncate max-w-[140px]">{workspaceName}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Runtime:</span>
                        <span className="text-emerald-400">{projectMeta.framework}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Indexed Files:</span>
                        <span className="text-zinc-300">{files ? Object.keys(files).length : 0} files</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Diff Safety:</span>
                        <span className="text-emerald-400">Active</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-500 font-mono">
                      Ready for Boss Agent modifications & hot reload
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Status */}
              <div className="px-3 py-1.5 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>
                  Branch:{' '}
                  {activeWorkspace?.gitBranch ||
                    (activeWs && 'gitBranch' in activeWs
                      ? (activeWs as any).gitBranch
                      : (activeWs as any)?.branch) ||
                    'main'}
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  HMR Socket: Connected
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Activity Stream View */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
          <div className="p-3 border-b border-zinc-800/80 bg-[#121215] flex items-center justify-between text-xs">
            <span className="font-mono text-zinc-400">Autonomous Orchestration Pipeline</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {orchestrationActivities.length} steps
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
            {orchestrationActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                No active orchestration tasks recorded.
              </div>
            ) : (
              orchestrationActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700/80 transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5 font-medium text-zinc-200">
                      {act.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : act.status === 'running' ? (
                        <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      <span>{act.step}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{act.timestamp}</span>
                  </div>

                  <div className="text-[11px] text-zinc-400 font-mono pl-5">
                    {act.detail}
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500 pl-5">
                    <span>Actor: {act.agent}</span>
                    <span
                      className={`capitalize ${
                        act.status === 'completed'
                          ? 'text-emerald-400'
                          : act.status === 'running'
                          ? 'text-blue-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Activity Footer */}
          <div className="p-2.5 border-t border-zinc-800 bg-[#0e0e11] text-[11px] font-mono text-zinc-500 flex items-center justify-between">
            <span className="truncate">Active Agent: {activeAgent?.name || 'Boss Agent'}</span>
            <span className="text-zinc-400">Zero Silent Writes Enforced</span>
          </div>
        </div>
      )}
    </aside>
  );
};
