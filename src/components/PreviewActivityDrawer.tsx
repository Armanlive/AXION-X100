import React, { useState } from 'react';
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
  Layers,
  Bot,
  Car,
  TrendingUp,
  PackageCheck,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const PreviewActivityDrawer: React.FC = () => {
  const {
    isPreviewPanelOpen,
    togglePreviewPanel,
    previewActiveTab,
    setPreviewActiveTab,
    orchestrationActivities,
    activeWorkspaceId,
    workspaces,
    activeModelId,
    models,
    isWorking,
    selectedAgentId,
    agents
  } = useAxionStore();

  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'sedan' | 'suv' | 'electric'>('all');

  if (!isPreviewPanelOpen) return null;

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeAgent = agents.find((a) => a.id === selectedAgentId);
  const activeModel = models.find((m) => m.id === activeModelId);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Mock vehicles data representing the active project "vehicle-stock-management"
  const mockVehicles = [
    { id: 'VIN-8921', make: 'Tesla', model: 'Model 3 Dual Motor', year: 2024, type: 'electric', price: '$42,990', status: 'In Stock', mileage: '12 mi' },
    { id: 'VIN-4412', make: 'Porsche', model: 'Taycan 4S', year: 2024, type: 'electric', price: '$118,500', status: 'Reserved', mileage: '450 mi' },
    { id: 'VIN-7731', make: 'BMW', model: 'M3 Competition xDrive', year: 2023, type: 'sedan', price: '$84,300', status: 'In Stock', mileage: '2,100 mi' },
    { id: 'VIN-5509', make: 'Audi', model: 'RS6 Avant', year: 2024, type: 'sedan', price: '$126,890', status: 'In Transit', mileage: '0 mi' },
    { id: 'VIN-9920', make: 'Land Rover', model: 'Defender 110 V8', year: 2024, type: 'suv', price: '$112,200', status: 'In Stock', mileage: '80 mi' },
    { id: 'VIN-3318', make: 'Mercedes-AMG', model: 'G 63', year: 2024, type: 'suv', price: '$189,900', status: 'Allocated', mileage: '5 mi' }
  ];

  const filteredVehicles = activeFilter === 'all'
    ? mockVehicles
    : mockVehicles.filter((v) => v.type === activeFilter);

  return (
    <aside className="w-80 lg:w-96 h-full bg-[#0d0d10] border-l border-zinc-800 flex flex-col shrink-0 z-20 animate-in slide-in-from-right-2 duration-200">
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
          {/* Preview Toolbar */}
          <div className="px-3 py-1.5 border-b border-zinc-800/80 bg-[#121215] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-zinc-400">
              <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                localhost:3000
              </span>
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

            {/* Viewport Modes */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1 rounded transition ${
                  deviceMode === 'desktop'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Desktop View"
              >
                <Laptop className="w-3 h-3" />
              </button>
              <button
                onClick={() => setDeviceMode('tablet')}
                className={`p-1 rounded transition ${
                  deviceMode === 'tablet'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Tablet View"
              >
                <Tablet className="w-3 h-3" />
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1 rounded transition ${
                  deviceMode === 'mobile'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Interactive Live Render Window */}
          <div className="flex-1 p-3 overflow-y-auto">
            <div className={`mx-auto bg-[#131316] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl transition-all ${
              deviceMode === 'mobile' ? 'max-w-[260px]' : deviceMode === 'tablet' ? 'max-w-[340px]' : 'w-full'
            }`}>
              {/* Simulated App Header */}
              <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-xs tracking-tight text-white">StockManager</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  Live
                </span>
              </div>

              {/* Metrics Strip */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900/40 border-b border-zinc-800/60 text-xs">
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Active Inventory</div>
                  <div className="text-sm font-bold text-white mt-0.5">24 Vehicles</div>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Total Value</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">$1.84M</div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="px-3 pt-2.5 flex items-center gap-1 overflow-x-auto text-[11px]">
                {(['all', 'electric', 'sedan', 'suv'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-2 py-0.5 rounded font-mono capitalize transition ${
                      activeFilter === filter
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Vehicle List */}
              <div className="p-3 space-y-2">
                {filteredVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white">{v.make} {v.model}</span>
                      <span className="font-mono font-bold text-emerald-400">{v.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1">
                      <span>{v.year} • {v.mileage}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                        v.status === 'In Stock'
                          ? 'bg-emerald-950/40 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Status */}
          <div className="px-3 py-1.5 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Branch: {activeWs?.branch || 'main'}</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Hot Reload Active
            </span>
          </div>
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
                    <span className={`capitalize ${
                      act.status === 'completed'
                        ? 'text-emerald-400'
                        : act.status === 'running'
                        ? 'text-blue-400'
                        : 'text-zinc-500'
                    }`}>
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
