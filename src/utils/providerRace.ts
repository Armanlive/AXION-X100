/**
 * Faster replies: instead of waiting up to 90s per provider, one after another, AXION
 * starts the best candidate and, if it is slow, starts the next one alongside it; the
 * first good answer wins. Providers that just failed (rate limit, bad key, timeout) are
 * remembered and skipped for a while, so a dead provider never costs time twice.
 */
export interface RaceCandidate {
  /** Stable id for health tracking, e.g. "openrouter:qwen/qwen-2.5-coder-32b". */
  key: string;
  /** Hedging may start this one early; paid candidates only run as a plain fallback. */
  free: boolean;
  run: (timeoutSecs: number) => Promise<string>;
}

export interface RaceOptions {
  /** Start the next candidate if nothing has answered after this long. */
  hedgeMs: number;
  /** At most this many requests at once. */
  maxParallel: number;
  /** Per-attempt timeout for the first candidate and for the others. */
  firstTimeoutSecs: number;
  otherTimeoutSecs: number;
  now?: () => number;
  onStart?: (index: number, reason: 'first' | 'hedge' | 'failover') => void;
}

export const DEFAULT_RACE: RaceOptions = { hedgeMs: 8000, maxParallel: 3, firstTimeoutSecs: 60, otherTimeoutSecs: 45 };

interface Health { cooldownUntil: number; failures: number; latencyMs?: number }
const HEALTH_KEY = 'axion.providerHealth.v1';
let health: Record<string, Health> = load();

function load(): Record<string, Health> {
  try { return JSON.parse(globalThis.localStorage?.getItem(HEALTH_KEY) ?? '{}') ?? {}; } catch { return {}; }
}
function save() {
  try { globalThis.localStorage?.setItem(HEALTH_KEY, JSON.stringify(health)); } catch { /* storage unavailable */ }
}

/** How long to skip a provider after this error. */
export function cooldownFor(error: unknown, failures: number): number {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code = Number((error as { status?: number })?.status || (error as { code?: number })?.code);
  if (code === 401 || code === 403 || /401|403|unauthori[sz]ed|invalid api key|api_key_invalid|not configured/.test(text)) return 30 * 60_000;
  if (code === 429 || /429|rate.?limit|quota|too many requests/.test(text)) return 3 * 60_000;
  return Math.min(10 * 60_000, 60_000 * 2 ** Math.max(0, failures - 1)); // timeouts, network, 5xx: 1, 2, 4… minutes
}

export function recordSuccess(key: string, ms: number) {
  const h = health[key];
  health[key] = { cooldownUntil: 0, failures: 0, latencyMs: h?.latencyMs ? Math.round(h.latencyMs * 0.6 + ms * 0.4) : ms };
  save();
}

export function recordFailure(key: string, error: unknown, now = Date.now()) {
  const failures = (health[key]?.failures ?? 0) + 1;
  health[key] = { ...health[key], failures, cooldownUntil: now + cooldownFor(error, failures) };
  save();
}

export function resetProviderHealth() { health = {}; save(); }
export function healthOf(key: string): Health | undefined { return health[key]; }

/**
 * Healthy candidates first, in the router's order; for light tasks the ones known to
 * answer fast move up. Cooling-down candidates go last rather than disappearing, so a
 * request still runs when every provider has failed recently.
 */
export function orderCandidates<T extends { key: string }>(candidates: T[], light: boolean, now = Date.now()): T[] {
  const ready = candidates.filter((c) => (health[c.key]?.cooldownUntil ?? 0) <= now);
  const cooling = candidates.filter((c) => (health[c.key]?.cooldownUntil ?? 0) > now)
    .sort((a, b) => (health[a.key]?.cooldownUntil ?? 0) - (health[b.key]?.cooldownUntil ?? 0));
  if (light) {
    const latency = (c: T, i: number) => health[c.key]?.latencyMs ?? 12_000 + i; // unknown: keep router order
    ready.sort((a, b) => latency(a, ready.indexOf(a)) - latency(b, ready.indexOf(b)));
  }
  return [...ready, ...cooling];
}

/** Runs candidates as a hedged race; resolves with the first non-empty answer. */
export function raceCandidates(candidates: RaceCandidate[], options: RaceOptions = DEFAULT_RACE): Promise<{ index: number; text: string }> {
  const now = options.now ?? Date.now;
  return new Promise((resolve, reject) => {
    if (!candidates.length) { reject(new Error('No AI model is available')); return; }
    const inFlight = new Set<number>();
    let next = 0;
    let done = false;
    let lastError: unknown = new Error('No AI model answered');
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => { done = true; if (hedgeTimer) clearTimeout(hedgeTimer); };
    const armHedge = () => {
      if (hedgeTimer) clearTimeout(hedgeTimer);
      if (next >= candidates.length) return;
      hedgeTimer = setTimeout(() => {
        // Only a free candidate is started early; a paid one waits for a real failure.
        if (!done && inFlight.size < options.maxParallel && next < candidates.length && candidates[next].free) start('hedge');
      }, options.hedgeMs);
    };
    const start = (reason: 'first' | 'hedge' | 'failover') => {
      if (done || next >= candidates.length) return;
      const index = next++;
      const candidate = candidates[index];
      inFlight.add(index);
      options.onStart?.(index, reason);
      const began = now();
      candidate.run(index === 0 ? options.firstTimeoutSecs : options.otherTimeoutSecs)
        .then((text) => {
          if (!text.trim()) throw new Error('Empty provider response');
          inFlight.delete(index);
          recordSuccess(candidate.key, now() - began);
          if (!done) { finish(); resolve({ index, text }); }
        })
        .catch((error) => {
          inFlight.delete(index);
          recordFailure(candidate.key, error);
          lastError = error;
          if (done) return;
          if (next < candidates.length) start('failover');
          else if (inFlight.size === 0) { finish(); reject(lastError); }
        });
      armHedge();
    };
    start('first');
  });
}
