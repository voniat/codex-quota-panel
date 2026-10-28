import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuota, createQuotaProvider } from '../src/quota-provider.mjs';

const stamp = 1793192474326;
const native = () => ({ FiveHour: { Remaining: 80, ResetAt: '/Date(1793203257000)/' }, Weekly: { Remaining: 97, ResetAt: '/Date(1793790057000)/' }, Plan: 'plus', Note: null, RecordedAt: `/Date(${stamp})/`, IsLive: true });
test('native values and timestamps survive normalization', () => {
  const q = normalizeQuota(native());
  assert.equal(q.fiveHour.remainingPercent, 80);
  assert.equal(q.weekly.remainingPercent, 97);
  assert.equal(q.recordedAt, '2026-10-28T13:01:14.326Z');
  assert.equal(q.fiveHour.resetsAt, '2026-10-28T16:00:57.000Z');
  assert.equal(q.source, 'live');
});
test('unknown quota stays unknown and zero remaining is preserved', () => {
  const raw = native(); raw.FiveHour = null; raw.Weekly.Remaining = 0;
  const q = normalizeQuota(raw);
  assert.equal(q.fiveHour, null); assert.equal(q.weekly.remainingPercent, 0);
});
test('snapshot refresh preserves the server-recorded time', () => {
  const raw = native(); raw.IsLive = false; raw.Note = '本机记录';
  const q = normalizeQuota(raw);
  assert.equal(q.source, 'snapshot'); assert.equal(q.recordedAt, '2026-10-28T13:01:14.326Z');
});
test('invalid timestamps fail and nonfinite quota is never displayed as full', () => {
  assert.throws(() => normalizeQuota({ ...native(), RecordedAt: 'invalid' }));
  const raw = native(); raw.FiveHour.Remaining = NaN;
  assert.equal(normalizeQuota(raw).fiveHour, null);
});
test('overlapping reads share one native query', async () => {
  let calls = 0; let release;
  const provider = createQuotaProvider({ readNative: async () => { calls++; await new Promise(r => { release = r; }); return native(); } });
  const a = provider.read(), b = provider.read({ force: true });
  await new Promise(r => setImmediate(r));
  assert.equal(calls, 1); release();
  assert.deepEqual(await a, await b);
});
test('manual refresh bypasses cache and does not get stuck after an error', async () => {
  let calls = 0;
  const provider = createQuotaProvider({ readNative: async () => { calls++; if (calls === 2) throw new Error('offline'); return native(); }, now: () => stamp });
  await provider.read(); await provider.read(); assert.equal(calls, 1);
  await assert.rejects(provider.read({ force: true }));
  await provider.read({ force: true }); assert.equal(calls, 3);
});
