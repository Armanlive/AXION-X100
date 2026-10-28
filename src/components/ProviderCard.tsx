import { invoke, isTauri } from '@tauri-apps/api/core';
import registry from '../core/providers/catalog.json';
import React, { useEffect, useState } from 'react';
import type { CloudProvider, AIModel } from '../types';
import { supportedProviders } from '../utils/providerRouting';
import { KEY_CREATION_STEPS } from '../utils/cloudProvidersData';
import { ProviderCatalog } from './ProviderCatalog';
import { Key, Check, X, RefreshCw, ExternalLink, Eye, EyeOff, BookOpen, ShieldCheck, ChevronDown } from 'lucide-react';

/** Status badge — reflects store state instantly; "Connected & Verified" = saved + verified. */
export const StatusBadge: React.FC<{ status: string; supported: boolean; latencyMs?: number }> = ({ status, supported, latencyMs }) => {
  const isVerified = status.includes('Connected') || status === 'Connected & Verified';
  const isTesting = status.includes('Testing');
  const isError = status.includes('failed') || status.includes('error');

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border font-mono tracking-wide ${
        isVerified
          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
          : isTesting
          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 animate-pulse'
          : isError
          ? 'bg-rose-950/60 text-rose-400 border-rose-500/30'
          : supported
          ? 'bg-amber-950/60 text-amber-400 border-amber-500/30'
          : 'bg-zinc-900/60 text-zinc-400 border-zinc-700/30'
      }`}
    >
      {isVerified ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span>Connected &amp; Verified</span>
          {latencyMs ? <span className="text-emerald-500/80 font-normal">· {latencyMs}ms</span> : null}
        </>
      ) : isTesting ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>Verifying…</span>
        </>
      ) : (
        <>
          <span className={`w-1.5 h-1.5 rounded-full ${isError ? 'bg-rose-400' : 'bg-zinc-500'}`} />
          <span>{status}</span>
        </>
      )}
    </span>
  );
};

/** Card/header status text — "Connected & Verified" is permanent once verified. */
export const providerStatus = (p: CloudProvider): string =>
  p.isConnected || p.status === 'connected' || (p.configured && p.verifiedAt)
    ? 'Connected & Verified'
    : p.status === 'error'
    ? 'Verification failed · check key'
    : p.configured
    ? 'Configured · ready to test'
    : 'Disconnected · not configured';

const genericSteps = [
  'Open the official dashboard using the link in this tab.',
  'Sign in (or create) an account on the provider website.',
  'Create an API key and copy it.',
  'Paste it below and press Connect.',
];

const cardButton =
  'rounded-md border border-cyan-500/30 px-2 py-1 text-[11px] font-mono text-cyan-300 hover:bg-[#00f0ff]/10 hover:border-cyan-400 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed';
const inputBox =
  'w-full rounded-md bg-[#050508]/80 border border-cyan-500/30 px-2.5 py-1.5 text-xs text-cyan-100 placeholder-cyan-500/40 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/40 font-mono';

export interface ProviderCardProps {
  provider: CloudProvider;
  selected: boolean;
  testing: boolean;
  defaultModel?: AIModel;
  /** Paid providers only: whether their models may join automatic routing. */
  inPool?: boolean;
  onTogglePool?: (inPool: boolean) => void;
  onConnect: (apiKey: string, accountId: string, force: boolean) => Promise<void>;
  onTest: () => void;
  onRemove: () => void;
  onSelectModel: (model: AIModel) => void;
}

/** Short status for the compact tile; the full sentence stays in the tooltip. */
const compactStatus = (p: CloudProvider, testing: boolean) => {
  if (testing) return { label: 'Testing', dot: 'bg-cyan-400 animate-ping', text: 'text-cyan-300' };
  if (providerStatus(p).startsWith('Connected')) return { label: p.latencyMs ? `${p.latencyMs}ms` : 'Verified', dot: 'bg-emerald-400 shadow-[0_0_6px_#34d399]', text: 'text-emerald-400' };
  if (p.status === 'error') return { label: 'Error', dot: 'bg-rose-400', text: 'text-rose-400' };
  if (p.configured) return { label: 'Saved', dot: 'bg-amber-400', text: 'text-amber-300' };
  return { label: 'Not set', dot: 'bg-zinc-600', text: 'text-zinc-500' };
};

/** Compact bento tile: one-glance status and actions; setup details live in the expandable panel. */
export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  selected,
  testing,
  defaultModel,
  inPool,
  onTogglePool,
  onConnect,
  onTest,
  onRemove,
  onSelectModel,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'key' | 'how'>('key');
  const [key, setKey] = useState('');
  const [account, setAccount] = useState(() => (typeof provider.accountId === 'string' ? provider.accountId : ''));
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    setAccount(typeof provider.accountId === 'string' ? provider.accountId : '');
  }, [provider.accountId]);

  const supported = provider.type === 'fishaudio' || supportedProviders.includes(provider.type);
  const isConnected = provider.isConnected || provider.status === 'connected' || !!provider.verifiedAt;
  const isLocal = provider.type === 'ollama';
  const steps = KEY_CREATION_STEPS[provider.type] || genericSteps;
  const safeKey = typeof key === 'string' ? key : '';
  const safeAccount = typeof account === 'string' ? account : '';
  const status = compactStatus(provider, testing);
  const tierLabel = isLocal ? 'Local' : provider.tier === 'free' ? 'Free' : 'Paid';
  const panelId = `provider-panel-${provider.id}`;

  // Inline submit — guards keep the key/account state from ever hitting `.trim()` as undefined.
  const submit = async (force: boolean) => {
    if (!isLocal && !safeKey.trim() && !provider.configured) {
      setError('Enter an API key first, or open the official key page.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConnect(safeKey.trim(), safeAccount.trim(), force);
      setKey('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // Official external link — Tauri opens it natively, web falls back to the bundled dashboard URL.
  const openDashboard = async () => {
    setLinkError('');
    try {
      if (isTauri()) await invoke('open_provider_dashboard', { provider: provider.type });
      else {
        const url = registry.find((p) => p.id === provider.type)?.dashboard;
        if (!url) throw Error('Official dashboard unavailable');
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setLinkError(String(e));
    }
  };

  const segment = (id: 'key' | 'how', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-mono transition-all ${
        tab === id ? 'bg-cyan-500/20 border border-cyan-400/60 text-[#00f0ff] font-bold' : 'border border-transparent text-cyan-400/70 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <article
      className={`rounded-lg border p-2.5 flex flex-col gap-2 transition-colors ${
        selected
          ? 'border-cyan-400/80 bg-[#080d1a]/90 shadow-[0_0_14px_rgba(0,240,255,0.15)]'
          : 'border-cyan-500/20 bg-[#080d1a]/70 hover:border-cyan-400/40'
      }`}
    >
      {/* Header: identity + one-glance status; the description lives in the tooltip */}
      <div className="flex items-center gap-2 min-w-0" title={`${provider.name} — ${provider.description}\n${providerStatus(provider)}`}>
        <span className="text-lg leading-none shrink-0" aria-hidden="true">{provider.icon}</span>
        <h2 className="font-semibold text-[13px] font-mono text-white truncate flex-1 min-w-0">{provider.name}</h2>
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-mono uppercase tracking-wide border ${
            tierLabel === 'Free' ? 'border-emerald-500/30 text-emerald-300/80' : tierLabel === 'Local' ? 'border-violet-500/30 text-violet-300/80' : 'border-amber-500/30 text-amber-300/80'
          }`}
        >
          {tierLabel}
        </span>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-mono ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Primary actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {provider.configured && defaultModel && (
          <button type="button" onClick={() => onSelectModel(defaultModel)} disabled={selected} className={cardButton} title={`Route chat to ${defaultModel.name}`}>
            <Check size={11} className="inline mr-0.5" />
            {selected ? 'Active' : 'Use'}
          </button>
        )}
        {provider.configured && (
          <button type="button" onClick={onTest} disabled={testing} className={cardButton}>
            <RefreshCw size={11} className={`inline mr-0.5 ${testing ? 'animate-spin' : ''}`} />
            Test
          </button>
        )}
        {provider.configured && provider.tier === 'paid' && onTogglePool && supported && provider.type !== 'fishaudio' && (
          <label
            className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-200/80 cursor-pointer"
            title="Let automatic routing and failover use this paid provider. Requests are billed to your account."
          >
            <input type="checkbox" checked={!!inPool} onChange={(e) => onTogglePool(e.target.checked)} className="accent-amber-400" />
            In pool · billed
          </label>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={`${cardButton} ml-auto inline-flex items-center gap-0.5`}
        >
          {provider.configured ? 'Manage' : isLocal ? 'Set up' : 'Connect'}
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expandable setup panel */}
      {open && (
        <div id={panelId} className="space-y-2 border-t border-cyan-500/15 pt-2">
          <p className="text-[11px] text-cyan-200/60 leading-snug">{provider.description}</p>
          <div role="tablist" aria-label={`${provider.name} setup options`} className="flex gap-1 rounded-md border border-cyan-500/20 bg-[#050508]/60 p-0.5">
            {segment('key', isLocal ? 'Start local' : 'API key', <Key size={10} />)}
            {segment('how', 'How to get one', <BookOpen size={10} />)}
          </div>

          {tab === 'key' && (
            <div role="tabpanel" className="space-y-2">
              {!isLocal && (
                <div className="relative">
                  <input
                    type={reveal ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={safeKey}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={provider.configured ? 'Leave blank to keep saved key' : provider.type === 'fishaudio' ? 'sk-fish-…' : 'Paste your API key'}
                    aria-label={`${provider.name} API key`}
                    className={`${inputBox} pr-8`}
                  />
                  <button
                    type="button"
                    aria-label={reveal ? 'Hide API key' : 'Show API key'}
                    onClick={() => setReveal((r) => !r)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-cyan-400/70 hover:text-[#00f0ff]"
                  >
                    {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              )}
              {provider.type === 'cloudflare' && (
                <input
                  value={safeAccount}
                  onChange={(e) => setAccount(e.target.value)}
                  pattern="[a-fA-F0-9]{32}"
                  aria-label="Cloudflare account ID"
                  placeholder="32-character account ID"
                  className={inputBox}
                />
              )}
              {isLocal && <p className="text-[11px] text-cyan-200/60">Local Ollama at 127.0.0.1:11434 — nothing leaves this computer.</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void submit(false)}
                  disabled={busy || (!isLocal && !safeKey.trim() && !provider.configured)}
                  className="rounded-md bg-cyan-900 px-2 py-1 text-[11px] font-mono text-white hover:bg-cyan-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  <Check size={11} />
                  {busy ? 'Saving…' : 'Connect'}
                </button>
                {!isConnected && (safeKey.trim() || provider.configured) && (
                  <button
                    type="button"
                    onClick={() => void submit(true)}
                    disabled={busy}
                    title="Skip the live probe: save to the encrypted vault and mark Connected & Verified. Use when verification fails on network, quota or endpoint errors even though the key is valid."
                    className="rounded-md border border-dashed border-amber-500/50 px-2 py-1 text-[11px] font-mono text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    <ShieldCheck size={11} className="inline mr-0.5" />
                    Force save
                  </button>
                )}
                <button type="button" onClick={() => setLinkOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-mono text-[#00f0ff] hover:underline">
                  <ExternalLink size={10} />
                  {isLocal ? 'Download' : 'Key page'}
                </button>
              </div>
              {error && <p role="alert" className="text-[11px] text-amber-300 break-words">{error}</p>}
            </div>
          )}

          {tab === 'how' && (
            <ol role="tabpanel" className="space-y-1 list-decimal list-inside text-[11px] text-cyan-200/70 marker:text-[#00f0ff] marker:font-mono">
              {steps.map((step, i) => (
                <li key={i} className="leading-snug">{step}</li>
              ))}
            </ol>
          )}

          <ProviderCatalog provider={provider} />

          {provider.pingResult && <p role="status" className="text-[10px] break-words text-cyan-200/60 font-mono">{provider.pingResult}</p>}
          {provider.configured && (
            <button type="button" onClick={onRemove} className={`${cardButton} border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:border-rose-400`}>
              <X size={11} className="inline mr-0.5" />
              Remove key
            </button>
          )}
        </div>
      )}

      {/* Official external link — warning modal */}
      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLinkOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={`Open official ${provider.name} page`}
            className="relative w-[min(94vw,420px)] rounded-2xl border border-amber-500/40 bg-zinc-900 p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm font-mono">
              <ExternalLink size={16} />
              Leave AXION?
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">
              This opens the official{' '}
              <strong className="text-zinc-100">{provider.name}</strong> {isLocal ? 'download' : 'API-key'} page in your
              browser ({isLocal ? 'ollama.com' : 'the provider’s own domain'}). AXION never creates keys for you — copy
              the key there, come back, and paste it into this card. The key is stored only in your OS-encrypted vault.
            </p>
            {linkError && <p role="alert" className="mt-2 text-xs text-rose-400">{linkError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkOpen(false);
                  void openDashboard();
                }}
                className="rounded-lg bg-cyan-900 px-3 py-2 text-xs text-white hover:bg-cyan-800 inline-flex items-center gap-1.5"
              >
                <ExternalLink size={12} />
                Open official page
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
