import { parseGeoJSON } from '../src/core/parse.js';
import { filterEvents } from '../src/core/filter.js';
import { sortEvents } from '../src/core/sort.js';
import { summarize, magnitudeBucket, BUCKETS } from '../src/core/stats.js';
import { formatTime, formatMagnitude } from '../src/core/time.js';

const TZ_OFFSET = 8;            // 顯示時區:UTC+8
const LIST_LIMIT = 200;         // 清單最多顯示筆數(地圖仍顯示全部)
// 先找真實資料,找不到再退回合成範例資料
const DATA_CANDIDATES = ['../data/earthquakes.geojson', '../data/sample.geojson'];
const COLORS = {
  '<3': '#8fb8d8', '3-4': '#4f94c4', '4-5': '#f0a030',
  '5-6': '#e0561c', '6+': '#a50f15', unknown: '#8a8a8a',
};

const $ = (id) => document.getElementById(id);
const dayStart = (d) => Date.parse(`${d}T00:00:00+08:00`);
const dayEnd = (d) => Date.parse(`${d}T23:59:59.999+08:00`);

const map = L.map('map').setView([23.7, 121], 7);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
const layer = L.layerGroup().addTo(map);

let allEvents = [];
let dataRange = null;
let needFit = true;
const markers = new Map();

async function loadData() {
  for (const url of DATA_CANDIDATES) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return { json: await res.json(), url };
    } catch { /* 試下一個 */ }
  }
  throw new Error('找不到資料檔。請執行 npm run fetch-data 或 npm run make-sample。');
}

function currentFilter() {
  const f = {};
  const min = Number($('minMag').value);
  if (min > 0) {
    f.minMagnitude = min;
    f.includeUnknownMagnitude = $('unknown').checked;
  }
  if ($('start').value) f.startTime = dayStart($('start').value);
  if ($('end').value) f.endTime = dayEnd($('end').value);
  return f;
}

function markerStyle(e) {
  const color = COLORS[magnitudeBucket(e.magnitude)];
  const r = e.magnitude === null ? 4 : 3 + e.magnitude * 1.8;
  return { radius: r, color, weight: 1, fillColor: color, fillOpacity: 0.55 };
}

function popupContent(e) {
  const box = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = `規模 ${formatMagnitude(e.magnitude)}`;
  box.append(title);

  const dl = document.createElement('dl');
  const rows = [
    ['時間', `${formatTime(e.time, TZ_OFFSET)}(UTC+8)`],
    ['地點', e.place || '—'],
    ['深度', e.depth === null ? '未知' : `${e.depth} km`],
    ['座標', `${e.lat.toFixed(3)}, ${e.lon.toFixed(3)}`],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  box.append(dl);

  if (e.url.startsWith('https://')) {
    const a = document.createElement('a');
    a.href = e.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = '查看 USGS 事件頁';
    box.append(a);
  }
  return box;
}

function renderStats(shown) {
  const s = summarize(shown, TZ_OFFSET);
  $('count').textContent = `${s.count} 筆事件`;
  $('strongest').textContent = s.strongest
    ? `最大規模 ${formatMagnitude(s.strongest.magnitude)}・${formatTime(s.strongest.time, TZ_OFFSET)}`
    : '沒有符合條件的事件';

  const max = Math.max(1, ...Object.values(s.magnitudeBuckets));
  const ul = $('buckets');
  ul.replaceChildren();
  for (const b of BUCKETS) {
    const li = document.createElement('li');
    const name = document.createElement('span'); name.textContent = b === 'unknown' ? '未知' : b;
    const track = document.createElement('span');
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${(s.magnitudeBuckets[b] / max) * 100}%`;
    bar.style.background = COLORS[b];
    track.append(bar);
    const n = document.createElement('span'); n.textContent = String(s.magnitudeBuckets[b]);
    li.append(name, track, n);
    ul.append(li);
  }
}

function renderList(shown) {
  const ul = $('list');
  ul.replaceChildren();
  for (const e of shown.slice(0, LIST_LIMIT)) {
    const li = document.createElement('li');
    li.tabIndex = 0;
    const mag = document.createElement('span'); mag.className = 'mag';
    mag.textContent = formatMagnitude(e.magnitude);
    mag.style.color = COLORS[magnitudeBucket(e.magnitude)];
    const text = document.createElement('span');
    text.textContent = e.place || '(無地點資訊)';
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = `${formatTime(e.time, TZ_OFFSET)}・深度 ${e.depth ?? '?'} km`;
    text.append(meta);
    li.append(mag, text);
    const open = () => {
      map.flyTo([e.lat, e.lon], Math.max(map.getZoom(), 9));
      markers.get(e.id)?.openPopup();
    };
    li.addEventListener('click', open);
    li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(); });
    ul.append(li);
  }
  if (shown.length > LIST_LIMIT) {
    const li = document.createElement('li');
    li.className = 'more';
    li.textContent = `還有 ${shown.length - LIST_LIMIT} 筆,請縮小篩選範圍`;
    ul.append(li);
  }
}

function render() {
  $('minMagValue').textContent = Number($('minMag').value).toFixed(1);
  $('msg').textContent = '';
  let shown = [];
  try {
    shown = sortEvents(filterEvents(allEvents, currentFilter()), 'time', 'desc');
  } catch (err) {
    $('msg').textContent = err.message.includes('startTime')
      ? '起日不能晚於迄日。' : `篩選條件有誤:${err.message}`;
  }

  layer.clearLayers();
  markers.clear();
  // 小的畫在大的上面,避免大圓遮住小圓
  for (const e of [...shown].sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1))) {
    const m = L.circleMarker([e.lat, e.lon], markerStyle(e)).bindPopup(() => popupContent(e));
    m.addTo(layer);
    markers.set(e.id, m);
  }
  renderStats(shown);
  renderList(shown);

  if (needFit && shown.length > 0) {
    map.fitBounds(L.latLngBounds(shown.map((e) => [e.lat, e.lon])).pad(0.1));
    needFit = false;
  }
}

function resetControls() {
  $('minMag').value = '0';
  $('unknown').checked = false;
  $('start').value = dataRange ? formatTime(dataRange.start, TZ_OFFSET).slice(0, 10) : '';
  $('end').value = dataRange ? formatTime(dataRange.end, TZ_OFFSET).slice(0, 10) : '';
  render();
}

async function init() {
  try {
    const { json, url } = await loadData();
    const { events, skipped } = parseGeoJSON(json);
    allEvents = events;
    dataRange = summarize(events).timeRange;

    const isSample = url.endsWith('sample.geojson');
    const title = json.metadata?.title ?? '地震資料';
    const fetched = json.metadata?.fetchedAt
      ? `擷取於 ${formatTime(Date.parse(json.metadata.fetchedAt), TZ_OFFSET)}` : '';
    $('source').textContent =
      `${isSample ? '⚠ 目前為合成範例資料。' : ''}${title}・共 ${events.length} 筆${fetched ? '・' + fetched : ''}` +
      (skipped ? `・略過 ${skipped} 筆座標無效` : '');

    for (const id of ['minMag', 'unknown', 'start', 'end']) $(id).addEventListener('input', render);
    $('reset').addEventListener('click', resetControls);
    resetControls();
  } catch (err) {
    $('source').textContent = err.message;
    $('source').className = 'error';
  }
}

init();
