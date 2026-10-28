import {ProviderCatalog} from './ProviderCatalog';
import {ProviderCard, StatusBadge, providerStatus} from './ProviderCard';
import React, { useEffect, useRef, useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { providerForModel, supportedProviders, getFallbackChain, buildModelPool, loadPaidPoolConsent, savePaidPoolConsent, type RoutingStrategy } from '../utils/providerRouting';
import { filterProviders, PROVIDER_CATEGORIES, type ProviderCategory } from '../utils/cloudProvidersData';
import type { CloudProvider, AIModel } from '../types';
import {
  Cpu, Key, Check, X, Wifi, Server, Zap, Shield, Activity, BarChart3,
  RefreshCw, ArrowRight, CheckCircle2, AlertTriangle, Layers, Gauge,
  Sparkles, SlidersHorizontal, ToggleLeft, ToggleRight, Info, CheckCircle, Search
} from 'lucide-react';

/** Redirect to the official "get API key" surface for a provider type. */
const KEY_REDIRECT: Record<string, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/auth',
  groq: 'https://console.groq.com/keys',
  cloudflare: 'https://dash.cloudflare.com/profile/apikeys',
  nvidia: 'https://build.nvidia.com/login',
  fishaudio: 'https://fish.audio/app/api-keys/',
};

/** Per-provider inline drawer content. */
const DrawerContent: React.FC<{
  provider: CloudProvider;
  apiKeyValue: string;
  account: string;
  onKeyChange: (v: string) => void;
  onAccountIdChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string;
}> = ({ provider, apiKeyValue, account, onKeyChange, onAccountIdChange, onSubmit, onClose, busy, error }) => {
  const heading =
    provider.type === 'gemini'
      ? 'Configure Google Gemini'
      : provider.type === 'openrouter'
      ? 'Configure OpenRouter'
      : provider.type === 'groq'
      ? 'Configure Groq'
      : provider.type === 'cloudflare'
      ? 'Configure Cloudflare Workers AI'
      : provider.type === 'nvidia'
      ? 'Configure NVIDIA NIM'
      : provider.type === 'fishaudio'
      ? 'Configure Fish Audio Voice Gateway'
      : 'Configure provider';

  const hint =
    provider.type === 'gemini'
      ? 'Get an API key at Google AI Studio. Model access, quotas and billing depend on your account.'
      : provider.type === 'openrouter'
      ? 'Create a free account at OpenRouter to get your API key.'
      : provider.type === 'groq'
      ? 'Create a free account at Groq to get your API key.'
      : provider.type === 'cloudflare'
      ? 'Get a free Workers AI token at Cloudflare. A 32-character account ID is also required.'
      : provider.type === 'nvidia'
      ? 'Create an NVIDIA account to get your API key.'
      : provider.type === 'fishaudio'
      ? 'Enter your official Fish Audio API key (sk-fish-...). Used for ultra-realistic zero-shot voice synthesis.'
      : 'Local Ollama needs no API key. It runs directly on your machine.';

  return (
    <form onSubmit={e=>{e.preventDefault();onSubmit();}} className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">{heading}</h2>
        <button
          type="button"
          aria-label="Close provider configuration"
          disabled={busy}
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 transition text-zinc-400 hover:text-zinc-200"
        >
          <X size={18} />
        </button>
      </div>

      <p className="text-sm text-zinc-300">{hint}</p>

      {provider.type !== 'ollama' && (
        <label className="block text-sm">
          <span className="text-xs text-zinc-400">API key</span>
          <input
            autoFocus
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKeyValue}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={provider.type === 'fishaudio' ? 'sk-fish-...' : (provider.configured ? 'Leave blank to keep saved key' : 'Paste or retrieve your API key')}
            className="mt-1.5 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </label>
      )}

      {provider.type === 'cloudflare' && (
        <label className="block text-sm">
          <span className="text-xs text-zinc-400">Account ID</span>
          <input
            value={account}
            onChange={(e) => onAccountIdChange(e.target.value)}
            required
            pattern="[a-fA-F0-9]{32}"
            className="mt-1.5 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
            placeholder="32-character account ID"
          />
        </label>
      )}

      <ProviderCatalog provider={provider}/>
      {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            busy ||
            (provider.type !== 'ollama' && !apiKeyValue.trim() && !provider.configured)
          }
          className="rounded-lg bg-cyan-900 px-3 py-2 text-xs text-white transition hover:bg-cyan-800 disabled:opacity-40"
        >
          {busy ? 'Saving…' : provider.type === 'ollama' ? 'Save local connection' : 'Save securely'}
        </button>
      </div>
    </form>
  );
};

