// 所有內部時間一律使用 UTC 毫秒

/** 轉成 UTC 毫秒 */
export function toMillis(value, label = 'time') {
  let ms;
  if (typeof value === 'number') ms = value;
  else if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'string' && value.trim() !== '') ms = Date.parse(value);
  else ms = NaN;
  if (!Number.isFinite(ms)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return ms;
}

/** 以指定時區格式化為 YYYY-MM-DD HH:mm */
export function formatTime(ms, offsetHours = 0) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  return new Date(ms + offsetHours * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
}

export function formatMagnitude(m) {
  return typeof m === 'number' && Number.isFinite(m) ? m.toFixed(1) : '未知';
}
