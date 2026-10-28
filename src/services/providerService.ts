import { invoke, isTauri } from '@tauri-apps/api/core';
import { providerPayload, providerText } from '../utils/providerRouting';

export interface SavedState {
  id: string;
  provider: string;
  name: string;
  accountId: string;
  revision?: string;
  verifiedAt?: string;
  configured: boolean;
  isConnected: boolean;
  status: 'disconnected' | 'untested' | 'connected' | 'error';
  pingResult?: string;
  isPrimary: boolean;
  latencyMs?: number;
  apiKey?: string;
}

const STORAGE_KEY_SAVED_PROVIDERS = 'axion_saved_providers_v1';

/** Backend-facing metadata exposed by the Tauri providerConfigs command. */
export interface ProviderMetadata {
  provider: string;
  configured: boolean;
  accountId: string;
  revision?: string;
  verifiedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Backend-only persistence helpers (no store access)                 */
/* ------------------------------------------------------------------ */

let savedProvidersState: SavedState[] = [];
function loadLocalProviders(): SavedState[] {
  return savedProvidersState;
}
function setLocalProviders(providers: SavedState[]): void {
  savedProvidersState = providers;
}
function setSavedLocalState(providers: SavedState[]): void {
  setLocalProviders(providers);
  saveSavedProviders(providers);
}

export function loadSavedProviders(): SavedState[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_PROVIDERS);
    if (raw) { const data=JSON.parse(raw);return Array.isArray(data)?data.map(({apiKey,...metadata})=>metadata):[]; }
  } catch (e) {
    console.warn('Could not read saved providers from localStorage', e);
  }
  return [];
}

export function saveSavedProviders(providers: SavedState[] | any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SAVED_PROVIDERS, JSON.stringify(providers.map(({apiKey,...metadata})=>metadata)));
  } catch (e) {
    console.warn('Could not persist saved providers', e);
  }
}

/* ------------------------------------------------------------------ */
/* Public API re-exports (e.g., orchestrator uses requestProvider)    */
/* ------------------------------------------------------------------ */

/** Refresh cached provider metadata from the desktop vault. */
export async function refreshProviders(): Promise<void> {
  const configs = await providerConfigs();
  const saved = loadSavedProviders();
  const byType = new Map<string, SavedState>();
  saved.forEach((p) => {
    byType.set(p.id, p);
    if (p.provider) byType.set(p.provider, p);
  });
  const configured = configs.filter((c) => c.configured);
  const types = ['gemini', 'openrouter', 'groq', 'cloudflare', 'ollama', 'fishaudio', 'nvidia', 'anthropic', 'openai', 'deepseek', 'mistral', 'cohere', 'huggingface', 'together', 'perplexity', 'replicate', 'fireworks'];
  const loaded = await Promise.all(
    types.map(async (type) => {
      const config = configured.find((c) => c.provider === type);
      const savedProv = byType.get(type) || {
        id: type,
        provider: type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        accountId: '',
        configured: false,
        isConnected: false,
        status: type === 'ollama' ? 'connected' : 'disconnected',
        pingResult: undefined,
        isPrimary: false,
        latencyMs: undefined,
      };
      const isConfig = !!config?.configured || savedProv.configured;
      const wasConnected = isConfig && (savedProv.isConnected || savedProv.status === 'connected' || !!savedProv.verifiedAt);
      return {
        id: savedProv.id,
        provider: savedProv.provider,
        name: savedProv.name,
        accountId: config?.accountId || savedProv.accountId,
        configured: isConfig,
        isConnected: wasConnected,
        status: wasConnected ? ('connected' as const) : savedProv.status,
        pingResult: wasConnected ? (savedProv.pingResult || 'Connected & Verified') : savedProv.pingResult,
        isPrimary: savedProv.isPrimary,
        latencyMs: savedProv.latencyMs,
        verifiedAt: wasConnected ? (savedProv.verifiedAt || new Date().toISOString()) : undefined,
      };
    })
  );
  setSavedLocalState(loaded);
}

/* ------------------------------------------------------------------ */
/* Backend-only helpers (not exported)                                */
/* ------------------------------------------------------------------ */

