import registry from '../core/providers/catalog.json';
import { CloudProvider } from '../types';

/** Step-by-step API-key creation guides shown in each card's "How to create it" tab. */
export const KEY_CREATION_STEPS: Record<string, string[]> = {
  gemini: [
    'Sign in to Google AI Studio at aistudio.google.com.',
    'Click "Get API key" → "Create API key".',
    'Pick a Google Cloud project (or let AI Studio create one) and copy the key (AIza…).',
    'Paste it below and press Connect — the free tier has generous quotas.',
  ],
  openrouter: [
    'Create a free account at openrouter.ai.',
    'Open Settings → Keys and press "Create Key".',
    'Name it (e.g. AXION) and copy the key (sk-or-…).',
    'Paste and Connect — only free (*:free) models route on the free tier.',
  ],
  groq: [
    'Sign up at console.groq.com.',
    'Open "API Keys" in the sidebar and press "Create API Key".',
    'Copy the key (gsk_…).',
    'Paste and Connect — verification runs against a live inference request.',
  ],
  cloudflare: [
    'Log in to dash.cloudflare.com and open My Profile → API Tokens.',
    'Create a token (or copy your Global API Key).',
    'Copy the 32-character Account ID from the Workers AI dashboard.',
    'Paste the token and Account ID below, then press Connect.',
  ],
  nvidia: [
    'Sign in at build.nvidia.com.',
    'Open API Keys under your profile and generate a new key (nvapi-…).',
    'Copy the key.',
    'Paste and Connect — evaluation credits are included with new accounts.',
  ],
  ollama: [
    'Download Ollama for your OS from ollama.com/download.',
    'Install and launch it — the service runs at 127.0.0.1:11434.',
    'Pull a model, e.g. `ollama pull qwen2.5-coder:7b`.',
    'Press Connect below — no API key is required, everything stays local.',
  ],
  fishaudio: [
    'Create an account at fish.audio.',
    'Open Dashboard → API Keys and create a key (sk-fish-…).',
    'Copy the key.',
    'Paste and Connect — used for zero-shot neural voice synthesis.',
  ],
  anthropic: [
    'Sign up at console.anthropic.com.',
    'Open API Keys → "Create Key" (a billing method is required).',
    'Copy the key (sk-ant-…).',
    'Paste and Connect — verification checks the official /v1/models endpoint.',
  ],
  openai: [
    'Sign in at platform.openai.com.',
    'Open API keys → "Create new secret key" (a billing method is required).',
    'Copy the key (sk-…).',
    'Paste and Connect — verification checks the official /v1/models endpoint.',
  ],
  deepseek: [
    'Sign in at platform.deepseek.com.',
    'Open API keys → "Create API key".',
    'Copy the key (sk-…).',
    'Paste and Connect — verification checks the official /models endpoint.',
  ],
  mistral: [
    'Sign in at console.mistral.ai.',
    'Open API Keys and create a new key.',
    'Copy the key.',
    'Paste and Connect — verification checks the official /v1/models endpoint.',
  ],
  cohere: [
    'Sign in at dashboard.cohere.com.',
    'Open API keys → "Create API key".',
    'Copy the key.',
    'Paste and Connect — verification checks the official /v1/models endpoint.',
  ],
  huggingface: [
    'Sign in at huggingface.co and open Settings → Access Tokens.',
    'Press "New token", give it read access, and create it (hf_…).',
    'Copy the token.',
    'Paste and Connect — verification checks the official router /v1/models endpoint.',
  ],
  together: [
    'Sign in at api.together.ai.',
    'Open Settings → API Keys and create a key.',
    'Copy the key.',
    'Paste and Connect — verification checks the official /v1/models endpoint.',
  ],
  perplexity: [
    'Sign in at perplexity.ai and open Settings → API.',
    'Generate an API key (pplx-…).',
    'Copy the key.',
    'Paste and Connect — verification runs a tiny live chat probe.',
  ],
  replicate: [
    'Sign in at replicate.com and open Account → API tokens.',
    'Press "Create token" and copy it (r8_…).',
    'Keep the token secret — it is shown only once.',
    'Paste and Connect — verification checks the official /v1/models endpoint.',
  ],
  fireworks: [
    'Sign in at fireworks.ai and open Account → API keys.',
    'Create a key and copy it (fw_…).',
    'Keep the key secret.',
    'Paste and Connect — verification checks the official /inference/v1/models endpoint.',
  ],
};

