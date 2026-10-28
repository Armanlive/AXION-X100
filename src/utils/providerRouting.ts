import type {AIModel, CloudProvider} from '../types/index.ts';
import { INITIAL_MODELS } from './modelsData.ts';

export const supportedProviders = ['gemini','openrouter','groq','cloudflare','ollama','nvidia','anthropic','openai','deepseek','mistral','cohere','huggingface','together','perplexity','replicate','fireworks'];

export type RoutingStrategy = 'balanced' | 'fastest' | 'smartest';

export interface RouteCandidate {
  provider: CloudProvider;
  modelId: string;
  model: AIModel;
}

export function providerForModel(model: AIModel | undefined, providers: CloudProvider[]) {
 const type: Record<string,string> = {'Google Gemini':'gemini','OpenRouter':'openrouter','Groq':'groq','Cloudflare':'cloudflare','Ollama Local':'ollama','NVIDIA':'nvidia','NVIDIA NIM':'nvidia','Anthropic':'anthropic','OpenAI':'openai','DeepSeek':'deepseek','Mistral':'mistral','Cohere':'cohere','HuggingFace':'huggingface','Together AI':'together','Perplexity':'perplexity','Replicate':'replicate','Fireworks':'fireworks'};
 // Pool models synthesized from a provider's key carry the provider type itself.
 return providers.find(p=>p.type===(type[model?.provider || ''] || model?.provider));
}

export function resolveRoute(model: AIModel | undefined, providers: CloudProvider[]) {
 const provider=providerForModel(model,providers);
 if(!model || !provider || !supportedProviders.includes(provider.type)) throw Error('Select a supported model in Cloud Brain.');
 if(model.tier==='paid_blocked') throw Error('Paid model routing is not enabled for this model. Approve it in Cloud Brain first.');
 if(!provider.configured) throw Error(`Configure ${provider.name} in Cloud Brain → Providers.`);
 const modelId=(model.providerModelId || model.id).replace(/^models\//,'');
 if(provider.type==='openrouter' && modelId!=='openrouter/free' && !modelId.endsWith(':free')) throw Error('Select an OpenRouter free model.');
 return {provider,modelId};
}

export function isRateLimitOrTemporaryError(error: unknown): boolean {
  if (!error) return false;
  const errStr = (error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) || '').toLowerCase();
  const code = Number((error as {status?:number})?.status || (error as {code?:number})?.code);
  return (
    code === 429 ||
    code === 503 ||
    code === 502 ||
    code === 504 ||
    errStr.includes('429') ||
    errStr.includes('rate limit') ||
    errStr.includes('rate_limit') ||
    errStr.includes('rate-limit') ||
    errStr.includes('quota') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('too many requests') ||
    errStr.includes('overloaded') ||
    errStr.includes('temporarily unavailable') ||
    errStr.includes('high demand') ||
    errStr.includes('exceeded your current quota') ||
    errStr.includes('capacity')
  );
}

