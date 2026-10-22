import { formatTime } from './time.js';

export const BUCKETS = ['<3', '3-4', '4-5', '5-6', '6+', 'unknown'];

/** 規模分級 (含下界、不含上界) */
export function magnitudeBucket(m) {
  if (typeof m !== 'number' || !Number.isFinite(m)) return 'unknown';
  if (m < 3) return '<3';
  if (m < 4) return '3-4';
  if (m < 5) return '4-5';
  if (m < 6) return '5-6';
  return '6+';
}

/** 統計摘要 */
export function summarize(events, utcOffsetHours = 0) {
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  const perDay = {};
  let strongest = null;
  let minT = null;
  let maxT = null;

  for (const e of events) {
    buckets[magnitudeBucket(e.magnitude)]++;
    if (e.magnitude !== null && (strongest === null || e.magnitude > strongest.magnitude)) {
      strongest = e;
    }
    if (e.time !== null) {
      minT = minT === null ? e.time : Math.min(minT, e.time);
      maxT = maxT === null ? e.time : Math.max(maxT, e.time);
      const day = formatTime(e.time, utcOffsetHours).slice(0, 10);
      perDay[day] = (perDay[day] ?? 0) + 1;
    }
  }
  return {
    count: events.length,
    unknownMagnitudeCount: buckets.unknown,
    strongest,
    timeRange: minT === null ? null : { start: minT, end: maxT },
    magnitudeBuckets: buckets,
    perDay,
  };
}