/** Per-provider presentation details layered over the bundled catalog registry. */
const PROVIDER_PRESENTATION: Partial<Record<CloudProvider['type'], Partial<CloudProvider>>> = {
  gemini: {
    name: 'Google Gemini',
    description: 'Zero-cost primary engine with native multimodal capabilities and 1M token context.',
    icon: '✨',
    isPrimary: true,
    tier: 'free',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  },
  openrouter: {
    name: 'OpenRouter Free Tier',
    description: 'Multi-model free tier gateway with automatic fallbacks to open-weights models.',
    icon: '🔀',
    tier: 'free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-coder-32b-instruct:free']
  },
  ollama: {
    name: 'Ollama Local (Offline)',
    description: '100% private offline models running directly on your local hardware.',
    icon: '🦙',
    status: 'untested',
    tier: 'free',
    models: ['qwen2.5-coder:7b', 'deepseek-r1:8b', 'llama3.2:3b']
  },
  groq: {
    name: 'Groq LPU Accelerator',
    description: 'Ultra-low latency inference engine running open models.',
    icon: '⚡',
    tier: 'free',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768']
  },
  cloudflare: {
    name: 'Cloudflare Workers AI',
    description: 'Global serverless GPU inference network with free daily allocation.',
    icon: '☁️',
    tier: 'free',
    models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b']
  },
  nvidia: {
    name: 'NVIDIA NIM Microservices',
    description: 'Optimized enterprise containers with evaluation credits.',
    icon: '🟢',
    tier: 'free',
    models: ['meta/llama-3.3-70b-instruct', 'mistralai/mistral-large-2-instruct']
  },
  fishaudio: {
    name: 'Fish Audio Neural TTS',
    description: 'High-fidelity zero-shot voice synthesis engine with ultra-expressive multilingual generation.',
    icon: '🐟',
    tier: 'free',
    models: ['s2.1-pro', 's2-pro', 'drama-3']
  },
  anthropic: {
    name: 'Anthropic Claude',
    description: 'Reasoning and vision flagship models with direct Messages API chat routing.',
    icon: '🤖',
    tier: 'paid',
    models: ['claude-opus-5-5', 'claude-haiku-5-5']
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT and o-series reasoning models over the Chat Completions API.',
    icon: '◎',
    tier: 'paid',
    models: ['gpt-4o', 'o3-mini']
  },
  deepseek: {
    name: 'DeepSeek',
    description: 'Deep reasoning and coding models with OpenAI-compatible chat routing.',
    icon: '🐋',
    tier: 'paid',
    models: ['deepseek-chat']
  },
  mistral: {
    name: 'Mistral AI',
    description: 'Efficient coding and vision models with native chat routing.',
    icon: '🌬️',
    tier: 'paid',
    models: ['mistral-small-latest']
  },
  cohere: {
    name: 'Cohere',
    description: 'Retrieval and enterprise chat models with v2 chat routing.',
    icon: '🧭',
    tier: 'paid',
    models: ['command-r7b-12-2024']
  },
  huggingface: {
    name: 'HuggingFace Router',
    description: 'Open-model gateway routing chat to thousands of hosted models.',
    icon: '🤗',
    tier: 'paid',
    models: ['HuggingFaceH4/zephyr-7b-beta']
  },
  together: {
    name: 'Together AI',
    description: 'Open-weights inference at scale with OpenAI-compatible routing.',
    icon: '🤝',
    tier: 'paid',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo']
  },
  perplexity: {
    name: 'Perplexity',
    description: 'Web-connected sonar models grounded in live search results.',
    icon: '🔎',
    tier: 'paid',
    models: ['sonar']
  },
  replicate: {
    name: 'Replicate',
    description: 'Async inference across thousands of open models via predictions.',
    icon: '🔁',
    tier: 'paid',
    models: []
  },
  fireworks: {
    name: 'Fireworks AI',
    description: 'Blazing-fast serving of open and specialized models.',
    icon: '🎆',
    tier: 'paid',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct']
  }
};

export type ProviderCategory = 'all' | 'connected' | 'free' | 'enterprise' | 'local';
const isLocalProvider = (p: CloudProvider) => p.type === 'ollama' || !!registry.find(r => r.id === p.type)?.tags.includes('local');
export const PROVIDER_CATEGORIES: { id: ProviderCategory; label: string; match: (p: CloudProvider) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'connected', label: 'Connected', match: p => !!p.configured || p.isConnected || p.status === 'connected' },
  { id: 'free', label: 'Free Tier', match: p => p.tier === 'free' && !isLocalProvider(p) },
  { id: 'enterprise', label: 'Enterprise', match: p => p.tier === 'paid' && !isLocalProvider(p) },
  { id: 'local', label: 'Local', match: isLocalProvider },
];
/** Search matches name, type, description and catalog tags; every whitespace-separated term must hit. */
export function filterProviders(providers: CloudProvider[], query: string, category: ProviderCategory): CloudProvider[] {
  const match = PROVIDER_CATEGORIES.find(c => c.id === category)?.match ?? (() => true);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return providers.filter(p => {
    if (!match(p)) return false;
    const haystack = `${p.name} ${p.type} ${p.description} ${registry.find(r => r.id === p.type)?.tags.join(' ') || ''}`.toLowerCase();
    return terms.every(t => haystack.includes(t));
  });
}

export const INITIAL_CLOUD_PROVIDERS: CloudProvider[] = registry.map(p => ({
  id: `provider-${p.id}`,
  name: p.name,
  description: 'Vault-secured key with live model discovery and direct chat routing.',
  icon: '◈',
  type: p.id as CloudProvider['type'],
  apiKey: '',
  isConnected: false,
  isPrimary: false,
  status: 'not_configured' as const,
  tier: (p.tags.includes('free-tier') ? 'free' : 'paid') as CloudProvider['tier'],
  models: [],
  ...(PROVIDER_PRESENTATION[p.id as CloudProvider['type']] || {})
}));
