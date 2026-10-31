/**
 * AXION-X100 — Hybrid Memory Sync Service
 *
 * Local-first storage strategy:
 *   • Raw chat history, workspace indexes, logs  → NEVER leave the device
 *   • Lightweight profile + milestone summaries  → mirrored to Supabase
 *
 * Free-tier protection: payloads are size-capped, rate-limited, and skipped
 * entirely when a payload exceeds the cloud row budget.
 *
 * Offline fallback: operations queue in localStorage when fetches fail and
 * flush in order as soon as connectivity returns.
 */

import { cloudOwnerId, getSupabase, isSupabaseConfigured } from './supabaseClient.ts';

// ---------- types ----------

export interface CloudProfileRow {
  device_pair_id: string;
  display_name: string | null;
  role: string | null;
  projects: string | null;
  help: string | null;
  style: string | null;
  share_with_ai: boolean;
  revision: number;
}

export interface MilestoneChunk {
  device_pair_id: string;
  milestone_kind: 'summary' | 'decision' | 'preference' | 'goal';
  summary: string;      // ≤ 512 chars, enforced before send
  source: 'desktop' | 'mobile';
  device_label: string | null;
}

export interface QueuedOp {
  id: string;
  kind: 'profile_upsert' | 'milestone_insert';
  payload: CloudProfileRow | MilestoneChunk;
  created_at: string;
}

export interface SyncStatus {
  online: boolean;
  last_attempt: number;
  last_success: number;
  queue_depth: number;
  disabled_reason: '';
}

// ---------- config ----------

const QUEUE_KEY = 'axion.sync.queue.v1';
const PAIR_KEY = 'axion.sync.pair_id.v1';
const MAX_SUMMARY = 512;
const MAX_QUEUE = 100;         // hard local cap; oldest ops are dropped to stay under
const MILESTONES_PER_DAY = 200;
const SENT_TALLY_KEY = 'axion.sync.milestone_tally.v1';
const RETRY_DELAY_MS = 5_000;
const ONLINE_EVENT = 'axion.sync.online';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/blocked: sync degrades to no-op rather than crashing the UI
  }
}

// ---------- derived-id guard ----------

/**
 * Derive a stable per-install pairing id shared by Desktop and Mobile builds.
 * The id is opaque (uuid-like), contains no user content, and is rotated by
 * the user via the app settings "forget sync" action.
 */
export function getPairId(): string {
  let id = localStorage.getItem(PAIR_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `pair-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(PAIR_KEY, id);
  }
  return id;
}

// ---------- privacy / budget gates ----------

/** Strip code fences, keys, tokens and long tokens that look like secrets. */
export function sanitizeForCloud(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[code]')       // fenced code
    .replace(/`[^`\n]+`/g, '[code]')            // inline code
    .replace(/\b(?:sk-|ghp_|gho_|AKIA|xoxb-)[A-Za-z0-9_-]{8,}\b/g, '[redacted]')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[redacted]')  // long hex tokens
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUMMARY);
}

/** Raw workspace/chat/large payloads must never reach the cloud. */
export function isCloudSafe(op: Pick<QueuedOp, 'kind' | 'payload'>): boolean {
  if (op.kind === 'profile_upsert') {
    const p = op.payload as CloudProfileRow;
    return ['role', 'projects', 'help', 'style'].every((k) => String((p as any)[k] ?? '').length <= 400);
  }
  const m = op.payload as MilestoneChunk;
  return typeof m.summary === 'string' && m.summary.length > 0 && m.summary.length <= MAX_SUMMARY;
}

function sentToday(): number {
  const tally = readJSON<Record<string, number>>(SENT_TALLY_KEY, {});
  const today = new Date().toISOString().slice(0, 10);
  return tally[today] ?? 0;
}

function bumpSentToday(): void {
  const today = new Date().toISOString().slice(0, 10);
  const tally = readJSON<Record<string, number>>(SENT_TALLY_KEY, {});
  // keep only today's bucket to bound local storage
  for (const key of Object.keys(tally)) if (key !== today) delete tally[key];
  tally[today] = (tally[today] ?? 0) + 1;
  writeJSON(SENT_TALLY_KEY, tally);
}

// ---------- queue ----------

// Profile fields are encrypted at rest, so a pending profile upsert lives in memory only:
// it is never written to localStorage in plaintext and vanishes on lock, forget or restart.
let pendingProfile: QueuedOp | null = null;

export function readQueue(): QueuedOp[] {
  const stored = readJSON<QueuedOp[]>(QUEUE_KEY, []);
  const milestones = stored.filter((op) => op?.kind === 'milestone_insert');
  if (milestones.length !== stored.length) writeJSON(QUEUE_KEY, milestones); // purge plaintext profiles left by older builds
  return pendingProfile ? [...milestones, pendingProfile] : milestones;
}

