import {it, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {raceCandidates, orderCandidates, recordFailure, recordSuccess, resetProviderHealth, healthOf, cooldownFor, type RaceCandidate} from '../utils/providerRace.ts';

const fast = {hedgeMs: 30, maxParallel: 3, firstTimeoutSecs: 60, otherTimeoutSecs: 45};
const after = <T,>(ms: number, value: T, fail = false) => new Promise<T>((res, rej) => setTimeout(() => (fail ? rej(value) : res(value)), ms));
const cand = (key: string, ms: number, text: string, opts: {fail?: boolean; free?: boolean; log?: string[]} = {}): RaceCandidate => ({
  key, free: opts.free ?? true,
  run: (t) => { opts.log?.push(`${key}@${t}`); return opts.fail ? after(ms, new Error(text), true) as unknown as Promise<string> : after(ms, text); },
});

beforeEach(() => resetProviderHealth());

it('a slow first model gets company and the faster answer wins', async () => {
  const log: string[] = [];
  const t0 = Date.now();
  const r = await raceCandidates([cand('slow', 400, 'slow answer', {log}), cand('quick', 20, 'quick answer', {log})], fast);
  assert.equal(r.text, 'quick answer');
  assert.equal(r.index, 1);
  assert.ok(Date.now() - t0 < 200, 'did not wait for the slow model');
  assert.deepEqual(log, ['slow@60', 'quick@45'], 'first attempt gets the longer timeout');
});

it('the losing request is cancelled once another model answers, and is not marked unhealthy', async () => {
  let aborted = false;
  const slow: RaceCandidate = {key: 'slow', free: true, run: (_t, signal) => new Promise((_, rej) => {
    const timer = setTimeout(() => rej(new Error('late')), 2000);
    signal.addEventListener('abort', () => { aborted = true; clearTimeout(timer); rej(new Error('cancelled')); });
  })};
  const r = await raceCandidates([slow, cand('quick', 20, 'quick answer')], fast);
  assert.equal(r.text, 'quick answer');
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(aborted, true, 'slow provider request was aborted');
  assert.equal(healthOf('slow')?.failures ?? 0, 0, 'cancellation is not a provider failure');
});

it('a fast first model answers alone, no extra calls', async () => {
  const log: string[] = [];
  const r = await raceCandidates([cand('a', 5, 'A', {log}), cand('b', 5, 'B', {log})], fast);
  assert.equal(r.text, 'A');
  assert.deepEqual(log, ['a@60']);
});

it('fails over immediately on errors and reports the last error when all fail', async () => {
  const r = await raceCandidates([cand('down', 5, 'HTTP 503', {fail: true}), cand('up', 5, 'ok')], {...fast, hedgeMs: 10_000});
  assert.equal(r.text, 'ok');
  await assert.rejects(raceCandidates([cand('x', 5, 'HTTP 429 rate limit', {fail: true}), cand('y', 5, 'boom', {fail: true})], fast), /boom/);
});

it('never starts a paid model early, only after a real failure', async () => {
  const log: string[] = [];
  const r = await raceCandidates([cand('free-slow', 120, 'free', {log}), cand('paid', 5, 'paid', {log, free: false})], fast);
  assert.equal(r.text, 'free');
  assert.deepEqual(log, ['free-slow@60']);
});

it('remembers failing providers and tries them last', () => {
  recordFailure('openrouter:qwen', new Error('HTTP 429 Too Many Requests'));
  const order = orderCandidates([{key: 'openrouter:qwen'}, {key: 'gemini:flash'}], false).map((c) => c.key);
  assert.deepEqual(order, ['gemini:flash', 'openrouter:qwen']);
  assert.equal(cooldownFor(new Error('401 Unauthorized'), 1), 30 * 60_000);
  assert.equal(cooldownFor(new Error('timed out'), 3), 4 * 60_000);
  recordSuccess('openrouter:qwen', 1000);
  assert.equal(healthOf('openrouter:qwen')?.cooldownUntil, 0, 'one success clears the cooldown');
});

it('for light tasks, known-fast models move up', () => {
  recordSuccess('slow', 40_000);
  recordSuccess('fast', 2_000);
  assert.deepEqual(orderCandidates([{key: 'slow'}, {key: 'unknown'}, {key: 'fast'}], true).map((c) => c.key), ['fast', 'unknown', 'slow']);
  assert.deepEqual(orderCandidates([{key: 'slow'}, {key: 'fast'}], false).map((c) => c.key), ['slow', 'fast'], 'heavy tasks keep the chosen brain first');
});
