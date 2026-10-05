// 測試用的小資料:不依賴任何真實資料檔
export const T = (iso) => Date.parse(iso);

export function ev(id, magnitude, time = null, extra = {}) {
  return { id, magnitude, time, depth: 10, lat: 24, lon: 121, place: '', url: '', type: 'earthquake', ...extra };
}

export function feature(id, { mag = 4.5, time = 1700000000000, coords = [121.5, 24.0, 10], place = 'test' } = {}) {
  return {
    type: 'Feature', id,
    properties: { mag, time, place, url: `https://example.org/${id}`, type: 'earthquake' },
    geometry: { type: 'Point', coordinates: coords },
  };
}