export function getFallbackChain(
  selectedModel: AIModel | undefined,
  allModels: AIModel[] = INITIAL_MODELS,
  providers: CloudProvider[] = [],
  options?: { strategy?: RoutingStrategy; autoFallback?: boolean }
): RouteCandidate[] {
  const strategy = options?.strategy || 'balanced';
  const autoFallback = options?.autoFallback !== false;
  const chain: RouteCandidate[] = [];

  // 1. Primary candidate
  if (selectedModel) {
    try {
      const resolved = resolveRoute(selectedModel, providers);
      chain.push({
        provider: resolved.provider,
        modelId: resolved.modelId,
        model: selectedModel
      });
    } catch {
      // Primary model could not be resolved
    }
  }

  if (!autoFallback && chain.length > 0) {
    return chain;
  }

  // 2. Discover all other free models from configured providers
  const modelsPool = allModels && allModels.length > 0 ? allModels : INITIAL_MODELS;
  const candidates: RouteCandidate[] = [];
  const primaryKey = chain[0] ? `${chain[0].provider.type}:${chain[0].modelId}` : '';

  for (const m of modelsPool) {
    if (m.tier === 'paid_blocked') continue;
    const p = providerForModel(m, providers);
    if (!p || !p.configured || !supportedProviders.includes(p.type)) continue;
    if (p.status === 'error') continue;

    const modelId = (m.providerModelId || m.id).replace(/^models\//, '');
    if (p.type === 'openrouter' && modelId !== 'openrouter/free' && !modelId.endsWith(':free')) {
      continue;
    }

    const key = `${p.type}:${modelId}`;
    if (key === primaryKey) continue;
    if (candidates.some((c) => `${c.provider.type}:${c.modelId}` === key)) continue;

    candidates.push({ provider: p, modelId, model: m });
  }

  // 3. Sort candidates according to routing strategy
  candidates.sort((a, b) => {
    if (strategy === 'fastest') {
      const aFast = a.model.capabilities?.includes('fast') ? 1 : 0;
      const bFast = b.model.capabilities?.includes('fast') ? 1 : 0;
      if (bFast !== aFast) return bFast - aFast;
      const aLatency = a.provider.latencyMs ?? a.model.latencyMs ?? 500;
      const bLatency = b.provider.latencyMs ?? b.model.latencyMs ?? 500;
      return aLatency - bLatency;
    }

    if (strategy === 'smartest') {
      const aScore = a.model.codingScore ?? (a.model.capabilities?.includes('reasoning') ? 92 : 80);
      const bScore = b.model.codingScore ?? (b.model.capabilities?.includes('reasoning') ? 92 : 80);
      return bScore - aScore;
    }

    // Default 'balanced':
    // Prioritize high codingScore, with bonus for provider diversity to prevent single-provider bottleneck
    const aDiffProvider = chain[0] && a.provider.id !== chain[0].provider.id ? 5 : 0;
    const bDiffProvider = chain[0] && b.provider.id !== chain[0].provider.id ? 5 : 0;
    const aScore = (a.model.codingScore ?? 85) + aDiffProvider;
    const bScore = (b.model.codingScore ?? 85) + bDiffProvider;
    return bScore - aScore;
  });

  return [...chain, ...candidates];
}

export function providerPayload(type:string,model:string,system:string,contents:any[]) {
 if(type==='gemini')return {contents,systemInstruction:{parts:[{text:system}]},generationConfig:{temperature:.7,responseMimeType:'application/json'}};
 if(type!=='ollama' && contents.some(c=>c.parts.some((p:any)=>p.inlineData)))throw Error('Visual input currently requires selecting a Gemini model. No image was sent.');
 const messages=[{role:'system',content:system},...contents.map(c=>({role:c.role==='model'?'assistant':'user',content:c.parts.map((p:any)=>p.text||'').join('\n'),...(type==='ollama' && c.parts.some((p:any)=>p.inlineData)?{images:c.parts.filter((p:any)=>p.inlineData).map((p:any)=>{if(!/^image\/(jpeg|png|webp)$/.test(p.inlineData.mimeType))throw Error('Local vision supports images, not PDFs. No file was sent.');return p.inlineData.data;})}:{})}))];
 return {model,messages,stream:false,...(type==='ollama'?{format:'json'}:{})};
}

export function providerText(type:string,response:any):string {
 const text=type==='gemini'?response?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join(''):type==='ollama'?response?.message?.content:response?.choices?.[0]?.message?.content;
 if(typeof text!=='string'||!text.trim())throw Error('Provider returned no reply. Check model compatibility or content restrictions.');
 return text;
}

/** Heavy = architecture/debugging reasoning; light = UI edits, scaffolding, completions, chat. */
export type TaskTier = 'heavy' | 'light';
const HEAVY_TASK = /\b(architect\w*|design (?:the|a|an) (?:system|module|api)|refactor\w*|debug\w*|root cause|stack ?trace|race condition|deadlock|memory leak|perf\w*|optimi[sz]\w*|security|vulnerab\w*|migrat\w*|concurren\w*|why (?:is|does|did)\b.*\b(?:fail|crash|break|error)\w*|crash\w*|exception|segfault|bug|regression|scal(?:e|ing|ability))\b|\b(?:theek karo|fix karo|kyu nahi chal|error aa raha)\b/iu;
const LIGHT_TASK = /\b(rename|color|colour|padding|margin|font|css|tailwind|style|button|header|navbar|layout|align|scaffold\w*|boilerplate|stub|template|snippet|complete (?:this|the)|autocomplete|typo|comment|docstring)\b|\b(?:chhota|bada|banao|daal do|hata do)\b/iu;
export function classifyTaskTier(prompt: string): TaskTier {
  if (HEAVY_TASK.test(prompt)) return 'heavy';
  if (LIGHT_TASK.test(prompt)) return 'light';
  // Long multi-part asks behave like design work; short ones like quick edits or chat.
  return prompt.length > 600 ? 'heavy' : 'light';
}
const GATEWAY_PROVIDERS = new Set(['openrouter']);
/** Providers whose payload adapter can carry image parts (see providerPayload). */
export const VISION_PROVIDERS = new Set(['gemini']);
/**
 * Hybrid routing: heavy work stays on the primary (selected) brain with the
 * smartest fallbacks behind it; light work goes to free gateway models first
 * and keeps the primary brain only as a fallback. Never adds paid routes.
 */
export function getTaskRoutedChain(
  prompt: string,
  selectedModel: AIModel | undefined,
  allModels: AIModel[] = INITIAL_MODELS,
  providers: CloudProvider[] = [],
  options?: { strategy?: RoutingStrategy; autoFallback?: boolean; vision?: boolean }
): { tier: TaskTier; chain: RouteCandidate[] } {
  const autoFallback = options?.autoFallback !== false;
  // Frame analysis is heavy inference: primary brain first, and only providers that can see.
  if (options?.vision) {
    const chain = getFallbackChain(selectedModel, allModels, providers, { strategy: autoFallback ? 'smartest' : options.strategy, autoFallback });
    return { tier: 'heavy', chain: chain.filter(c => VISION_PROVIDERS.has(c.provider.type) || (c.provider.type==='ollama' && isLocalVisionModel(c.model))) };
  }
  const tier = classifyTaskTier(prompt);
  if (tier === 'heavy' || !autoFallback) {
    const strategy = tier === 'heavy' && autoFallback ? 'smartest' : options?.strategy;
    return { tier, chain: getFallbackChain(selectedModel, allModels, providers, { strategy, autoFallback }) };
  }
  const chain = getFallbackChain(selectedModel, allModels, providers, options);
  const gateway = chain.filter(c => GATEWAY_PROVIDERS.has(c.provider.type));
  return { tier, chain: [...gateway, ...chain.filter(c => !GATEWAY_PROVIDERS.has(c.provider.type))] };
}

const PAID_POOL_KEY = 'axion.paidPoolProviders';
/** Paid providers Sir has explicitly allowed into automatic routing (billed per use). */
export function loadPaidPoolConsent(): Set<string> {
  try { const v = JSON.parse(globalThis.localStorage?.getItem(PAID_POOL_KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []); }
  catch { return new Set(); }
}
export function savePaidPoolConsent(types: Set<string>) {
  try { globalThis.localStorage?.setItem(PAID_POOL_KEY, JSON.stringify([...types])); } catch { /* storage unavailable */ }
}

const isLive = (p: CloudProvider) => !!p.configured && p.status !== 'error' && supportedProviders.includes(p.type);
/**
 * Unified execution pool: every connected key contributes its default models,
 * so switching and failover work across any added service. Free providers join
 * automatically; paid providers join only after explicit approval, and stay
 * selectable through the paid-model firewall otherwise.
 */
export function buildModelPool(models: AIModel[], providers: CloudProvider[], paidConsent: Set<string> = new Set()): AIModel[] {
  const pool = models.map(m => {
    const p = providerForModel(m, providers);
    return m.tier === 'paid_blocked' && p && isLive(p) && paidConsent.has(p.type) ? { ...m, tier: 'paid_allowed' as const } : m;
  });
  const known = new Set(pool.map(m => `${providerForModel(m, providers)?.type}:${(m.providerModelId || m.id).replace(/^models\//, '')}`));
  for (const p of providers) {
    if (!isLive(p) || !p.models?.length) continue;
    if (p.tier === 'paid' && !paidConsent.has(p.type)) continue;
    for (const modelId of p.models) {
      if (known.has(`${p.type}:${modelId}`)) continue;
      known.add(`${p.type}:${modelId}`);
      pool.push({
        id: `${p.type}:${modelId}`, name: `${p.name} · ${modelId}`, provider: p.type, providerModelId: modelId,
        tier: p.tier === 'paid' ? 'paid_allowed' : 'free', costPer1kTokens: p.tier === 'paid' ? 'Billed by provider' : 'Free tier',
        contextWindow: 'Provider dependent', status: 'untested', availability: 'requires_key'
      });
    }
  }
  return pool;
}

/** Local text-only models must never receive image payloads. */
export function isLocalVisionModel(model:AIModel):boolean {return model.capabilities?.includes('vision')===true || /(?:qwen[^/]*vl|llava|moondream|gemma3|vision)/i.test(model.providerModelId||model.id);}