export async function saveProvider(provider:string,apiKey:string,accountId:string,remove=false):Promise<void>{
 if(!isTauri())throw Error('Secure provider configuration requires the AXION desktop app.');
 await invoke('provider_save',{provider,apiKey,accountId,remove});
}

export async function requestProvider(provider: string, model: string, system: string, contents: any[], timeoutSecs?: number): Promise<string> {
  const signal = timeoutSecs ? AbortSignal.timeout(timeoutSecs * 1000) : undefined;
  if (provider === 'fishaudio') {
    throw Error('Fish Audio is a speech provider, not a chat model.');
  }
  if (!isTauri()) {
    if (provider === 'gemini') {
      const saved = loadSavedProviders();
      const prov = saved.find(p => p.provider === 'gemini' || p.id === 'provider-gemini');
      const apiKey = (prov as any)?.apiKey || (typeof window !== 'undefined' ? (window as any).__GEMINI_KEY__ : '');
      if (apiKey) {
        const payload = providerPayload(provider, model, system, contents);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });
        if (!res.ok) {
          let errText = await res.text();
          try {
            const j = JSON.parse(errText);
            errText = j.error?.message || errText;
          } catch {}
          throw new Error(`Google Gemini HTTP ${res.status}: ${errText}`);
        }
        const data = await res.json();
        return providerText(provider, data);
      }
    }
    if (provider === 'ollama') {
      try {
        const payload = providerPayload(provider, model, system, contents);
        const res = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        return providerText(provider, data);
      } catch (e: any) {
        throw new Error(`Ollama connection error: ${e?.message || e}`);
      }
    }
    throw new Error('Provider requests require the AXION desktop app and its secure credential store.');
  }
  const payload = providerPayload(provider, model, system, contents);
  const result = await invoke('provider_request', { provider, model, payload, timeoutSecs: timeoutSecs ?? null });
  return providerText(provider, result);
}

export async function providerConfigs(): Promise<ProviderMetadata[]> {
  return isTauri() ? invoke<ProviderMetadata[]>('provider_configs') : [];
}

export interface LiveCatalogResult {
  models: { id: string; pricing: 'free' | 'paid' | 'unknown' }[];
  tags: string[];
  partial: boolean;
  catalogOnly: boolean;
}

/**
 * Verifies a saved key by reading the provider's official models endpoint
 * (an authenticated but inference-free request, so verification never spends
 * tokens the user did not authorize).
 */
export async function verifyProviderCatalog(provider: string): Promise<LiveCatalogResult> {
  if (!isTauri()) throw Error('Live verification requires the AXION desktop app.');
  return invoke<LiveCatalogResult>('provider_catalog', { provider });
}

/** Upgrade legacy plaintext entries only into the existing native encrypted vault. */
export async function migrateProviderCredentials():Promise<void>{
 if(!isTauri())return;
 const configs=await providerConfigs();
 const raw=localStorage.getItem(STORAGE_KEY_SAVED_PROVIDERS);
 if(raw){const entries=JSON.parse(raw);if(Array.isArray(entries)){
  for(const p of entries){const type=p.type||p.provider||String(p.id||'').replace('provider-','');if(p.apiKey&&!configs.some(c=>c.provider===type&&c.configured))await saveProvider(type,p.apiKey,p.accountId||'');}
  saveSavedProviders(entries);
 }}
 const current=await providerConfigs();
 for(const storageKey of Object.keys(localStorage)){
  if(/fish.*key/i.test(storageKey)){const value=localStorage.getItem(storageKey);if(value&&!current.some(c=>c.provider==='fishaudio'&&c.configured))await saveProvider('fishaudio',value,'');localStorage.removeItem(storageKey);}
  if(/voice.*settings/i.test(storageKey)){try{const value=JSON.parse(localStorage.getItem(storageKey)||'{}');if(value.fishAudioApiKey){if(!current.some(c=>c.provider==='fishaudio'&&c.configured))await saveProvider('fishaudio',value.fishAudioApiKey,'');delete value.fishAudioApiKey;localStorage.setItem(storageKey,JSON.stringify(value));}}catch(error){throw Error('Legacy voice credential migration failed; retry in Cloud Brain.');}}
 }
}
