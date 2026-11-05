/**
 * Proactive voice alerts: AXION watches for urgent events (unread Gmail from VIP senders
 * or with urgent words, low battery, lost network) and speaks a short summary through the
 * PC's own voices. Free and local: speech uses the OS voices behind Web Speech (Windows
 * SAPI in the desktop app), never a cloud TTS, and the Gmail token stays in the native
 * vault. Only settings and the ids of already-announced mail are stored.
 */
import { requiresLocalInference } from '../utils/hybridMode.ts';

export interface MailAlert { id: string; from: string; subject: string; important: boolean; receivedMs: number }

export interface AlertSettings {
  enabled: boolean;
  gmail: boolean;
  system: boolean;
  /** Also treat mail Gmail marks IMPORTANT as urgent (noisier). */
  gmailImportant: boolean;
  vipSenders: string[];
  keywords: string[];
  intervalMinutes: number;
  /** How AXION addresses the user in alerts. */
  title: string;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: false, gmail: true, system: true, gmailImportant: false,
  vipSenders: [], keywords: ['urgent', 'asap', 'immediately', 'emergency', 'zaroori', 'turant'],
  intervalMinutes: 5, title: 'Boss',
};

const SETTINGS_KEY = 'axion.proactiveAlerts.v1';
const SEEN_KEY = 'axion.proactiveAlerts.seen.v1';
const MAX_SEEN = 300;

const cleanList = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 50) : [];

export function normalizeSettings(raw: Partial<AlertSettings> | null | undefined): AlertSettings {
  const r = raw ?? {};
  const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;
  const interval = Number(r.intervalMinutes);
  return {
    enabled: bool(r.enabled, DEFAULT_ALERT_SETTINGS.enabled),
    gmail: bool(r.gmail, DEFAULT_ALERT_SETTINGS.gmail),
    system: bool(r.system, DEFAULT_ALERT_SETTINGS.system),
    gmailImportant: bool(r.gmailImportant, DEFAULT_ALERT_SETTINGS.gmailImportant),
    vipSenders: r.vipSenders === undefined ? [] : cleanList(r.vipSenders),
    keywords: r.keywords === undefined ? [...DEFAULT_ALERT_SETTINGS.keywords] : cleanList(r.keywords),
    intervalMinutes: Number.isFinite(interval) ? Math.min(60, Math.max(2, Math.round(interval))) : DEFAULT_ALERT_SETTINGS.intervalMinutes,
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 30) : DEFAULT_ALERT_SETTINGS.title,
  };
}