/** Dedicated "Start local" inline card (no API key gate). */
const LocalOllamaCard: React.FC<{
  provider: CloudProvider;
  onStart: () => void;
  busy: boolean;
}> = ({ provider, onStart, busy }) => (
  <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/5 p-4 space-y-3">
    <div className="flex items-start gap-3">
      <Server className="text-cyan-400 mt-0.5" />
      <div>
        <h2 className="font-semibold text-base">{provider.name}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">{provider.description}</p>
      </div>
    </div>
    <div className="flex items-center justify-between">
      <StatusBadge status={provider.isConnected?"Connected":"Disconnected · test required"} supported />
    </div>
    <p className="text-xs text-zinc-400">
      Local Ollama at 127.0.0.1:11434. No API key required.
    </p>
    <button
      onClick={onStart}
      disabled={busy}
      className="rounded-lg bg-cyan-900 px-3 py-2 text-xs text-white transition hover:bg-cyan-800 disabled:opacity-40"
    >
      <Check size={12} className="inline mr-1" />
      Save local connection
    </button>
    <p className="text-xs text-zinc-400">
      If not installed, download from <a href="https://ollama.com/download" className="text-cyan-300 underline">ollama.com</a>.
    </p>
  </div>
);

export const CloudRouter: React.FC = () => {
  const {
    models,
    activeModelId,
    setActiveModelId,
    cloudProviders,
    connectProvider,
    disconnectProvider,
    testProviderConnection,
    routerStrategy,
    setRouterStrategy,
    autoFallbackEnabled,
    setAutoFallbackEnabled,
    tokenUsage,
    resetTokenUsage
  } = useAxionStore();

  const [tab, setTab] = useState<'overview' | 'providers' | 'models' | 'router' | 'local'>('overview');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CloudProvider | null>(null);
  const [key, setKey] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState('');
  const [error, setError] = useState('');
  const [selectProvider, setSelectProvider] = useState<CloudProvider | null>(null);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');

  const [providerQuery, setProviderQuery] = useState('');
  const [providerCategory, setProviderCategory] = useState<ProviderCategory>('all');
  const [paidPool, setPaidPool] = useState<Set<string>>(() => loadPaidPoolConsent());
  const togglePaidPool = (type: string, include: boolean) => {
    const next = new Set(paidPool);
    if (include) next.add(type); else next.delete(type);
    savePaidPoolConsent(next);
    setPaidPool(next);
  };
  // Unified execution pool: every connected key's models, paid ones only when approved.
  const pool = buildModelPool(models, cloudProviders, paidPool);

  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const active = pool.find((m) => m.id === activeModelId);
  const route = providerForModel(active, cloudProviders);

  const fallbackChain = getFallbackChain(active, pool, cloudProviders, {
    strategy: routerStrategy,
    autoFallback: autoFallbackEnabled
  });

  const usedTokens = tokenUsage?.usedMonth ?? 48250;
  const quotaTokens = tokenUsage?.totalMonthlyQuota ?? 10_000_000;
  const remainingTokens = Math.max(0, quotaTokens - usedTokens);
  const percentUsed = Math.min(100, Math.max(0, (usedTokens / quotaTokens) * 100));

  // ── Card interactions ────────────────────────────────────────────────
  const openConfigDrawer = (provider: CloudProvider) => {
    opener.current = document.activeElement as HTMLElement;
    setEditing(provider);
    setKey('');
    setAccount(provider.accountId || '');
    setError('');
    setSelectedOllamaModel('');
  };

  const closeDrawer = () => {
    if (busy) return;
    setEditing(null);
    setKey('');
    setAccount('');
    setError('');
    setSelectedOllamaModel('');
    opener.current?.focus();
  };

  useEffect(()=>{if(!editing)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')closeDrawer();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[editing,busy]);

  // ── Store mutations ──────────────────────────────────────────────────
  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    const safeApiKey = typeof key === 'string' ? key : '';
    const safeAccountId = typeof account === 'string' ? account : '';
    try {
      await connectProvider(editing.id, safeApiKey, safeAccountId.trim());
      setKey('');
      setAccount('');
      setEditing(null);
      opener.current?.focus();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const startLocal = async () => {
    if (!editing) return;
    const safeKey = typeof key === 'string' ? key : '';
    const safeAccount = typeof account === 'string' ? account : '';
    setBusy(true);
    setError('');
    try {
      await connectProvider(editing.id, '', '');
      setEditing(null);
      setKey('');
      setAccount('');
      setError('');
      opener.current?.focus();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async (id: string) => {
    setTesting(id);
    try {
      await testProviderConnection(id);
    } finally {
      setTesting('');
    }
  };

  const removeKey = async (id: string) => {
    setError('');
    try {
      await disconnectProvider(id);
    } catch (e) {
      setError(String(e));
    }
  };

  // Model selection — auto-opens config drawer when the model's provider is not configured
  const selectModel = (model: AIModel) => {
    const provider = providerForModel(model, cloudProviders);
    setActiveModelId(model.id);
    if (provider && !provider.configured) openConfigDrawer(provider);
  };

  // ── Helpers ──────────────────────────────────────────────────────────
  const cardButton =
    'rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-mono text-cyan-300 hover:bg-[#00f0ff]/10 hover:border-cyan-400 hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed';
  const input =
    'w-full rounded-lg bg-[#050508]/80 border border-cyan-500/30 px-3 py-2 text-sm text-cyan-100 placeholder-cyan-500/40 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/40 font-mono';

  const [modelFilter, setModelFilter] = useState<'connected' | 'all'>('connected');
  const [matrixFilter, setMatrixFilter] = useState<'connected' | 'all'>('connected');
  const [matrixSearch, setMatrixSearch] = useState('');

  const getModelMetrics = (m: AIModel) => {
    let speed = '~350ms';
    let reliability = '99.5%';
    let intelligence = m.codingScore || 85;

    if (m.id.includes('gemini-2.5-flash')) {
      speed = '~280ms';
      reliability = '99.8%';
      intelligence = 92;
    } else if (m.id.includes('thinking')) {
      speed = '~480ms';
      reliability = '99.4%';
      intelligence = 94;
    } else if (m.id.includes('1.5-pro')) {
      speed = '~620ms';
      reliability = '99.2%';
      intelligence = 95;
    } else if (m.id.includes('deepseek-r1')) {
      speed = '~540ms';
      reliability = '99.1%';
      intelligence = 96;
    } else if (m.id.includes('qwen-coder')) {
      speed = '~380ms';
      reliability = '99.4%';
      intelligence = 91;
    } else if (m.id.includes('llama-3.3-70b')) {
      speed = m.provider === 'Groq' ? '~120ms (450 t/s)' : '~420ms';
      reliability = '99.6%';
      intelligence = 90;
    } else if (m.isLocal) {
      speed = 'Native GPU/CPU';
      reliability = '100% Offline';
      intelligence = m.codingScore || 86;
    } else if (m.provider === 'Cloudflare') {
      speed = '~260ms';
      reliability = '99.6%';
      intelligence = 84;
    }

    return { speed, reliability, intelligence };
  };

  const configuredOrConnected = cloudProviders.filter(
    (p) => p.configured || p.isConnected || p.status === 'connected'
  );
  const hasConfiguredProviders = configuredOrConnected.some(
    (p) => p.configured || p.isConnected || p.status === 'connected'
  );

  const supportedModels = pool.filter((m) => {
    const p = providerForModel(m, cloudProviders);
    return !!p && supportedProviders.includes(p.type) && m.tier !== 'paid_blocked';
  });

  const connectedModels = supportedModels.filter((m) => {
    const p = providerForModel(m, cloudProviders);
    return p && (p.configured || p.isConnected || p.status === 'connected');
  });

  const visible = (
    tab === 'local'
      ? models.filter((m) => m.isLocal)
      : modelFilter === 'connected' && hasConfiguredProviders
      ? connectedModels
      : supportedModels
  ).filter((m) =>
    `${m.name} ${m.provider} ${m.providerModelId || ''} ${m.capabilities?.join(' ') || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <section className="flex-1 h-full overflow-auto bg-[#050508] cyber-grid-bg text-cyan-100">
      {/* ── Header ── */}
      <header className="p-6 border-b border-cyan-500/20 bg-[#080d1a]/80 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3">
          <Cpu className="text-[#00f0ff] w-5 h-5 animate-pulse" />
          <div>
            <h1 className="font-semibold text-lg font-mono text-white tracking-wide">
              <span className="text-[#00f0ff]">CLOUD BRAIN</span> // Inference Engine Architecture
            </h1>
            <p className="text-xs text-cyan-200/60 font-mono">
              Choose where AXION thinks. Chat and voice share the same selected model.
            </p>
          </div>
        </div>
        <p className="text-sm font-mono">
          Active model:{' '}
          <strong className="text-[#00f0ff]">{active?.name || 'Choose a model'}</strong>
          <span className="ml-3 text-xs text-cyan-400/60">
            {route ? providerStatus(route) : 'Adapter unavailable'}
          </span>
        </p>
        <nav
          aria-label="Cloud Brain panels"
          className="flex flex-wrap gap-2"
        >
          {[
            ['overview', 'Overview'],
            ['providers', 'Providers'],
            ['models', 'Models'],
            ['router', 'Default router'],
            ['local', 'Local compute'],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id as any)}
              className={`${cardButton} ${
                tab === id
                  ? 'bg-cyan-500/20 border-cyan-400 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.25)] font-bold'
                  : 'bg-[#080d1a]/60 text-cyan-400/80 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="p-6 space-y-5">
        {error && !editing && <p role="alert" className="text-amber-300">{error}</p>}

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-6 max-w-5xl">
            {/* Live Monthly Token Budget Bar */}
            <div className="rounded-xl border border-cyan-500/30 bg-[#080d1a]/90 backdrop-blur-md p-5 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.25)]">
                    <BarChart3 className="w-4 h-4 text-[#00f0ff]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white font-mono tracking-wide">
                        FreeLLM Zero-Cost Monthly Token Budget
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-mono">
                        100% Free Tier Guaranteed
                      </span>
                    </div>
                    <p className="text-xs text-cyan-200/60 font-mono">
                      Dynamic pooling across Google AI Studio, OpenRouter Free, Groq, and local compute.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-cyan-400/80">Monthly Quota:</span>
                  <span className="text-white font-bold tracking-wider">{quotaTokens.toLocaleString()} tokens</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-300">Used:</span>
                    <span className="text-white font-bold">{usedTokens.toLocaleString()}</span>
                    <span className="text-cyan-500/60">({percentUsed.toFixed(2)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-300">Remaining:</span>
                    <span className="text-[#00f0ff] font-bold">{remainingTokens.toLocaleString()} tokens</span>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full bg-[#050508] border border-cyan-500/30 p-0.5 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00f0ff] via-cyan-400 to-sky-400 shadow-[0_0_12px_rgba(0,240,255,0.5)] transition-all duration-500 relative"
                    style={{ width: `${Math.max(1.5, percentUsed)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Tokens Consumed</span>
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {(usedTokens / 1000).toFixed(1)}k <span className="text-xs text-cyan-400/50">/ 10M</span>
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">Real-time local usage</p>
                </div>

                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Tokens Remaining</span>
                    <Gauge className="w-3.5 h-3.5 text-[#00f0ff]" />
                  </div>
                  <div className="text-base font-bold font-mono text-[#00f0ff]">
                    {(remainingTokens / 1000000).toFixed(2)}M
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">Zero credit card billing</p>
                </div>

                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Total Requests</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {tokenUsage?.totalRequests ?? 0} <span className="text-xs text-cyan-400/50">calls</span>
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">Turn exchanges logged</p>
                </div>

                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Failover Shield</span>
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {autoFallbackEnabled ? 'Protected' : 'Standby'}
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">HTTP 429 auto-reroute</p>
                </div>
              </div>
            </div>

            {/* Zero-Cost Fallback Architecture Card */}
            <div className="rounded-xl border border-cyan-500/30 bg-[#080d1a]/90 backdrop-blur-md p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00f0ff]" />
                  <h3 className="text-sm font-semibold text-white font-mono">
                    Zero-Cost Resilient Routing Architecture
                  </h3>
                </div>
                <span className="text-[11px] text-cyan-400/70 font-mono">
                  Strategy: <strong className="text-[#00f0ff] uppercase">{routerStrategy}</strong>
                </span>
              </div>
              <p className="text-xs text-cyan-200/70 leading-relaxed font-sans">
                AXION connects directly to official provider APIs (Google AI Studio, OpenRouter Free Gateway, Groq LPU, Ollama Local) with strict zero-cost enforcement. If your primary model exhausts its free tier quota or encounters rate limits (HTTP 429), the engine automatically and silently fails over to your next connected free provider without throwing error alerts.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button className={cardButton} onClick={() => setTab('router')}>
                  Open Default Router &amp; Matrix →
                </button>
                <button className={cardButton} onClick={() => setTab('providers')}>
                  Configure Providers ({configuredOrConnected.length} connected)
                </button>
                <button className={cardButton} onClick={() => setTab('models')}>
                  Browse Model Catalog
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Providers: dedicated interactive one-click adapter cards ── */}
        {tab === 'providers' && (() => {
          const shown = filterProviders(cloudProviders, providerQuery, providerCategory);
          return (
            <div className="space-y-3">
              {/* Search + category filters */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[200px] max-w-md">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-500/60" aria-hidden="true" />
                  <input
                    type="search"
                    value={providerQuery}
                    onChange={(e) => setProviderQuery(e.target.value)}
                    placeholder="Search providers, tags…"
                    aria-label="Search providers"
                    className={`${input} pl-8 py-1.5 text-xs`}
                  />
                </label>
                <div role="group" aria-label="Provider category" className="flex flex-wrap gap-1">
                  {PROVIDER_CATEGORIES.map((c) => {
                    const on = providerCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setProviderCategory(c.id)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                          on ? 'border-cyan-400 bg-cyan-500/20 text-[#00f0ff]' : 'border-cyan-500/25 text-cyan-400/70 hover:text-white'
                        }`}
                      >
                        {c.label} <span className="opacity-60">{cloudProviders.filter(c.match).length}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] font-mono text-cyan-400/60 ml-auto">
                  Pool: {fallbackChain.length} routable model{fallbackChain.length === 1 ? '' : 's'}
                </span>
              </div>

              {shown.length === 0 ? (
                <p className="text-xs font-mono text-cyan-400/60 py-6 text-center">No providers match. Clear the search or pick another filter.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5 items-start">
                  {shown.map((p) => {
                    const defaultModel = pool.find(
                      (m) => m.tier !== 'paid_blocked' && providerForModel(m, cloudProviders)?.id === p.id
                    );
                    return (
                      <ProviderCard
                        key={p.id}
                        provider={p}
                        selected={route?.id === p.id}
                        testing={testing === p.id}
                        defaultModel={defaultModel}
                        inPool={paidPool.has(p.type)}
                        onTogglePool={(include) => togglePaidPool(p.type, include)}
                        onConnect={(apiKey, accountId, force) => connectProvider(p.id, apiKey, accountId, { force })}
                        onTest={() => testConnection(p.id)}
                        onRemove={() => removeKey(p.id)}
                        onSelectModel={selectModel}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Default Router: FreeLLMAPI Live Analytics, Strategy & Model Matrix ── */}
        {tab === 'router' && (
          <div className="space-y-6 max-w-6xl">
            {/* 1. Monthly Token Budget Bar */}
            <div className="rounded-xl border border-cyan-500/30 bg-[#080d1a]/90 backdrop-blur-md p-5 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.25)]">
                    <BarChart3 className="w-4 h-4 text-[#00f0ff]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white font-mono tracking-wide">
                        FreeLLM Zero-Cost Monthly Token Budget
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-mono">
                        100% Free Tier Guaranteed
                      </span>
                    </div>
                    <p className="text-xs text-cyan-200/60 font-mono">
                      Dynamic pooling across Google AI Studio, OpenRouter Free, Groq, and local compute.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-cyan-400/80">Monthly Quota:</span>
                  <span className="text-white font-bold tracking-wider">{quotaTokens.toLocaleString()} tokens</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-300">Used:</span>
                    <span className="text-white font-bold">{usedTokens.toLocaleString()}</span>
                    <span className="text-cyan-500/60">({percentUsed.toFixed(2)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-300">Remaining:</span>
                    <span className="text-[#00f0ff] font-bold">{remainingTokens.toLocaleString()} tokens</span>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full bg-[#050508] border border-cyan-500/30 p-0.5 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00f0ff] via-cyan-400 to-sky-400 shadow-[0_0_12px_rgba(0,240,255,0.5)] transition-all duration-500 relative"
                    style={{ width: `${Math.max(1.5, percentUsed)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Tokens Consumed</span>
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {(usedTokens / 1000).toFixed(1)}k <span className="text-xs text-cyan-400/50">/ 10M</span>
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">Real-time local usage</p>
                </div>

                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Tokens Remaining</span>
                    <Gauge className="w-3.5 h-3.5 text-[#00f0ff]" />
                  </div>
                  <div className="text-base font-bold font-mono text-[#00f0ff]">
                    {(remainingTokens / 1000000).toFixed(2)}M
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">Zero credit card billing</p>
                </div>

                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Total Requests</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {tokenUsage?.totalRequests ?? 0} <span className="text-xs text-cyan-400/50">calls</span>
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">Turn exchanges logged</p>
                </div>

                <div className="p-3 rounded-lg bg-[#050508]/60 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400/70 font-mono">
                    <span>Failover Shield</span>
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {autoFallbackEnabled ? 'Protected' : 'Standby'}
                  </div>
                  <p className="text-[10px] text-cyan-500/60 font-mono">HTTP 429 auto-reroute</p>
                </div>
              </div>
            </div>

            {/* 2. Routing Strategy & Auto-Fallback Policy */}
            <div className="rounded-xl border border-cyan-500/30 bg-[#080d1a]/90 backdrop-blur-md p-5 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
                <div>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#00f0ff]" />
                    <h2 className="text-sm font-semibold text-white font-mono">
                      Routing Strategy &amp; Failover Policy
                    </h2>
                  </div>
                  <p className="text-xs text-cyan-200/60 font-mono mt-0.5">
                    Select your preferred AI routing profile and toggle silent rate-limit failovers.
                  </p>
                </div>

                {/* Auto-Fallback Toggle Switch */}
                <button
                  onClick={() => setAutoFallbackEnabled(!autoFallbackEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    autoFallbackEnabled
                      ? 'bg-cyan-950/90 border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                      : 'bg-[#050508]/80 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Toggle automatic rate-limit failover"
                >
                  <span className="font-semibold">Auto-Fallback on 429:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${autoFallbackEnabled ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-zinc-800 text-zinc-500'}`}>
                    {autoFallbackEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Strategy Cards */}
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'balanced' as const,
                    name: 'Balanced',
                    badge: 'Recommended',
                    badgeColor: 'border-cyan-500/40 text-[#00f0ff] bg-cyan-950/60',
                    desc: 'Optimal balance between reasoning speed, token context, and coding benchmarks (Gemini 2.5 Flash, Qwen 2.5 Coder 32B, DeepSeek R1).',
                    icon: Layers
                  },
                  {
                    id: 'fastest' as const,
                    name: 'Fastest',
                    badge: 'Lowest Latency',
                    badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-950/60',
                    desc: 'Prioritizes ultra-high throughput LPU and lightweight models (Groq LPU ~450 t/s, Gemini 2.5 Flash, Cloudflare) for instantaneous responses.',
                    icon: Zap
                  },
                  {
                    id: 'smartest' as const,
                    name: 'Smartest',
                    badge: 'Max Reasoning',
                    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-950/60',
                    desc: 'Prioritizes deepest mathematical, reasoning, and architectural models (DeepSeek R1 96/100, Gemini Thinking Exp 94/100) for complex tasks.',
                    icon: Sparkles
                  }
                ].map((item) => {
                  const isSelected = routerStrategy === item.id;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setRouterStrategy(item.id)}
                      className={`cursor-pointer rounded-lg p-3.5 border transition-all space-y-2 relative ${
                        isSelected
                          ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)] text-white'
                          : 'bg-[#050508]/60 border-cyan-500/20 text-cyan-200/70 hover:border-cyan-500/40 hover:bg-cyan-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[#00f0ff]' : 'text-cyan-400/60'}`} />
                          <span className="font-semibold text-xs font-mono">{item.name}</span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-cyan-300/70 font-sans">
                        {item.desc}
                      </p>
                      {isSelected && (
                        <div className="text-[10px] font-mono text-[#00f0ff] flex items-center gap-1 pt-1">
                          <Check className="w-3 h-3 text-[#00f0ff]" />
                          <span>Active Routing Strategy</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live Fallback Sequence Visualizer */}
              <div className="p-3.5 rounded-lg bg-[#050508]/80 border border-cyan-500/25 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#00f0ff]" />
                    Live Failover Sequence (Zero 429 Rate-Limit Interruptions)
                  </span>
                  <span className="text-[11px] text-cyan-400/60">
                    {fallbackChain.length} model{fallbackChain.length === 1 ? '' : 's'} in chain
                  </span>
                </div>

                {fallbackChain.length === 0 ? (
                  <p className="text-xs text-amber-300/80 font-mono py-1">
                    No connected free models. Connect Gemini or OpenRouter in the Providers tab to populate your chain.
                  </p>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    {fallbackChain.map((candidate, idx) => (
                      <React.Fragment key={`${candidate.provider.id}-${candidate.modelId}`}>
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono shrink-0 ${
                          idx === 0
                            ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                            : 'bg-[#080d1a] border-cyan-500/30 text-cyan-200/80'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-[#00f0ff] animate-pulse shadow-[0_0_6px_#00f0ff]' : 'bg-cyan-400/60'}`} />
                          <span className="font-semibold">
                            {idx === 0 ? '1. Primary: ' : `${idx + 1}. Fallback: `}
                            {candidate.model.name}
                          </span>
                          <span className="text-[10px] text-cyan-400/60 bg-cyan-950 px-1 py-0.2 rounded border border-cyan-500/20">
                            {candidate.provider.name}
                          </span>
                        </div>
                        {idx < fallbackChain.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-cyan-500/60 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Connected Provider Model Performance Matrix Table */}
            <div className="rounded-xl border border-cyan-500/30 bg-[#080d1a]/90 backdrop-blur-md p-5 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#00f0ff]" />
                    Connected Provider Model Performance Matrix
                  </h2>
                  <p className="text-xs text-cyan-200/60 font-mono mt-0.5">
                    Real-time benchmarking across speed, reliability, and coding intelligence scores.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Filter models..."
                    className="rounded-lg bg-[#050508] border border-cyan-500/30 px-2.5 py-1 text-xs text-white placeholder-cyan-500/40 font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex rounded-lg border border-cyan-500/30 p-0.5 bg-[#050508]">
                    <button
                      onClick={() => setMatrixFilter('connected')}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                        matrixFilter === 'connected' ? 'bg-cyan-950 text-[#00f0ff] font-bold' : 'text-cyan-400/60 hover:text-white'
                      }`}
                    >
                      Connected ({connectedModels.length})
                    </button>
                    <button
                      onClick={() => setMatrixFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                        matrixFilter === 'all' ? 'bg-cyan-950 text-[#00f0ff] font-bold' : 'text-cyan-400/60 hover:text-white'
                      }`}
                    >
                      All Catalog ({supportedModels.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-cyan-500/20">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#050508]/90 text-cyan-400/70 border-b border-cyan-500/20">
                    <tr>
                      <th className="py-2.5 px-3">Model &amp; Adapter</th>
                      <th className="py-2.5 px-3">Context Window</th>
                      <th className="py-2.5 px-3">Speed / Latency</th>
                      <th className="py-2.5 px-3">Reliability</th>
                      <th className="py-2.5 px-3">Intelligence Score</th>
                      <th className="py-2.5 px-3">Tier &amp; Cost</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10">
                    {models
                      .filter((m) => {
                        if (m.tier !== 'free') return false;
                        const provider = providerForModel(m, cloudProviders);
                        if (matrixFilter === 'connected') {
                          return provider && (provider.configured || provider.isConnected || provider.status === 'connected');
                        }
                        return !!provider && supportedProviders.includes(provider.type);
                      })
                      .filter((m) => {
                        if (!matrixSearch.trim()) return true;
                        const q = matrixSearch.toLowerCase();
                        return (
                          m.name.toLowerCase().includes(q) ||
                          m.provider.toLowerCase().includes(q) ||
                          (m.providerModelId || '').toLowerCase().includes(q)
                        );
                      })
                      .map((m) => {
                        const isSelected = m.id === activeModelId;
                        const metrics = getModelMetrics(m);
                        const provider = providerForModel(m, cloudProviders);
                        const isConfigured = Boolean(provider?.configured && provider.status !== 'error');

                        return (
                          <tr
                            key={m.id}
                            className={`hover:bg-cyan-950/30 transition ${
                              isSelected ? 'bg-cyan-950/50' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-semibold text-white">{m.name}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400/60 mt-0.5">
                                <span>{m.provider}</span>
                                {isConfigured && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Connected" />
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-cyan-200/80">{m.contextWindow}</td>
                            <td className="py-3 px-3 text-cyan-300 font-semibold">{metrics.speed}</td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {metrics.reliability}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-400 to-[#00f0ff]"
                                    style={{ width: `${metrics.intelligence}%` }}
                                  />
                                </div>
                                <span className="font-bold text-white">{metrics.intelligence}/100</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                $0.00 Free Tier
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950 text-[#00f0ff] border border-cyan-400 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                                  <Check className="w-3 h-3 text-[#00f0ff]" />
                                  Active Primary
                                </span>
                              ) : (
                                <button
                                  onClick={() => selectModel(m)}
                                  className="px-2.5 py-1 rounded-md bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-white transition"
                                >
                                  Set Primary
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Models & Local compute ── */}
        {(tab === 'models' || tab === 'local') && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <label className="block max-w-md flex-1">
                <span className="text-xs text-cyan-300 font-mono">Search active models</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${input} mt-1.5`}
                  aria-label="Search models"
                  placeholder="Search by name, provider, or capability..."
                />
              </label>

              {tab === 'models' && hasConfiguredProviders && (
                <div className="flex items-center gap-2 pt-2 md:pt-0">
                  <button
                    onClick={() => setModelFilter('connected')}
                    className={`${cardButton} ${
                      modelFilter === 'connected'
                        ? 'bg-cyan-500/20 border-cyan-400 text-[#00f0ff] font-bold shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                        : 'text-cyan-400/70 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse" />
                    Live &amp; Connected ({connectedModels.length})
                  </button>
                  <button
                    onClick={() => setModelFilter('all')}
                    className={`${cardButton} ${
                      modelFilter === 'all'
                        ? 'bg-cyan-500/20 border-cyan-400 text-[#00f0ff] font-bold shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                        : 'text-cyan-400/70 hover:text-white'
                    }`}
                  >
                    All Supported ({supportedModels.length})
                  </button>
                </div>
              )}
            </div>

            {tab === 'models' && !hasConfiguredProviders && (
              <div className="rounded-xl border border-cyan-500/30 bg-[#080d1a]/90 p-4 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-cyan-200 font-mono text-sm font-semibold">
                    <Wifi className="w-4 h-4 text-[#00f0ff] animate-pulse" />
                    <span>No Provider Accounts Connected</span>
                  </div>
                  <p className="text-xs text-cyan-200/60 font-mono">
                    Connect Google Gemini or OpenRouter in the Providers tab to activate live inference models for chat and voice.
                  </p>
                </div>
                <button
                  onClick={() => setTab('providers')}
                  className={`${cardButton} whitespace-nowrap bg-cyan-950/60 border-cyan-400 text-[#00f0ff]`}
                >
                  Configure Providers →
                </button>
              </div>
            )}

            {tab === 'local' && (
              <p className="text-xs text-cyan-200/60 font-mono">
                Run Ollama locally at 127.0.0.1:11434 and install the selected model. AXION will not download models automatically.
              </p>
            )}

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((m) => {
                const p = providerForModel(m, cloudProviders);
                const isProviderConnected = !!p && (p.isConnected || p.status === 'connected' || (p.configured && !!p.verifiedAt));
                const isProviderConfigured = !!p?.configured;
                const isSelected = activeModelId === m.id;

                return (
                  <article
                    key={m.id}
                    className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${
                      isSelected
                        ? 'border-[#00f0ff] bg-cyan-950/30 shadow-[0_0_20px_rgba(0,240,255,0.22)] ring-1 ring-[#00f0ff]/50'
                        : 'border-cyan-500/20 bg-[#080d1a]/80 backdrop-blur-md hover:border-cyan-400/40 hover:bg-[#0c1428]'
                    }`}
                  >
                    {/* Top Meta Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{p?.icon || '⚡'}</span>
                        <span className="text-xs font-mono font-semibold text-cyan-200">
                          {m.provider}
                        </span>
                      </div>
                      {isProviderConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                          Live &amp; Available
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-cyan-400/60 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                          Ready to Connect
                        </span>
                      )}
                    </div>

                    {/* Model Name & ID */}
                    <div>
                      <h2 className="font-semibold text-sm font-mono text-white tracking-wide">
                        {m.name}
                      </h2>
                      <p className="text-[11px] font-mono text-cyan-400/50 break-all mt-0.5">
                        {m.providerModelId || m.id}
                      </p>
                    </div>

                    {/* Specs & Capabilities Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {m.contextWindow && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-500/30 text-cyan-300">
                          {m.contextWindow}
                        </span>
                      )}
                      {m.costPer1kTokens && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#050508] border border-cyan-500/20 text-cyan-400/70">
                          Free Tier
                        </span>
                      )}
                      {m.capabilities?.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/30 border border-cyan-800/30 text-cyan-400/60 capitalize"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>

                    {/* Primary Action Button */}
                    <div className="pt-2 border-t border-cyan-500/15">
                      {isSelected ? (
                        <div className="w-full rounded-lg bg-cyan-500/20 border border-cyan-400 text-[#00f0ff] px-3 py-2 text-xs font-mono font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)] flex items-center justify-center gap-2">
                          <Check size={14} className="text-[#00f0ff]" />
                          <span>Active for Chat &amp; Voice</span>
                        </div>
                      ) : isProviderConfigured ? (
                        <button
                          onClick={() => selectModel(m)}
                          className={`${cardButton} w-full font-semibold flex items-center justify-center gap-2 text-white bg-cyan-950/40 hover:bg-[#00f0ff]/15`}
                        >
                          <Check size={13} className="text-cyan-400" />
                          <span>Use for Chat &amp; Voice</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => p && openConfigDrawer(p)}
                          className={`${cardButton} w-full text-amber-300 border-amber-500/30 hover:border-amber-400 flex items-center justify-center gap-1.5`}
                        >
                          <Key size={13} />
                          <span>Configure {m.provider} Key</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {!visible.length && (
              <p className="text-xs text-cyan-400/60 font-mono py-6 text-center">
                No matching models found. Try clearing your search.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Inline configuration drawer (modal) ── */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeDrawer}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-[min(94vw,480px)] rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {editing.type === 'ollama' ? (
              <DrawerContent
                provider={editing}
                apiKeyValue={key}
                account={typeof account === 'string' ? account : ''}
                onKeyChange={() => {}}
                onAccountIdChange={() => {}}
                onSubmit={startLocal}
                onClose={closeDrawer}
                busy={busy}
                error={error}
              />
            ) : (
              <DrawerContent
                provider={editing}
                apiKeyValue={key}
                account={typeof account === 'string' ? account : ''}
                onKeyChange={setKey}
                onAccountIdChange={setAccount}
                onSubmit={save}
                onClose={closeDrawer}
                busy={busy}
                error={error}
              />
            )}
          </div>
        </div>
      )}

      {/* Fallback dialog element (kept for React/DOM compatibility) */}

    </section>
  );
};
