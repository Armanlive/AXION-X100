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
      // A persisted auth session is what the server's owner-only RLS checks against.
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'axion.sync.auth.v1' },
      db: { schema: 'public' },
      global: { headers: { 'x-axion-client': 'axion-x100-v1' } },
    });
  }
  return client;
}

/**
 * The signed-in user id that owns this device's cloud rows, or null. Rows are protected
 * by owner-only RLS (supabase/migrations/0002_owner_rls.sql), so nothing is read or
 * written without a session. With `create`, signs in anonymously when no session exists
 * (requires "Anonymous sign-ins" enabled in the Supabase project).
 */
export async function cloudOwnerId(create = false): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    if (data.session?.user?.id) return data.session.user.id;
    if (!create) return null;
    const { data: signedIn, error } = await sb.auth.signInAnonymously();
    return error ? null : signedIn.user?.id ?? null;
  } catch {
    return null;
  }
}