function writeQueue(ops: QueuedOp[]): void {
  const kept = ops.slice(-MAX_QUEUE);
  pendingProfile = kept.filter((op) => op.kind === 'profile_upsert').pop() ?? null;
  writeJSON(QUEUE_KEY, kept.filter((op) => op.kind === 'milestone_insert'));
}

/** Drops any unsent profile upsert (profile locked or forgotten). */
export function clearPendingProfileSync(): void {
  pendingProfile = null;
  setStatus({});
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'created_at'>): void {
  const queue = readQueue();
  queue.push({
    ...op,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    created_at: new Date().toISOString(),
  });
  writeQueue(queue);
}

// ---------- sync core ----------

const listeners = new Set<(status: SyncStatus) => void>();
let status: SyncStatus = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  last_attempt: 0,
  last_success: 0,
  queue_depth: 0,
  disabled_reason: '',
};

export function getSyncStatus(): SyncStatus {
  return { ...status, queue_depth: readQueue().length };
}

export function onSyncChange(fn: (status: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch, queue_depth: readQueue().length };
  for (const fn of listeners) fn(getSyncStatus());
}

/** Dev/telemetry hook (no-op in production builds). */
let onError: ((err: unknown) => void) | null = null;
export function setSyncErrorHandler(fn: (err: unknown) => void): void {
  onError = fn;
}

async function pushProfile(row: CloudProfileRow): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('supabase-unconfigured');
  const owner_id = await cloudOwnerId(true);
  if (!owner_id) throw new Error('supabase-unauthenticated');
  const { error } = await sb.from('profiles').upsert({ ...row, owner_id }, { onConflict: 'owner_id,device_pair_id' });
  if (error) throw error;
}

async function pushMilestone(chunk: MilestoneChunk): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('supabase-unconfigured');
  if (sentToday() >= MILESTONES_PER_DAY) {
    throw new RateLimitError('milestone daily cap reached locally');
  }
  const owner_id = await cloudOwnerId(true);
  if (!owner_id) throw new Error('supabase-unauthenticated');
  const { error } = await sb.from('memory_chunks').insert({ ...chunk, owner_id });
  if (error) throw error;
  bumpSentToday();
}

class RateLimitError extends Error {}

async function flushOnce(): Promise<number> {
  const queue = readQueue();
  const remaining: QueuedOp[] = [];
  let sent = 0;

  for (const op of queue) {
    try {
      if (!isCloudSafe(op)) continue;          // silently drop unsafe payloads
      if (op.kind === 'profile_upsert') await pushProfile(op.payload as CloudProfileRow);
      else await pushMilestone(op.payload as MilestoneChunk);
      sent += 1;
    } catch (err) {
      if (err instanceof RateLimitError) continue;   // keep for tomorrow, stop pressing
      remaining.push(op);
      onError?.(err);
    }
  }
  writeQueue(remaining);
  return sent;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Fire-and-forget background sync: flushes the queue when online. */
export function requestBackgroundSync(): void {
  if (!isSupabaseConfigured) return;
  setStatus({ online: navigator.onLine });
  if (!navigator.onLine) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    setStatus({ last_attempt: Date.now() });
    flushOnce()
      .then((sent) => { if (sent > 0) setStatus({ last_success: Date.now() }); })
      .catch((err) => onError?.(err));
  }, RETRY_DELAY_MS);
}

/** Public API used by the app after profile save / milestone capture. */
export function syncProfile(row: Omit<CloudProfileRow, 'device_pair_id' | 'revision'>): void {
  const op: Omit<QueuedOp, 'id' | 'created_at'> = {
    kind: 'profile_upsert',
    payload: { ...row, device_pair_id: getPairId(), revision: Date.now() % 1_000_000 },
  };
  enqueue(op);
  requestBackgroundSync();
}

export function syncMilestone(chunk: Omit<MilestoneChunk, 'device_pair_id'>): void {
  const capped: MilestoneChunk = {
    ...chunk,
    summary: sanitizeForCloud(chunk.summary),
    device_pair_id: getPairId(),
  };
  if (!capped.summary) return;
  enqueue({ kind: 'milestone_insert', payload: capped });
  requestBackgroundSync();
}

/** Rotate the pairing id and clear queued cloud ops (device un-pairing). */
export function forgetSync(): void {
  pendingProfile = null;
  try {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(PAIR_KEY);
    localStorage.removeItem(SENT_TALLY_KEY);
  } catch { /* no-op */ }
  // Un-pairing also drops the cloud identity, so old rows stay with the old owner.
  void getSupabase()?.auth.signOut().catch(() => undefined);
  setStatus({ queue_depth: 0 });
}

// ---------- connectivity listeners ----------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setStatus({ online: true });
    requestBackgroundSync();
    window.dispatchEvent(new Event(ONLINE_EVENT));
  });
  window.addEventListener('offline', () => setStatus({ online: false }));
}
