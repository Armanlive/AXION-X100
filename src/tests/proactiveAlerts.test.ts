import {it} from 'node:test';
import assert from 'node:assert/strict';
import {ProactiveAlertMonitor, mailAnnouncement, normalizeSettings, senderName, urgencyReason, speakLocally, type AlertSettings, type MailAlert} from '../services/proactiveAlerts.ts';

const mail = (id: string, from: string, subject: string, extra: Partial<MailAlert> = {}): MailAlert => ({id, from, subject, important: false, receivedMs: 1000, ...extra});
const on = (patch: Partial<AlertSettings> = {}) => normalizeSettings({enabled: true, vipSenders: ['boss@dhruvdesh.in'], ...patch});

function monitor(settings: AlertSettings, inbox: MailAlert[] | Error, offline = false) {
  const spoken: string[] = []; let seen: string[] = []; let fetches = 0;
  const m = new ProactiveAlertMonitor({
    fetchMail: async () => { fetches++; if (inbox instanceof Error) throw inbox; return inbox; },
    speak: async (t) => { spoken.push(t); return true; },
    settings: () => settings, offline: () => offline, readSeen: () => seen, writeSeen: (ids) => { seen = ids; },
  });
  return {m, spoken, fetches: () => fetches};
}

it('names senders and words alerts for one or many urgent mails', () => {
  assert.equal(senderName('"Priya Sharma" <priya@x.com>'), 'Priya Sharma');
  assert.equal(senderName('rahul.verma@x.com'), 'rahul verma');
  assert.equal(mailAnnouncement([mail('a', 'Priya <p@x.com>', 'Urgent: invoice')]), 'Boss, you have an urgent message from Priya: Urgent: invoice');
  const two = mailAnnouncement([mail('a', 'A <a@x.com>', 'old', {receivedMs: 1}), mail('b', 'Ravi <r@x.com>', 'see https://evil.test/x now', {receivedMs: 2})], 'Sir');
  assert.equal(two, 'Sir, you have 2 urgent messages. The latest is from Ravi: see a link now');
});

it('treats VIP senders and urgent words as urgent, Gmail Important only when enabled', () => {
  const s = on();
  assert.equal(urgencyReason(mail('1', 'GM <BOSS@dhruvdesh.in>', 'hello'), s), 'vip');
  assert.equal(urgencyReason(mail('2', 'x@y.com', 'URGENT: stock report'), s), 'keyword');
  assert.equal(urgencyReason(mail('3', 'x@y.com', 'Zaroori meeting kal'), s), 'keyword');
  assert.equal(urgencyReason(mail('4', 'x@y.com', 'Non-urgentish newsletter'), s), null, 'whole words only');
  assert.equal(urgencyReason(mail('5', 'x@y.com', 'Weekly digest', {important: true}), s), null);
  assert.equal(urgencyReason(mail('5', 'x@y.com', 'Weekly digest', {important: true}), on({gmailImportant: true})), 'important');
});

it('speaks once per new urgent mail and never repeats', async () => {
  const inbox = [mail('a', 'boss@dhruvdesh.in', 'Call me'), mail('b', 'news@x.com', 'Sale today')];
  const {m, spoken} = monitor(on(), inbox);
  assert.equal((await m.checkMail()).length, 1);
  await m.checkMail();
  assert.deepEqual(spoken, ['Boss, you have an urgent message from boss: Call me']);
});

it('stays quiet when disabled, in offline mode, or when Gmail fails', async () => {
  const inbox = [mail('a', 'boss@dhruvdesh.in', 'Call me')];
  const off = monitor(on({enabled: false}), inbox); await off.m.checkMail();
  const local = monitor(on(), inbox, true); await local.m.checkMail();
  const broken = monitor(on(), new Error('Connect Gmail in Plugins first')); await broken.m.checkMail();
  assert.deepEqual([...off.spoken, ...local.spoken, ...broken.spoken], []);
  assert.equal(off.fetches() + local.fetches(), 0, 'no Gmail request when off or offline');
  assert.equal(broken.m.status.lastError, 'Connect Gmail in Plugins first');
});

it('warns about low battery once per discharge and announces network changes', async () => {
  const {m, spoken} = monitor(on(), []);
  await m.battery(0.5, false); await m.battery(0.14, false); await m.battery(0.12, false);
  await m.battery(0.6, true); await m.battery(0.1, false);
  await m.network(false);
  assert.deepEqual(spoken, [
    'Boss, battery is at 14 percent. Please plug in the charger.',
    'Boss, battery is at 10 percent. Please plug in the charger.',
    'Boss, the internet connection was lost. I will keep working locally.',
  ]);
  const quiet = monitor(on({system: false}), []); await quiet.m.network(true); await quiet.m.battery(0.05, false);
  assert.deepEqual(quiet.spoken, []);
});

it('normalizes stored settings and only ever uses on-device voices', async () => {
  const s = normalizeSettings({intervalMinutes: 0.5, vipSenders: [' a ', 3, ''] as any, title: ''});
  assert.equal(s.intervalMinutes, 2); assert.deepEqual(s.vipSenders, ['a']); assert.equal(s.title, 'Boss'); assert.equal(s.enabled, false);
  const spoken: string[] = [];
  const g = globalThis as any;
  g.SpeechSynthesisUtterance = class { text: string; voice: any; lang = ''; rate = 1; volume = 1; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } };
  g.speechSynthesis = {getVoices: () => [{name: 'Cloud', lang: 'en-IN', localService: false}], speak: (u: any) => { spoken.push(u.voice.name); u.onend(); }};
  assert.equal(await speakLocally('hello'), false, 'cloud-only voices are not used');
  g.speechSynthesis.getVoices = () => [{name: 'Cloud', lang: 'en-IN', localService: false}, {name: 'Microsoft Heera', lang: 'en-IN', localService: true}];
  assert.equal(await speakLocally('hello'), true);
  assert.deepEqual(spoken, ['Microsoft Heera']);
  delete g.speechSynthesis; delete g.SpeechSynthesisUtterance;
});
