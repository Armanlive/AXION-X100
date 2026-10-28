/** Offline is an inference boundary: never silently send local prompts to cloud. */
export type InferenceMode = 'online' | 'offline';
const KEY = 'axion.inferenceMode.v1';
let mode: InferenceMode = 'online';
const listeners = new Set<() => void>();
export function onInferenceModeChange(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
try { if (globalThis.localStorage?.getItem(KEY) === 'offline') mode = 'offline'; } catch { /* storage unavailable */ }
export function getInferenceMode(): InferenceMode { return mode; }
export function setInferenceMode(next: InferenceMode): void {
  mode = next;
  for (const listener of listeners) listener();
  try { globalThis.localStorage?.setItem(KEY, next); } catch { /* session still works */ }
}
export function requiresLocalInference(connected = globalThis.navigator?.onLine !== false): boolean {
  return mode === 'offline' || !connected;
}
export function detectModeCommand(prompt: string): InferenceMode | null {
  const text = prompt.trim().replace(/^axion[,!:\s]+/i, '').replace(/[.!?]+$/, '').trim();
  if (/^(?:(?:please )?(?:switch|go|set)(?: to)? (?:offline|local)(?: mode)?|use (?:local|offline)(?: mode)?)$/i.test(text)) return 'offline';
  if (/^(?:(?:please )?(?:switch|go|set)(?: to)? (?:online|cloud)(?: mode)?|use (?:cloud|online)(?: mode)?)$/i.test(text)) return 'online';
  return null;
}
export function assertInferenceAllowed(provider: string): void {
  if (requiresLocalInference() && provider !== 'ollama') throw new Error('Offline mode: cloud inference is disabled. Connect Ollama in Cloud Brain.');
}
