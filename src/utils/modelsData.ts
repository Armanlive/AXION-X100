import { AIModel } from '../types';

export const INITIAL_MODELS: AIModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google Gemini',
    tier: 'free',
    costPer1kTokens: '$0.00 (Zero-Cost Free Tier)',
    contextWindow: '1,048,576 tokens',
    status: 'healthy',
    latencyMs: 180
  },
  {
    id: 'openrouter-llama-3.3-70b',
    name: 'Meta Llama 3.3 70B Instruct',
    provider: 'OpenRouter',
    tier: 'free',
    costPer1kTokens: '$0.00 (OpenRouter Free)',
    contextWindow: '131,072 tokens',
    status: 'healthy',
    latencyMs: 340
  },
  {
    id: 'ollama-qwen-coder',
    name: 'Qwen 2.5 Coder 14B',
    provider: 'Ollama Local',
    tier: 'free',
    costPer1kTokens: '$0.00 (100% Local GPU/CPU)',
    contextWindow: '32,768 tokens',
    status: 'healthy',
    latencyMs: 95
  },
  // Paid Models (Auto-Blocked by Default with explicit override gate)
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet (Blocked)',
    provider: 'Anthropic',
    tier: 'paid_blocked',
    costPer1kTokens: '$0.003 / $0.015',
    contextWindow: '200,000 tokens',
    status: 'offline',
    latencyMs: 450
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Blocked)',
    provider: 'OpenAI',
    tier: 'paid_blocked',
    costPer1kTokens: '$0.0025 / $0.010',
    contextWindow: '128,000 tokens',
    status: 'offline',
    latencyMs: 490
  }
];
