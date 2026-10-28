/**
 * AXION-X100 — Supabase Cloud Sync Client
 *
 * Reads credentials strictly from Vite environment variables (never hardcoded).
 * The publishable/anon key is by design public; the SERVICE_ROLE key must never
 * be referenced here — it stays server-side in `.env` without a VITE_ prefix.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Vite injects import.meta.env; node:test and plain node runs do not, so read
// defensively and treat a missing env as "cloud sync disabled" (local-first).
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const URL = env.VITE_SUPABASE_URL as string | undefined;
const ANON = env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(URL && ANON);

let client: SupabaseClient | null = null;

/** Lazily create the browser client. Returns null when unconfigured/offline-first. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(URL!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
      global: { headers: { 'x-axion-client': 'axion-x100-v1' } },
    });
  }
  return client;
}
