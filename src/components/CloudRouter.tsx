import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Zap,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle
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
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1c2940]">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            Free-Only Boss Agent & Dynamic AI Router
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict Zero-Cost policy prioritizes free tier engines with instant rate-limit failovers.
          </p>
        </div>

        <button
          onClick={simulateFailover}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition"
          title="Simulate provider rate limit to verify automatic failover"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Simulate Rate Limit Failover
        </button>
      </div>

      {/* Free Tier Priority Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
              1. Zero-Cost Free Tier Providers (Allowed)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Active Priority
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Total Incurred: $0.00</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {freeModels.map((model) => {
            const isActive = model.id === activeModelId;
            return (
              <div
                key={model.id}
                className={`p-4 rounded-xl border relative transition ${
                  isActive
                    ? 'bg-blue-950/30 border-blue-500/60 shadow-lg ring-1 ring-blue-500/30'
                    : 'bg-[#0f172a] border-[#1d2d47] hover:border-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-mono font-bold rounded-full shadow-sm flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    PRIMARY ROUTE
                  </span>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {model.provider}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      model.status === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                    }`}
                  >
                    ● {model.status.toUpperCase()}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white mb-2">{model.name}</h4>

                <div className="space-y-1.5 text-xs font-mono text-slate-300 pt-2 border-t border-[#1a2840]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Billing:</span>
                    <span className="text-emerald-400 font-semibold">{model.costPer1kTokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Context Window:</span>
                    <span>{model.contextWindow}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency:</span>
                    <span>{model.latencyMs}ms</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paid Auto-Block Section */}
      <div className="space-y-3 pt-4 border-t border-[#1c2940]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-red-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              2. Paid Models (Auto-Blocked by Default)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
              Firewall Active
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Prohibits automatic billing. Requires explicit user authorization dialog.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paidModels.map((model) => (
            <div
              key={model.id}
              className="p-4 rounded-xl border border-red-900/30 bg-red-950/10 flex items-start justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  <h4 className="text-sm font-bold text-white">{model.name}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-300">
                    {model.provider}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Rate: <span className="text-amber-400 font-mono">{model.costPer1kTokens}</span>. Blocked by AXION core policy.
                </p>
              </div>

              <button
                onClick={() => requestPaidModel(model.id)}
                className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-semibold whitespace-nowrap transition"
              >
                Request Override
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Failover Logic Guide Card */}
      <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e2e4a] text-xs text-slate-300 space-y-2">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Autonomous Failover Protocol
        </h4>
        <p className="leading-relaxed text-slate-400">
          When the primary zero-cost engine (<strong className="text-white">Google Gemini 2.0 Flash</strong>) reaches provider rate limits (HTTP 429), the Boss Agent immediately redirects the AST decomposition to <strong className="text-white">Meta Llama 3.3 70B (OpenRouter Free)</strong> or <strong className="text-white">Qwen 2.5 Coder 14B (Local Ollama)</strong> without disrupting the developer workflow or billing credit cards.
        </p>
      </div>
    </div>
  );
};
