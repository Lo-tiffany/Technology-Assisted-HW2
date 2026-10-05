import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandlers } from '../src/mcp/handlers.js';
import { parseGeoJSON } from '../src/core/parse.js';
import { ev, T } from './helpers.js';

const events = [
  ev('A', 3.0, T('2026-09-01T00:00:00Z')),
  ev('B', 5.0, T('2026-09-02T00:00:00Z')),
  ev('C', 6.0, T('2026-09-03T00:00:00Z')),
  ev('N', null, T('2026-09-04T00:00:00Z')),
];
const h = createHandlers(events, { title: 't', fetchedAt: '2026-10-02T00:00:00Z' });

test('filterEarthquakes:回傳總數與前 limit 筆,時間為 ISO 字串', () => {
  const r = h.filterEarthquakes({ minMagnitude: 5, limit: 1, sortBy: 'magnitude' });
  assert.equal(r.totalMatched, 2);
  assert.equal(r.returned, 1);
  assert.equal(r.events[0].id, 'C');
  assert.equal(r.events[0].time, '2026-09-03T00:00:00.000Z');
});

test('filterEarthquakes:limit 預設 20,超出範圍丟錯', () => {
  assert.equal(h.filterEarthquakes({}).returned, 4);
  assert.throws(() => h.filterEarthquakes({ limit: 101 }), /limit/);
  assert.throws(() => h.filterEarthquakes({ limit: 0 }), /limit/);
});

test('summarizeEarthquakes:統計不受 limit 影響', () => {
  const s = h.summarizeEarthquakes({ minMagnitude: 3 });
  assert.equal(s.count, 3);
  assert.equal(s.strongest.id, 'C');
  assert.equal(s.unknownMagnitudeCount, 0);
});

test('getEarthquake:找得到與找不到', () => {
  assert.equal(h.getEarthquake({ id: 'B' }).magnitude, 5.0);
  assert.throws(() => h.getEarthquake({ id: 'zzz' }), /No event/);
});

test('datasetInfo:回報筆數與擷取時間', () => {
  const info = h.datasetInfo();
  assert.equal(info.eventCount, 4);
  assert.equal(info.unknownMagnitudeCount, 1);
  assert.equal(info.fetchedAt, '2026-10-02T00:00:00Z');
});

test('範例資料檔可被解析,且包含規模缺值與規模 5 以上的事件', () => {
  const raw = JSON.parse(readFileSync(new URL('../data/sample.geojson', import.meta.url), 'utf8'));
  const { events: sample, skipped } = parseGeoJSON(raw);
  assert.equal(skipped, 0);
  assert.equal(sample.length, 40);
  assert.ok(sample.some((e) => e.magnitude === null));
  assert.ok(sample.some((e) => e.magnitude === 5.0));
});
