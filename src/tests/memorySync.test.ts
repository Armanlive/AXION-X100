import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeForCloud,
  isCloudSafe,
  getPairId,
  enqueue,
  readQueue,
  forgetSync,
  type QueuedOp,
  type CloudProfileRow,
  type MilestoneChunk,
} from '../services/memorySync.ts';

// localStorage shim for node:test (the service touches it at import time only
// inside guarded blocks; queue/pair helpers call it lazily).
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: false },
});

forgetSync(); // clean slate

describe('Cloud privacy gate', () => {
  it('strips code and redacts secret-shaped tokens', () => {
    const raw = 'Use ```python\nprint(secret)\n``` and `npm run x` with sk-ABCDEFGHIJKLMNOP1234 then https://example.com';
    const clean = sanitizeForCloud(raw);
    assert.ok(!clean.includes('secret'));
    assert.ok(!clean.includes('sk-ABCDEFGHIJKLMNOP1234'));
    assert.ok(clean.includes('[code]'));
    assert.ok(clean.length <= 512);
  });

  it('rejects oversized summaries and oversized profile fields', () => {
    const longSummary = 'x'.repeat(600);
    const chunk: MilestoneChunk = {
      device_pair_id: 'pair',
      milestone_kind: 'summary',
      summary: longSummary,
      source: 'desktop',
      device_label: null,
    };
    assert.equal(isCloudSafe({ kind: 'milestone_insert', payload: chunk }), false);

    const badProfile: CloudProfileRow = {
      device_pair_id: 'pair', display_name: null, role: 'y'.repeat(401),
      projects: '', help: '', style: '', share_with_ai: true, revision: 1,
    };
    assert.equal(isCloudSafe({ kind: 'profile_upsert', payload: badProfile }), false);
  });

  it('accepts well-formed capped payloads', () => {
    const chunk: MilestoneChunk = {
      device_pair_id: 'pair', milestone_kind: 'decision',
      summary: 'Chose SQLite local-first for chat history',
      source: 'desktop', device_label: null,
    };
    assert.equal(isCloudSafe({ kind: 'milestone_insert', payload: chunk }), true);
    const goodProfile: CloudProfileRow = {
      device_pair_id: 'pair', display_name: null, role: 'engineer',
      projects: 'AXION', help: 'debugging', style: 'concise', share_with_ai: true, revision: 1,
    };
    assert.equal(isCloudSafe({ kind: 'profile_upsert', payload: goodProfile }), true);
  });
});

describe('Offline queue', () => {
  it('persists ops across reads and rotates pair id on forget', () => {
    enqueue({ kind: 'milestone_insert', payload: {
      device_pair_id: getPairId(), milestone_kind: 'goal',
      summary: 'Ship hybrid memory sync', source: 'desktop', device_label: null,
    } });
    assert.equal(readQueue().length, 1);
    const before = getPairId();
    forgetSync();
    assert.equal(readQueue().length, 0);
    assert.notEqual(getPairId(), before);
  });
});
