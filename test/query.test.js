import test from 'node:test';
import assert from 'node:assert/strict';
import { runQuery } from '../src/core/query.js';
import { ev, T } from './helpers.js';

const events = [
  ev('A', 3.0, T('2026-09-01T00:00:00Z')),
  ev('B', 5.0, T('2026-09-02T00:00:00Z')),
  ev('C', 6.0, T('2026-09-03T00:00:00Z')),
  ev('D', 5.5, T('2026-09-04T00:00:00Z')),
];

test('展示流程:規模 5 以上 → 縮小時間 → limit', () => {
  assert.equal(runQuery(events).total, 4);
  assert.deepEqual(runQuery(events, { minMagnitude: 5 }).events.map((e) => e.id), ['D', 'C', 'B']);
  const r = runQuery(events, { minMagnitude: 5, startTime: '2026-09-03T00:00:00Z' });
  assert.deepEqual(r.events.map((e) => e.id), ['D', 'C']);
  const top1 = runQuery(events, { minMagnitude: 5, sortBy: 'magnitude', limit: 1 });
  assert.equal(top1.total, 3);
  assert.deepEqual(top1.events.map((e) => e.id), ['C']);
});

test('座標與距離參數必須成組提供', () => {
  assert.throws(() => runQuery(events, { minLat: 0 }), /together/);
  assert.throws(() => runQuery(events, { nearLat: 0, nearLon: 0 }), /together/);
});

test('limit 必須是正整數', () => {
  assert.throws(() => runQuery(events, { limit: 0 }), /limit/);
  assert.throws(() => runQuery(events, { limit: 1.5 }), /limit/);
});
