#!/usr/bin/env node
// 從 USGS 地震目錄 API 下載 GeoJSON 並存成資料檔
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

const API = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const LIMIT = 20000; // USGS 單次查詢上限
const PRESETS = { taiwan: [21.5, 25.8, 119.0, 123.0], world: null };

const { values } = parseArgs({
  options: {
    start: { type: 'string' },
    end: { type: 'string' },
    minmag: { type: 'string', default: '4.0' },
    preset: { type: 'string', default: 'taiwan' },
    bbox: { type: 'string' },
    out: { type: 'string', default: 'data/earthquakes.geojson' },
  },
});

const now = new Date();
const end = values.end ?? now.toISOString().slice(0, 19);
const start = values.start ?? new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);

let box = null;
if (values.bbox) {
  box = values.bbox.split(',').map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) {
    throw new Error('--bbox 格式:minLat,maxLat,minLon,maxLon');
  }
} else if (values.preset in PRESETS) {
  box = PRESETS[values.preset];
} else {
  throw new Error(`未知的 preset:${values.preset}(可用:${Object.keys(PRESETS).join(', ')})`);
}

const params = new URLSearchParams({
  format: 'geojson',
  starttime: start,
  endtime: end,
  minmagnitude: values.minmag,
  orderby: 'time',
  limit: String(LIMIT),
});
if (box) {
  const [minLat, maxLat, minLon, maxLon] = box;
  params.set('minlatitude', minLat);
  params.set('maxlatitude', maxLat);
  params.set('minlongitude', minLon);
  params.set('maxlongitude', maxLon);
}
const url = `${API}?${params}`;

console.error(`下載中:${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`USGS 回應 ${res.status}:${(await res.text()).slice(0, 300)}`);
const json = await res.json();

if (json.features.length >= LIMIT) {
  console.error(`⚠️ 筆數達到上限 ${LIMIT},資料可能被截斷,請縮小時間或範圍分次下載。`);
}

// 標明擷取日期與查詢條件
json.metadata = {
  ...json.metadata,
  title: json.metadata?.title ?? 'USGS Earthquakes',
  fetchedAt: new Date().toISOString(),
  queryUrl: url,
  query: { start, end, minmag: Number(values.minmag), bbox: box },
};

await mkdir(dirname(values.out), { recursive: true });
await writeFile(values.out, JSON.stringify(json));
console.error(`完成:${json.features.length} 筆 → ${values.out}`);