const listeners = new Set<(s: AlertSettings) => void>();
export function loadAlertSettings(): AlertSettings {
  try { return normalizeSettings(JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY) ?? 'null')); } catch { return normalizeSettings(null); }
}
export function saveAlertSettings(patch: Partial<AlertSettings>): AlertSettings {
  const next = normalizeSettings({ ...loadAlertSettings(), ...patch });
  try { globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* session only */ }
  for (const fn of listeners) fn(next);
  return next;
}
export function onAlertSettingsChange(fn: (s: AlertSettings) => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

// ---------- rules and wording ----------

/** "Priya Sharma <priya@x.com>" -> "Priya Sharma"; "priya@x.com" -> "priya". */
export function senderName(from: string): string {
  const named = from.replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
  if (named && !named.includes('@')) return named.slice(0, 60);
  const email = (from.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? named).toLowerCase();
  return (email.split('@')[0] || 'someone').replace(/[._-]+/g, ' ').trim().slice(0, 60) || 'someone';
}

const words = (text: string) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}@.]+/gu, ' ')} `;

/** Why a mail is urgent under the user's rules, or null when it is not. */
export function urgencyReason(mail: MailAlert, s: AlertSettings): 'vip' | 'keyword' | 'important' | null {
  const from = mail.from.toLowerCase();
  if (s.vipSenders.some((v) => v && from.includes(v.toLowerCase()))) return 'vip';
  const subject = words(mail.subject);
  if (s.keywords.some((k) => k && subject.includes(` ${k.toLowerCase()} `))) return 'keyword';
  if (s.gmailImportant && mail.important) return 'important';
  return null;
}

/** Speakable subject: no links, no long codes, short. */
function speakableSubject(subject: string): string {
  const clean = subject.replace(/https?:\/\/\S+/g, 'a link').replace(/\b[A-Za-z0-9_-]{24,}\b/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? `${clean.slice(0, 87).trim()}…` : clean;
}

/** One sentence for one or several urgent mails (newest first). */
export function mailAnnouncement(mails: MailAlert[], title = 'Boss'): string {
  if (!mails.length) return '';
  const [latest] = [...mails].sort((a, b) => b.receivedMs - a.receivedMs);
  const subject = speakableSubject(latest.subject);
  const about = subject ? `: ${subject}` : '.';
  if (mails.length === 1) return `${title}, you have an urgent message from ${senderName(latest.from)}${about}`;
  return `${title}, you have ${mails.length} urgent messages. The latest is from ${senderName(latest.from)}${about}`;
}

// ---------- local speech ----------

/** Speaks with an on-device voice only. Resolves false when no local voice can play. */
export function speakLocally(text: string, lang = 'en-IN'): Promise<boolean> {
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  const Utterance = (globalThis as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance;
  if (!text.trim() || !synth || !Utterance) return Promise.resolve(false);
  const pick = () => {
    const local = synth.getVoices().filter((v) => v.localService);
    return local.find((v) => v.lang === lang) ?? local.find((v) => v.lang.startsWith('en')) ?? local[0];
  };
  return new Promise((resolve) => {
    const go = () => {
      const voice = pick();
      if (!voice) { resolve(false); return; } // never fall back to a network voice
      const u = new Utterance(text);
      u.voice = voice; u.lang = voice.lang; u.rate = 1; u.volume = 1;
      u.onend = () => resolve(true); u.onerror = () => resolve(false);
      try { synth.speak(u); } catch { resolve(false); }
    };
    if (synth.getVoices().length) go();
    else { const t = setTimeout(go, 1200); synth.addEventListener?.('voiceschanged', () => { clearTimeout(t); go(); }, { once: true }); }
  });
}

// ---------- monitor ----------

export interface AlertDeps {
  fetchMail(): Promise<MailAlert[]>;
  speak(text: string): Promise<boolean>;
  settings(): AlertSettings;
  /** Offline mode: no Gmail checks (local system alerts continue). */
  offline(): boolean;
  readSeen(): string[];
  writeSeen(ids: string[]): void;
}

export interface AlertStatus { lastCheck: number; lastSpoken: string; lastError: string }

export class ProactiveAlertMonitor {
  status: AlertStatus = { lastCheck: 0, lastSpoken: '', lastError: '' };
  private batteryWarned = false;
  private deps: AlertDeps;
  constructor(deps: AlertDeps) { this.deps = deps; }

  private async say(text: string) {
    if (!text) return;
    const ok = await this.deps.speak(text);
    this.status.lastSpoken = text;
    if (!ok) this.status.lastError = 'No local voice could play. Install a Windows voice in Settings → Time & language → Speech.';
  }

  /** Checks Gmail once; speaks one combined alert for new urgent mail. */
  async checkMail(): Promise<MailAlert[]> {
    const s = this.deps.settings();
    if (!s.enabled || !s.gmail || this.deps.offline()) return [];
    let mails: MailAlert[];
    try { mails = await this.deps.fetchMail(); this.status.lastError = ''; }
    catch (e) { this.status.lastError = e instanceof Error ? e.message : String(e); return []; }
    finally { this.status.lastCheck = Date.now(); }
    const seen = new Set(this.deps.readSeen());
    const fresh = mails.filter((m) => !seen.has(m.id));
    const urgent = fresh.filter((m) => urgencyReason(m, s));
    if (fresh.length) this.deps.writeSeen([...seen, ...fresh.map((m) => m.id)].slice(-MAX_SEEN));
    if (urgent.length) await this.say(mailAnnouncement(urgent, s.title));
    return urgent;
  }

  /** Low battery once per discharge (re-armed after charging or above 25%). */
  async battery(level: number, charging: boolean) {
    const s = this.deps.settings();
    if (charging || level > 0.25) { this.batteryWarned = false; return; }
    if (!s.enabled || !s.system || this.batteryWarned || level > 0.15) return;
    this.batteryWarned = true;
    await this.say(`${s.title}, battery is at ${Math.round(level * 100)} percent. Please plug in the charger.`);
  }

  async network(online: boolean) {
    const s = this.deps.settings();
    if (!s.enabled || !s.system) return;
    await this.say(online ? `${s.title}, the internet connection is back.` : `${s.title}, the internet connection was lost. I will keep working locally.`);
  }
}

// ---------- app wiring ----------

function readSeen(): string[] { try { const v = JSON.parse(globalThis.localStorage?.getItem(SEEN_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } }
function writeSeen(ids: string[]) { try { globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* best effort */ } }

async function fetchMailNative(): Promise<MailAlert[]> {
  const { invoke, isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) throw new Error('Gmail alerts need the AXION desktop app.');
  return invoke<MailAlert[]>('gmail_unread_alerts');
}

export const proactiveAlerts = new ProactiveAlertMonitor({
  fetchMail: fetchMailNative, speak: (t) => speakLocally(t), settings: loadAlertSettings,
  offline: () => requiresLocalInference(), readSeen, writeSeen,
});

let timer: ReturnType<typeof setInterval> | undefined;
let started = false;

/** Starts background checks; safe to call once at app start. Re-arms when settings change. */
export function startProactiveAlerts(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const arm = (s: AlertSettings) => {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (!s.enabled) return;
    void proactiveAlerts.checkMail();
    timer = setInterval(() => void proactiveAlerts.checkMail(), s.intervalMinutes * 60_000);
  };
  arm(loadAlertSettings());
  onAlertSettingsChange(arm);
  window.addEventListener('online', () => void proactiveAlerts.network(true));
  window.addEventListener('offline', () => void proactiveAlerts.network(false));
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener(t: string, f: () => void): void }> };
  nav.getBattery?.().then((b) => {
    const check = () => void proactiveAlerts.battery(b.level, b.charging);
    b.addEventListener('levelchange', check); b.addEventListener('chargingchange', check); check();
  }).catch(() => { /* no battery API */ });
}
