import { toMillis } from './time.js';
import { haversineKm } from './geo.js';

const has = (v) => v !== undefined && v !== null;

function assertFinite(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name} must be a finite number`);
}

/**
 * 篩選事件(不會修改輸入陣列)。
 * @param {Array} events
 * @param {object} opts
 *  - minMagnitude / maxMagnitude: 含邊界。啟用規模篩選時,規模為 null 的事件預設排除
 *  - includeUnknownMagnitude: true 時,規模未知的事件在規模篩選下仍保留
 *  - startTime / endTime: 含邊界,number | Date | ISO 字串(無時區的日期字串視為 UTC)
 *  - bbox: {minLat, maxLat, minLon, maxLon}
 *  - near: {lat, lon, radiusKm}
 */
export function filterEvents(events, opts = {}) {
  const {
    minMagnitude, maxMagnitude, includeUnknownMagnitude = false,
    startTime, endTime, bbox, near,
  } = opts;

  if (has(minMagnitude)) assertFinite(minMagnitude, 'minMagnitude');
  if (has(maxMagnitude)) assertFinite(maxMagnitude, 'maxMagnitude');
  if (has(minMagnitude) && has(maxMagnitude) && minMagnitude > maxMagnitude) {
    throw new Error('minMagnitude must be <= maxMagnitude');
  }
  const magFilter = has(minMagnitude) || has(maxMagnitude);

  const start = has(startTime) ? toMillis(startTime, 'startTime') : null;
  const end = has(endTime) ? toMillis(endTime, 'endTime') : null;
  if (start !== null && end !== null && start > end) {
    throw new Error('startTime must be <= endTime');
  }

  if (bbox) {
    for (const k of ['minLat', 'maxLat', 'minLon', 'maxLon']) assertFinite(bbox[k], `bbox.${k}`);
    if (bbox.minLat > bbox.maxLat) throw new Error('bbox.minLat must be <= bbox.maxLat');
  }
  if (near) {
    assertFinite(near.lat, 'near.lat');
    assertFinite(near.lon, 'near.lon');
    assertFinite(near.radiusKm, 'near.radiusKm');
    if (near.radiusKm <= 0) throw new Error('near.radiusKm must be > 0');
  }

  return events.filter((e) => {
    if (magFilter) {
      if (e.magnitude === null) {
        if (!includeUnknownMagnitude) return false;
      } else {
        if (has(minMagnitude) && e.magnitude < minMagnitude) return false;
        if (has(maxMagnitude) && e.magnitude > maxMagnitude) return false;
      }
    }
    if (start !== null || end !== null) {
      if (e.time === null) return false;
      if (start !== null && e.time < start) return false;
      if (end !== null && e.time > end) return false;
    }
    if (bbox) {
      if (e.lat < bbox.minLat || e.lat > bbox.maxLat) return false;
      const inLon = bbox.minLon <= bbox.maxLon
        ? e.lon >= bbox.minLon && e.lon <= bbox.maxLon
        : e.lon >= bbox.minLon || e.lon <= bbox.maxLon; // 跨越 180° 經線
      if (!inLon) return false;
    }
    if (near && haversineKm(near.lat, near.lon, e.lat, e.lon) > near.radiusKm) return false;
    return true;
  });
}
