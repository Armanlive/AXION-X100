import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Lock,
  CheckCircle2,
  Search,
  Key,
  HardDrive,
  Cloud,
  Zap,
  Sliders,
  Check,
  ExternalLink,
  AlertTriangle,
  Radio,
  Sparkles,
  Server,
  Layers,
  ChevronRight
} from 'lucide-react';
import { AIModel } from '../types';

export const CloudRouter: React.FC = () => {
  const {
    models,
    activeModelId,
    setActiveModelId,
    simulateFailover,
    requestPaidModel,
    cloudProviders,
    connectProvider,
    disconnectProvider,
    testProviderConnection
  } = useAxionStore();

  const [activeSection, setActiveSection] = useState<'overview' | 'models' | 'providers' | 'router' | 'local'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'paid' | 'local'>('all');
  const [selectedCapability, setSelectedCapability] = useState<string>('all');
  const [keyInputModalProvider, setKeyInputModalProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingProvider, setIsTestingProvider] = useState<string | null>(null);

  // Filter models based on search, tier, and capability
  const filteredModels = models.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.displayName && model.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesTier = true;
    if (tierFilter === 'free') matchesTier = model.tier === 'free' && !model.isLocal;
    else if (tierFilter === 'paid') matchesTier = model.tier !== 'free';
    else if (tierFilter === 'local') matchesTier = Boolean(model.isLocal);

    let matchesCap = true;
    if (selectedCapability !== 'all') {
      matchesCap = Boolean(model.capabilities?.includes(selectedCapability as any));
    }

    return matchesSearch && matchesTier && matchesCap;
  });

  const handleConnectKey = (providerId: string) => {
    if (apiKeyInput.trim()) {
      connectProvider(providerId, apiKeyInput.trim());
      setKeyInputModalProvider(null);
      setApiKeyInput('');
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setIsTestingProvider(providerId);
    await testProviderConnection(providerId);
    setIsTestingProvider(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-y-auto select-none">
      {/* CLOUD BRAIN Header */}
      <div className="px-6 py-5 border-b border-zinc-800 bg-[#0e0e11] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">CLOUD BRAIN</h1>
                <p className="text-xs text-zinc-400">Models, providers, routing and compute intelligence.</p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-zinc-500 uppercase text-[10px] block">Demo Selection</span>
              <span className="text-emerald-400 font-medium">Gemini 2.0 Flash (Free Tier)</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-zinc-500 uppercase text-[10px] block">Incurred Cost</span>
              <span className="text-zinc-200 font-semibold">$0.00</span>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-5 border-t border-zinc-800/80 pt-3 text-xs">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'models', label: `Models (${models.length})` },
            { id: 'providers', label: `Providers (${cloudProviders.length})` },
            { id: 'router', label: 'Dynamic Router' },
            { id: 'local', label: 'Local Compute (Ollama)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeSection === tab.id
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Section Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* 1. OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Zero-Cost Model Policy Card */}
            <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Free-First Model Router Policy (Preview)</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Routing Preview
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                AXION is designed for a free-first autonomous routing hierarchy. In this prototype, model catalog entries preview free-tier options (Google Gemini, OpenRouter Free, or local Ollama). Paid endpoints require explicit user authorization before prototype routing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Tier 1: Primary Free</div>
                  <div className="text-xs font-bold text-white mt-1">Google Gemini 2.0 Flash</div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5">$0.00 • 1M Context</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Tier 2: Failover Free</div>
                  <div className="text-xs font-bold text-white mt-1">OpenRouter Free Gateway</div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5">Qwen 2.5 Coder & Llama 3.3</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Tier 3: Local Offline</div>
                  <div className="text-xs font-bold text-white mt-1">Ollama Local Engine</div>
                  <div className="text-[11px] text-zinc-300 font-mono mt-0.5">0ms Network • 100% Private</div>
                </div>
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-200">Provider Configurations</h4>
                  <button onClick={() => setActiveSection('providers')} className="text-xs text-emerald-400 hover:underline">
                    Manage Providers →
                  </button>
                </div>
                <div className="space-y-2">
                  {cloudProviders.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        <span className="font-medium text-white">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                        {p.isConnected ? (
                          <span className="text-emerald-400 font-medium">Configured (Demo)</span>
                        ) : p.status === 'untested' ? (
                          <span className="text-zinc-500">Untested</span>
                        ) : (
                          <span className="text-zinc-500">Not configured</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-200">Paid Safety Gate (Blocked)</h4>
                  <button onClick={() => setActiveSection('models')} className="text-xs text-zinc-400 hover:underline">
                    View Registry →
                  </button>
                </div>
                <div className="space-y-2">
                  {models
                    .filter((m) => m.tier !== 'free')
                    .map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-zinc-300 font-medium">{m.name}</span>
                        </div>
                        <button
                          onClick={() => requestPaidModel(m.id)}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-mono border border-amber-500/20"
                        >
                          Authorize
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. MODELS REGISTRY & SEARCH SECTION */}
        {activeSection === 'models' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#121215] border border-zinc-800">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search models by name, provider, or architecture..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 font-sans"
                />
              </div>

              {/* Tier Filters */}
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
                {(['all', 'free', 'paid', 'local'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
                    className={`px-2.5 py-1 rounded-md capitalize font-mono text-[11px] transition ${
                      tierFilter === t ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t === 'free' ? 'Free ($0.00)' : t === 'paid' ? 'Paid (Auth)' : t === 'local' ? 'Local (Offline)' : 'All Models'}
                  </button>
                ))}
              </div>

              {/* Capability Select */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-[11px] text-zinc-500 font-mono">Capability:</span>
                <select
                  value={selectedCapability}
                  onChange={(e) => setSelectedCapability(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="all">All Capabilities</option>
                  <option value="coding">Coding Optimized</option>
                  <option value="reasoning">Deep Reasoning</option>
                  <option value="vision">Multimodal Vision</option>
                  <option value="fast">Ultra Fast Inference</option>
                </select>
              </div>
            </div>

            {/* Model Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredModels.map((model) => {
                const isActive = model.id === activeModelId;
                const isPaid = model.tier !== 'free';

                return (
                  <div
                    key={model.id}
                    className={`p-4 rounded-xl border relative flex flex-col justify-between transition ${
                      isActive
                        ? 'bg-[#151518] border-zinc-500 ring-1 ring-zinc-500/50 shadow-lg'
                        : isPaid
                        ? 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700 opacity-85'
                        : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      {isActive && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-zinc-100 text-zinc-950 text-[10px] font-mono font-bold rounded-full shadow-sm flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                          DEMO SELECTION
                        </span>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-zinc-400 font-medium">
                          {model.provider}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                            model.status === 'degraded'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                          }`}
                        >
                          ● {model.status === 'untested' ? 'CATALOG MODEL' : model.status === 'healthy' ? 'CATALOG MODEL' : model.status.toUpperCase()}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-white mb-2">{model.name}</h4>

                      {/* Capabilities chips */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {model.capabilities?.map((cap) => (
                          <span
                            key={cap}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                          >
                            {cap}
                          </span>
                        ))}
                        {model.codingScore && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                            Coding Score: {model.codingScore}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono text-zinc-400 pt-2 border-t border-zinc-800">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Cost:</span>
                        <span className={isPaid ? 'text-amber-400' : 'text-emerald-400 font-medium'}>
                          {model.costPer1kTokens}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Context:</span>
                        <span className="text-zinc-300">{model.contextWindow}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Latency:</span>
                        <span className="text-zinc-400 font-mono text-[11px]">
                          {model.isLocal ? 'Local bus (untested)' : 'Not tested'}
                        </span>
                      </div>

                      <div className="pt-2">
                        {isPaid ? (
                          <button
                            onClick={() => requestPaidModel(model.id)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-medium border border-amber-500/30 transition shadow-sm"
                          >
                            <Lock className="w-3 h-3" />
                            <span>PAID • Authorize Model</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveModelId(model.id)}
                            className={`w-full py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                              isActive
                                ? 'bg-zinc-800 text-zinc-300 cursor-default'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700'
                            }`}
                          >
                            {isActive ? 'Demo Selection' : 'Select for Preview'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. PROVIDERS REGISTRY */}
        {activeSection === 'providers' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>Provider connection status directly governs router availability. Only connected providers receive dispatch.</span>
              <span className="font-mono text-emerald-400">Zero Silent Billing Enforced</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cloudProviders.map((provider) => (
                <div
                  key={provider.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                    provider.isConnected
                      ? 'bg-[#121215] border-zinc-700/80 shadow-sm'
                      : 'bg-[#0f0f12] border-zinc-850 opacity-80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{provider.icon}</span>
                        <div>
                          <h4 className="text-xs font-bold text-white">{provider.name}</h4>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">{provider.type}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          provider.isConnected
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : provider.status === 'untested'
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-750'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                        }`}
                      >
                        {provider.isConnected
                          ? 'Configured (Demo)'
                          : provider.status === 'untested'
                          ? 'Untested'
                          : 'Not Configured'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 mb-3">{provider.description}</p>

                    <div className="space-y-1 text-xs font-mono text-zinc-400 mb-4">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Tier:</span>
                        <span className={provider.tier === 'free' ? 'text-emerald-400' : 'text-amber-400'}>
                          {provider.tier.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Available Models:</span>
                        <span className="text-zinc-300">{provider.models.length} models</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Connectivity:</span>
                        <span className="text-zinc-400">
                          {provider.pingResult ? 'Not verified' : 'Untested'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleTestConnection(provider.id)}
                        disabled={isTestingProvider === provider.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono border border-zinc-750 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTestingProvider === provider.id ? 'animate-spin' : ''}`} />
                        <span>Test Ping</span>
                      </button>

                      {provider.isConnected ? (
                        <button
                          onClick={() => disconnectProvider(provider.id)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 text-xs font-mono border border-zinc-800 transition"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => setKeyInputModalProvider(provider.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition"
                        >
                          <Key className="w-3 h-3" />
                          <span>Configure API Key</span>
                        </button>
                      )}
                    </div>

                    {provider.pingResult && (
                      <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-amber-400/90 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <span>{provider.pingResult}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. DYNAMIC ROUTER SECTION */}
        {activeSection === 'router' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#121215] border border-zinc-800">
              <div>
                <h3 className="text-xs font-bold text-white">Dynamic Failover Simulator (Demo)</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  [SIMULATION] Demonstrate how the model router handles rate limit errors and simulates fallback routes.
                </p>
              </div>
              <button
                onClick={simulateFailover}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-mono border border-zinc-700 transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Simulate Rate Limit</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-200 uppercase font-mono">Routing Priority Hierarchy (Demo Preview)</h4>
              <div className="space-y-2">
                {[
                  { priority: 1, name: 'Gemini 2.0 Flash (Free Tier Catalog)', status: 'Example Route 1 (Demo)', cost: '$0.00' },
                  { priority: 2, name: 'OpenRouter Free Gateway (Qwen 2.5 Coder / Llama 3.3)', status: 'Example Route 2 (Demo)', cost: '$0.00' },
                  { priority: 3, name: 'Ollama Local Compute (Offline Fallback)', status: 'Not Configured (Demo)', cost: '$0.00' },
                  { priority: 4, name: 'Paid Models (Anthropic / OpenAI)', status: 'User Authorized Only (Demo)', cost: 'User Authorized Only' }
                ].map((item) => (
                  <div key={item.priority} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center font-bold">
                        {item.priority}
                      </span>
                      <span className="font-medium text-white">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-emerald-400">{item.cost}</span>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. LOCAL COMPUTE SECTION */}
        {activeSection === 'local' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">Local Compute & Ollama Engine (Demo Catalog)</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ollama runs offline on your local GPU/CPU. When active, zero network telemetry or code context leaves your machine.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {models
                .filter((m) => m.isLocal)
                .map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{m.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                        Offline Catalog
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono space-y-1">
                      <div>Context: {m.contextWindow}</div>
                      <div>Latency: Not measured (Local bus)</div>
                      <div>Privacy: Zero Telemetry</div>
                    </div>
                    <button
                      onClick={() => setActiveModelId(m.id)}
                      className="w-full mt-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition"
                    >
                      {m.id === activeModelId ? 'Demo Selection (Local)' : 'Select Local (Demo)'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* API Key Modal for Disconnected Provider */}
      {keyInputModalProvider && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-[#141417] border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Connect Provider API Key</span>
              </h3>
              <button
                onClick={() => setKeyInputModalProvider(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Enter your API key for{' '}
              <span className="font-semibold text-white">
                {cloudProviders.find((p) => p.id === keyInputModalProvider)?.name}
              </span>
              . Keys are saved to your local encrypted session and never sent to central servers.
            </p>

            <input
              type="password"
              placeholder="sk-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setKeyInputModalProvider(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConnectKey(keyInputModalProvider)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow transition"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
