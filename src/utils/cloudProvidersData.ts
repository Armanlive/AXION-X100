import { CloudProvider } from '../types';

export const INITIAL_CLOUD_PROVIDERS: CloudProvider[] = [
  {
    id: 'provider-gemini',
    name: 'Google Gemini',
    description: 'Zero-cost primary engine with native multimodal capabilities and 1M token context.',
    icon: '✨',
    type: 'gemini',
    apiKey: '',
    isConnected: false,
    isPrimary: true,
    status: 'not_configured',
    tier: 'free',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  },
  {
    id: 'provider-openrouter',
    name: 'OpenRouter Free Tier',
    description: 'Multi-model free tier gateway with automatic fallbacks to open-weights models.',
    icon: '🔀',
    type: 'openrouter',
    apiKey: '',
    isConnected: false,
    isPrimary: false,
    status: 'not_configured',
    tier: 'free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-coder-32b-instruct:free']
  },
  {
    id: 'provider-ollama',
    name: 'Ollama Local (Offline)',
    description: '100% private offline models running directly on your local hardware.',
    icon: '🦙',
    type: 'ollama',
    isConnected: false,
    isPrimary: false,
    status: 'untested',
    tier: 'free',
    models: ['qwen2.5-coder:7b', 'deepseek-r1:8b', 'llama3.2:3b']
  },
  {
    id: 'provider-groq',
    name: 'Groq LPU Accelerator',
    description: 'Ultra-low latency inference engine running open models.',
    icon: '⚡',
    type: 'groq',
    apiKey: '',
    isConnected: false,
    isPrimary: false,
    status: 'not_configured',
    tier: 'free',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768']
  },
  {
    id: 'provider-cloudflare',
    name: 'Cloudflare Workers AI',
    description: 'Global serverless GPU inference network with free daily allocation.',
    icon: '☁️',
    type: 'cloudflare',
    apiKey: '',
    isConnected: false,
    isPrimary: false,
    status: 'not_configured',
    tier: 'free',
    models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b']
  },
  {
    id: 'provider-nvidia',
    name: 'NVIDIA NIM Microservices',
    description: 'Optimized enterprise containers with evaluation credits.',
    icon: '🟢',
    type: 'nvidia',
    apiKey: '',
    isConnected: false,
    isPrimary: false,
    status: 'not_configured',
    tier: 'free',
    models: ['meta/llama-3.3-70b-instruct', 'mistralai/mistral-large-2-instruct']
  }
];
