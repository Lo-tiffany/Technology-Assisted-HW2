// 把網頁表單 / MCP 工具輸入轉成 filter + sort + limit
import { filterEvents } from './filter.js';
import { sortEvents } from './sort.js';

const has = (v) => v !== undefined && v !== null;

export function runQuery(events, p = {}) {
  const opts = {
    minMagnitude: p.minMagnitude,
    maxMagnitude: p.maxMagnitude,
    includeUnknownMagnitude: p.includeUnknownMagnitude,
    startTime: p.startTime,
    endTime: p.endTime,
  };

  const bboxKeys = ['minLat', 'maxLat', 'minLon', 'maxLon'];
  const givenBox = bboxKeys.filter((k) => has(p[k]));
  if (givenBox.length > 0) {
    if (givenBox.length !== 4) throw new Error('minLat, maxLat, minLon, maxLon must be provided together');
    opts.bbox = Object.fromEntries(bboxKeys.map((k) => [k, p[k]]));
  }

  const nearKeys = ['nearLat', 'nearLon', 'radiusKm'];
  const givenNear = nearKeys.filter((k) => has(p[k]));
  if (givenNear.length > 0) {
    if (givenNear.length !== 3) throw new Error('nearLat, nearLon, radiusKm must be provided together');
    opts.near = { lat: p.nearLat, lon: p.nearLon, radiusKm: p.radiusKm };
  }

  if (has(p.limit) && (!Number.isInteger(p.limit) || p.limit < 1)) {
    throw new Error('limit must be a positive integer');
  }

  const sorted = sortEvents(filterEvents(events, opts), p.sortBy ?? 'time', p.order ?? 'desc');
  return { total: sorted.length, events: has(p.limit) ? sorted.slice(0, p.limit) : sorted };
}
