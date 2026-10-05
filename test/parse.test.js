import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeoJSON } from '../src/core/parse.js';
import { feature } from './helpers.js';

test('解析一筆正常事件,座標順序為 [經度, 緯度, 深度]', () => {
  const { events, skipped } = parseGeoJSON({ features: [feature('a', { coords: [121.5, 24.1, 15] })] });
  assert.equal(skipped, 0);
  assert.equal(events.length, 1);
  assert.deepEqual(
    { lon: events[0].lon, lat: events[0].lat, depth: events[0].depth },
    { lon: 121.5, lat: 24.1, depth: 15 },
  );
});

test('規模缺值保留為 null,不會變成 0', () => {
  const nullMag = feature('a', { mag: null });
  const noMag = feature('b');
  delete noMag.properties.mag;
  const { events } = parseGeoJSON({ features: [nullMag, noMag] });
  assert.equal(events[0].magnitude, null);
  assert.equal(events[1].magnitude, null);
});

test('規模為 0 是合法值,要保留 0', () => {
  const { events } = parseGeoJSON({ features: [feature('a', { mag: 0 })] });
  assert.equal(events[0].magnitude, 0);
});

test('時間缺值保留為 null', () => {
  const { events } = parseGeoJSON({ features: [feature('a', { time: null })] });
  assert.equal(events[0].time, null);
});

test('座標無效的事件被略過並計數', () => {
  const bad = [
    feature('x1', { coords: [] }),
    feature('x2', { coords: [null, 24] }),
    feature('x3', { coords: [121, 91] }),
    feature('x4', { coords: [181, 24] }),
    { type: 'Feature', id: 'x5', properties: {}, geometry: null },
  ];
  const { events, skipped } = parseGeoJSON({ features: [...bad, feature('ok')] });
  assert.equal(events.length, 1);
  assert.equal(skipped, 5);
});

test('空的 FeatureCollection 回傳空陣列', () => {
  assert.deepEqual(parseGeoJSON({ features: [] }), { events: [], skipped: 0 });
});

test('不是 FeatureCollection 時丟出錯誤', () => {
  assert.throws(() => parseGeoJSON(null));
  assert.throws(() => parseGeoJSON({}));
  assert.throws(() => parseGeoJSON({ features: 'nope' }));
});
