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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-[#2a3c5a] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-red-950/40 border-b border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Paid Model Firewall Intercept</h3>
              <p className="text-[11px] text-red-300">AXION Zero-Cost Policy Enforcement</p>
            </div>
          </div>
          <button
            onClick={closePaidModal}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-[#141e33] border border-[#233554] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Target Model:</span>
              <span className="font-bold text-white flex items-center gap-1">
                <Lock className="w-3 h-3 text-red-400" />
                {model?.name || 'Paid Model'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Provider:</span>
              <span className="text-slate-200">{model?.provider}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Estimated Cost:</span>
              <span className="text-amber-400 font-semibold">{model?.costPer1kTokens}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              By default, AXION-X100 routes only through free-tier providers (<span className="font-semibold text-white">Gemini 2.0 Flash, OpenRouter Free, Local Ollama</span>).
              Using a paid model incurs token billing. Proceed only if explicit paid access is desired.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-[#0c1322] border-t border-[#1d2c46] flex items-center justify-end gap-2.5">
          <button
            onClick={closePaidModal}
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Stay on Free Model
          </button>
          <button
            onClick={authorizePaidModelOnce}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/30 transition"
          >
            <Check className="w-3.5 h-3.5" />
            Authorize Paid Model Once
          </button>
        </div>
      </div>
    </div>
  );
};
