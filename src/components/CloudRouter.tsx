import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Lock,
  CheckCircle2
} from 'lucide-react';

export const CloudRouter: React.FC = () => {
  const {
    models,
    activeModelId,
    simulateFailover,
    requestPaidModel
  } = useAxionStore();

  const freeModels = models.filter((m) => m.tier === 'free');
  const paidModels = models.filter((m) => m.tier !== 'free');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-400" />
            Zero-Cost Dynamic Model Router
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Strict Zero-Cost policy prioritizes free tier engines with instant rate-limit failovers.
          </p>
        </div>

        <button
          onClick={simulateFailover}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono transition"
          title="Simulate provider rate limit to verify automatic failover"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Test Failover
        </button>
      </div>

      {/* Free Tier Priority Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Free Tier Providers (Allowed)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active Priority
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-500">Incurred Billing: $0.00</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {freeModels.map((model) => {
            const isActive = model.id === activeModelId;
            return (
              <div
                key={model.id}
                className={`p-4 rounded-xl border relative transition ${
                  isActive
                    ? 'bg-[#151518] border-zinc-600 shadow-md ring-1 ring-zinc-700/50'
                    : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-zinc-100 text-zinc-900 text-[10px] font-mono font-bold rounded-full shadow-sm flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    PRIMARY ROUTE
                  </span>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-zinc-400 font-medium">
                    {model.provider}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      model.status === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400 animate-pulse'
                    }`}
                  >
                    ● {model.status.toUpperCase()}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-white mb-3">{model.name}</h4>

                <div className="space-y-1.5 text-xs font-mono text-zinc-400 pt-2 border-t border-zinc-800">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Billing:</span>
                    <span className="text-emerald-400 font-medium">{model.costPer1kTokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Context:</span>
                    <span className="text-zinc-300">{model.contextWindow}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Latency:</span>
                    <span className="text-zinc-300">{model.latencyMs}ms</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paid Auto-Block Section */}
      <div className="space-y-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Paid Models (Auto-Blocked by Default)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Firewall Active
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            Prohibits automatic billing. Requires explicit authorization.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {paidModels.map((model) => (
            <div
              key={model.id}
              className="p-4 rounded-xl border border-zinc-800 bg-[#121214] flex items-start justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <h4 className="text-xs font-semibold text-white">{model.name}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                    {model.provider}
                  </span>
                </div>
                <div className="text-xs font-mono text-zinc-500 mt-2 space-y-1">
                  <div>Estimated Billing: <span className="text-zinc-300">{model.costPer1kTokens}</span></div>
                  <div>Context Window: <span className="text-zinc-300">{model.contextWindow}</span></div>
                </div>
              </div>

              <button
                onClick={() => requestPaidModel(model.id)}
                className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 transition"
              >
                Request Access
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
