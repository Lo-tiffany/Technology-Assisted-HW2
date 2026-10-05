import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEvents } from '../src/core/filter.js';
import { ev, T } from './helpers.js';

const ids = (list) => list.map((e) => e.id);

test('規模至少 5.0:只留下 B、C(含邊界)', () => {
  const events = [ev('A', 3.0), ev('B', 5.0), ev('C', 6.0)];
  assert.deepEqual(ids(filterEvents(events, { minMagnitude: 5.0 })), ['B', 'C']);
});

test('規模上限含邊界', () => {
  const events = [ev('A', 3.0), ev('B', 5.0), ev('C', 6.0)];
  assert.deepEqual(ids(filterEvents(events, { maxMagnitude: 5.0 })), ['A', 'B']);
});

test('規模缺值預設被排除,而不是當成 0', () => {
  const events = [ev('A', null), ev('B', 5.0)];
  assert.deepEqual(ids(filterEvents(events, { minMagnitude: 0 })), ['B']);
});

test('includeUnknownMagnitude 可保留規模未知的事件', () => {
  const events = [ev('A', null), ev('B', 5.0), ev('C', 2.0)];
  const out = filterEvents(events, { minMagnitude: 5, includeUnknownMagnitude: true });
  assert.deepEqual(ids(out), ['A', 'B']);
});

test('沒有規模條件時,規模未知的事件也保留', () => {
  const events = [ev('A', null), ev('B', 5.0)];
  assert.deepEqual(ids(filterEvents(events, {})), ['A', 'B']);
});

test('時間範圍:起訖皆含邊界', () => {
  const events = [
    ev('before', 4, T('2026-09-01T00:00:00Z') - 1),
    ev('start', 4, T('2026-09-01T00:00:00Z')),
    ev('mid', 4, T('2026-09-05T12:00:00Z')),
    ev('end', 4, T('2026-09-10T00:00:00Z')),
    ev('after', 4, T('2026-09-10T00:00:00Z') + 1),
  ];
  const out = filterEvents(events, { startTime: '2026-09-01T00:00:00Z', endTime: '2026-09-10T00:00:00Z' });
  assert.deepEqual(ids(out), ['start', 'mid', 'end']);
});

test('時間可接受 number / Date / ISO 字串', () => {
  const events = [ev('A', 4, T('2026-09-05T00:00:00Z'))];
  const t = T('2026-09-05T00:00:00Z');
  assert.equal(filterEvents(events, { startTime: t }).length, 1);
  assert.equal(filterEvents(events, { startTime: new Date(t) }).length, 1);
  assert.equal(filterEvents(events, { startTime: '2026-09-05T00:00:00Z' }).length, 1);
});

test('啟用時間篩選時,時間未知的事件被排除', () => {
  const events = [ev('A', 4, null), ev('B', 4, T('2026-09-05T00:00:00Z'))];
  assert.deepEqual(ids(filterEvents(events, { startTime: '2026-09-01T00:00:00Z' })), ['B']);
});

test('空資料回傳空陣列', () => {
  assert.deepEqual(filterEvents([], { minMagnitude: 5 }), []);
});

test('不會修改輸入陣列', () => {
  const events = [ev('A', 3), ev('B', 6)];
  const copy = structuredClone(events);
  filterEvents(events, { minMagnitude: 5 });
  assert.deepEqual(events, copy);
});

test('矩形範圍篩選', () => {
  const events = [ev('in', 4, null, { lat: 24, lon: 121 }), ev('out', 4, null, { lat: 30, lon: 121 })];
  const out = filterEvents(events, { bbox: { minLat: 22, maxLat: 26, minLon: 119, maxLon: 123 } });
  assert.deepEqual(ids(out), ['in']);
});

test('矩形範圍可跨越 180° 經線', () => {
  const events = [ev('E', 4, null, { lon: 179 }), ev('W', 4, null, { lon: -179 }), ev('mid', 4, null, { lon: 0 })];
  const out = filterEvents(events, { bbox: { minLat: -90, maxLat: 90, minLon: 170, maxLon: -170 } });
  assert.deepEqual(ids(out), ['E', 'W']);
});

test('距離篩選:以台北為中心 100 公里', () => {
  const events = [
    ev('taipei', 4, null, { lat: 25.05, lon: 121.55 }),
    ev('hualien', 4, null, { lat: 23.97, lon: 121.6 }), // 約 120 公里
    ev('kaohsiung', 4, null, { lat: 22.63, lon: 120.3 }),
  ];
  const out = filterEvents(events, { near: { lat: 25.03, lon: 121.56, radiusKm: 100 } });
  assert.deepEqual(ids(out), ['taipei']);
});

test('無效參數會丟出錯誤', () => {
  assert.throws(() => filterEvents([], { minMagnitude: 6, maxMagnitude: 5 }), /minMagnitude/);
  assert.throws(() => filterEvents([], { minMagnitude: NaN }), /finite/);
  assert.throws(() => filterEvents([], { startTime: 'not a date' }), /Invalid startTime/);
  assert.throws(() => filterEvents([], { startTime: '2026-09-10', endTime: '2026-09-01' }), /startTime/);
  assert.throws(() => filterEvents([], { near: { lat: 0, lon: 0, radiusKm: 0 } }), /radiusKm/);
});

test('多個條件同時成立才保留', () => {
  const events = [
    ev('A', 6, T('2026-09-05T00:00:00Z')),
    ev('B', 6, T('2026-08-05T00:00:00Z')),
    ev('C', 3, T('2026-09-05T00:00:00Z')),
  ];
  const out = filterEvents(events, { minMagnitude: 5, startTime: '2026-09-01T00:00:00Z' });
  assert.deepEqual(ids(out), ['A']);
});
