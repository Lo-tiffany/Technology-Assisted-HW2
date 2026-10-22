#!/usr/bin/env node
// 產生「合成」範例資料(不是真實地震)，測試用
import { writeFile } from 'node:fs/promises';

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const t0 = Date.parse('2026-09-01T00:00:00Z');
const span = 30 * 86_400_000;
const forced = { 6: 5.2, 19: 6.1, 33: 5.0 };   // 保證有規模 5 以上(含剛好 5.0)的事件
const unknownMag = new Set([11, 27]);           // 規模缺值

const features = Array.from({ length: 40 }, (_, i) => {
  const lat = +(21.8 + rand() * 3.6).toFixed(3);
  const lon = +(119.8 + rand() * 2.8).toFixed(3);
  const depth = +(5 + rand() * 55).toFixed(1);
  let mag = Math.min(6.8, 2.5 + -Math.log(1 - rand()) * 0.6);
  mag = +mag.toFixed(1);
  if (forced[i] !== undefined) mag = forced[i];
  return {
    type: 'Feature',
    id: `sample${String(i + 1).padStart(4, '0')}`,
    properties: {
      mag: unknownMag.has(i) ? null : mag,
      place: `合成事件 #${i + 1}(非真實地震)`,
      time: Math.round(t0 + rand() * span),
      url: '',
      type: 'earthquake',
    },
    geometry: { type: 'Point', coordinates: [lon, lat, depth] },
  };
});

await writeFile('data/sample.geojson', JSON.stringify({
  type: 'FeatureCollection',
  metadata: { title: '合成範例資料(非真實地震)', fetchedAt: null, count: features.length },
  features,
}));
console.error(`已產生 ${features.length} 筆合成資料 → data/sample.geojson`);
