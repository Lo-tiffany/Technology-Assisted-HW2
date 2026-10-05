import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, magnitudeBucket } from '../src/core/stats.js';
import { haversineKm } from '../src/core/geo.js';
import { formatTime, formatMagnitude, toMillis } from '../src/core/time.js';
import { ev, T } from './helpers.js';

test('規模分級的邊界:5.0 屬於 5-6,2.99 屬於 <3', () => {
  assert.equal(magnitudeBucket(5.0), '5-6');
  assert.equal(magnitudeBucket(4.99), '4-5');
  assert.equal(magnitudeBucket(6.0), '6+');
  assert.equal(magnitudeBucket(2.99), '<3');
  assert.equal(magnitudeBucket(null), 'unknown');
});

test('summarize:計數、最大規模、未知規模、時間範圍', () => {
  const events = [ev('a', 3.2, 1000), ev('b', 5.5, 2000), ev('c', null, 3000), ev('d', 6.1, null)];
  const s = summarize(events);
  assert.equal(s.count, 4);
  assert.equal(s.strongest.id, 'd');
  assert.equal(s.unknownMagnitudeCount, 1);
  assert.deepEqual(s.timeRange, { start: 1000, end: 3000 });
  assert.equal(s.magnitudeBuckets['5-6'], 1);
});

test('summarize:空資料', () => {
  const s = summarize([]);
  assert.equal(s.count, 0);
  assert.equal(s.strongest, null);
  assert.equal(s.timeRange, null);
});

test('summarize:每日件數依時區換算(UTC 20:00 在 UTC+8 已是隔天)', () => {
  const events = [ev('a', 4, T('2026-09-01T20:00:00Z')), ev('b', 4, T('2026-09-01T01:00:00Z'))];
  assert.deepEqual(summarize(events, 0).perDay, { '2026-09-01': 2 });
  assert.deepEqual(summarize(events, 8).perDay, { '2026-09-02': 1, '2026-09-01': 1 });
});

test('haversine:同一點為 0;台北到高雄約 300 公里', () => {
  assert.equal(haversineKm(24, 121, 24, 121), 0);
  const d = haversineKm(25.033, 121.5654, 22.6273, 120.3014);
  assert.ok(d > 290 && d < 305, `distance was ${d}`);
});

test('formatTime / formatMagnitude', () => {
  assert.equal(formatTime(0, 8), '1970-01-01 08:00');
  assert.equal(formatTime(null), '—');
  assert.equal(formatMagnitude(5), '5.0');
  assert.equal(formatMagnitude(null), '未知');
});

test('toMillis:無效輸入丟出錯誤,不會變成 0', () => {
  assert.throws(() => toMillis(''), /Invalid/);
  assert.throws(() => toMillis(null), /Invalid/);
  assert.throws(() => toMillis(NaN), /Invalid/);
  assert.equal(toMillis('2026-09-01T00:00:00Z'), T('2026-09-01T00:00:00Z'));
});
