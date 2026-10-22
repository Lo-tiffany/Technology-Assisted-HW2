// 把 USGS GeoJSON 轉成內部事件格式

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * @param {object} geojson FeatureCollection
 * @returns {{events: Array, skipped: number}} skipped = 座標無效而被略過的筆數
 */
export function parseGeoJSON(geojson) {
  if (!geojson || !Array.isArray(geojson.features)) {
    throw new Error('Not a GeoJSON FeatureCollection');
  }
  const events = [];
  let skipped = 0;

  for (const f of geojson.features) {
    const c = f?.geometry?.coordinates;
    // GeoJSON 座標順序是 [經度, 緯度, 深度]
    const lon = num(c?.[0]);
    const lat = num(c?.[1]);
    if (lon === null || lat === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      skipped++;
      continue;
    }
    const p = f.properties ?? {};
    events.push({
      id: String(f.id ?? `${p.time ?? 'na'}_${lat}_${lon}`),
      time: num(p.time),
      magnitude: num(p.mag),
      depth: num(c[2]),
      lat,
      lon,
      place: typeof p.place === 'string' ? p.place : '',
      url: typeof p.url === 'string' ? p.url : '',
      type: typeof p.type === 'string' ? p.type : 'earthquake',
    });
  }
  return { events, skipped };
}
