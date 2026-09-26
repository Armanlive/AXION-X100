import React from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { ShieldAlert, AlertTriangle, X, Check, Lock } from 'lucide-react';

export const PaidModelModal: React.FC = () => {
  const {
    isPaidOverrideModalOpen,
    pendingPaidModelId,
    models,
    closePaidModal,
    authorizePaidModelOnce
  } = useAxionStore();

  if (!isPaidOverrideModalOpen) return null;

  const model = models.find((m) => m.id === pendingPaidModelId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-white">Paid Model Firewall Intercept</h3>
              <p className="text-[11px] text-zinc-400">AXION Zero-Cost Policy Enforcement</p>
            </div>
          </div>
          <button
            onClick={closePaidModal}
            className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5">
          <div className="p-3 rounded-lg bg-[#0e0e11] border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-500">Target Model:</span>
              <span className="font-medium text-white flex items-center gap-1">
                <Lock className="w-3 h-3 text-rose-400" />
                {model?.name || 'Paid Model'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-500">Provider:</span>
              <span className="text-zinc-300">{model?.provider}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-500">Billing:</span>
              <span className="text-amber-400 font-medium">{model?.costPer1kTokens}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              By default, AXION-X100 routes only through free-tier providers (<span className="text-white font-medium">Gemini 2.0 Flash, OpenRouter Free, Local Ollama</span>).
              Authorizing this model incurs token billing. Proceed only if desired.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 bg-[#101013] border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            onClick={closePaidModal}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
          >
            Stay on Free Model
          </button>
          <button
            onClick={authorizePaidModelOnce}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Check className="w-3.5 h-3.5" />
            Authorize Paid Model Once
          </button>
        </div>
      </div>
    </div>
  );
};
