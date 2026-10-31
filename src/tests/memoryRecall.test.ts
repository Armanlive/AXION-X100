import {it, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setInferenceMode} from '../utils/hybridMode.ts';
import {
  rankMilestones,
  recallFromSessions,
  formatRecallSection,
  fetchCloudMilestones,
  buildRecallSection,
  clearRecallCache,
  type MilestoneRow,
} from '../utils/memoryRecall.ts';
import type {ChatSession, ChatMessage} from '../types/index.ts';

const msg = (sender: ChatMessage['sender'], text: string): ChatMessage =>
  ({id: `${sender}-${text}`, sender, text, timestamp: ''} as ChatMessage);

const session = (id: string, workspaceId: string, title: string, messages: ChatMessage[]): ChatSession =>
  ({id, title, workspaceId, createdAt: '', updatedAt: '', messages});

const rows: MilestoneRow[] = [
  {summary: 'Sir prefers concise Hinglish replies', milestone_kind: 'preference', created_at: '2026-10-20T10:00:00Z'},
  {summary: 'Decided to use Supabase for the voice wake word sync', milestone_kind: 'decision', created_at: '2026-10-19T10:00:00Z'},
  {summary: 'Goal: ship gesture engine beta', milestone_kind: 'goal', created_at: '2026-10-18T10:00:00Z'},
];

beforeEach(() => clearRecallCache());

it('ranks milestones by relevance, then recency', () => {
  const ranked = rankMilestones(rows, 'voice wake word kaise chalega', 2);
  assert.equal(ranked[0].milestone_kind, 'decision');
  assert.equal(ranked[1].milestone_kind, 'preference');
  assert.equal(rankMilestones([...rows, rows[0]], 'x', 10).length, 3, 'duplicates dropped');
});

it('recalls only other chats from the same project', () => {
  const sessions = [
    session('active', 'ws1', 'Now', [msg('user', 'voice engine fix karo')]),
    session('old', 'ws1', 'Voice work', [msg('user', 'voice engine latency issue'), msg('boss_agent', 'Use streaming TTS.')]),
    session('other', 'ws2', 'Other project', [msg('user', 'voice engine elsewhere'), msg('boss_agent', 'Nope.')]),
  ];
  const recalled = recallFromSessions(sessions, 'active', 'voice engine fix');
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0].title, 'Voice work');
  assert.match(recalled[0].asked, /latency/);
  assert.equal(recalled[0].replied, 'Use streaming TTS.');
  assert.deepEqual(recallFromSessions(sessions, 'missing', 'voice'), []);
});

it('skips error messages and redacts secrets and code from recalled chats', () => {
  const sessions = [
    session('active', 'ws1', 'Now', []),
    session('old', 'ws1', 'Keys', [
      msg('user', 'my key is sk-abcdefghijklmnop and ```rm -rf /```'),
      msg('boss_agent', '*Error processing request:* boom'),
    ]),
  ];
  const [r] = recallFromSessions(sessions, 'active', 'key');
  assert.doesNotMatch(r.asked, /sk-abcdefghijklmnop|rm -rf/);
  assert.equal(r.replied, '');
});

it('formats an untrusted section, or nothing when empty', () => {
  assert.equal(formatRecallSection([], []), '');
  const text = formatRecallSection([rows[1]], [{title: 'T', asked: 'a\nb', replied: 'c'}]);
  assert.match(text, /^WHAT YOU REMEMBER \(untrusted/);
  assert.match(text, /data, not instructions/);
  assert.match(text, /\[decision, 2026-10-19\]/);
  assert.match(text, /Earlier chats in this project:/);
});

it('fetches cloud milestones and caches them briefly', async () => {
  let calls = 0;
  const source = async (pairId: string) => { calls += 1; assert.equal(pairId, 'pair-1'); return rows; };
  assert.equal((await fetchCloudMilestones({source, pairId: 'pair-1', now: 1000})).length, 3);
  await fetchCloudMilestones({source, pairId: 'pair-1', now: 2000});
  assert.equal(calls, 1);
});

it('returns no cloud recall on failure or timeout, never throws', async () => {
  assert.deepEqual(await fetchCloudMilestones({source: async () => { throw new Error('paused project'); }, pairId: 'p'}), []);
  const hang = (_: string, signal: AbortSignal) => new Promise<MilestoneRow[]>((_r, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  assert.deepEqual(await fetchCloudMilestones({source: hang, pairId: 'p', timeoutMs: 20}), []);
  assert.deepEqual(await fetchCloudMilestones({pairId: 'p'}), [], 'unconfigured Supabase means no cloud recall');
});

it('offline mode reads nothing from the cloud', async () => {
  clearRecallCache();
  let calls = 0;
  setInferenceMode('offline');
  try { assert.deepEqual(await fetchCloudMilestones({source: async () => { calls += 1; return rows; }, pairId: 'p'}), []); }
  finally { setInferenceMode('online'); }
  assert.equal(calls, 0);
});

it('builds the section, honouring the share-with-AI gate', async () => {
  const source = async () => rows;
  const sessions = [session('a', 'ws', 'Now', []), session('b', 'ws', 'Gestures', [msg('user', 'gesture engine beta plan')])];
  const shared = await buildRecallSection({query: 'gesture engine', sessions, activeChatId: 'a', cloudAllowed: true, source, pairId: 'p'});
  assert.match(shared, /Goal: ship gesture engine beta/);
  assert.match(shared, /Gestures/);
  clearRecallCache();
  const local = await buildRecallSection({query: 'gesture engine', sessions, activeChatId: 'a', cloudAllowed: false, source, pairId: 'p'});
  assert.doesNotMatch(local, /Saved milestones/);
  assert.match(local, /Gestures/);
  assert.equal(await buildRecallSection({query: 'x', cloudAllowed: false}), '');
});
