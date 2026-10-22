// MCP 工具的實際邏輯
import { runQuery } from '../core/query.js';
import { summarize } from '../core/stats.js';

const MAX_LIMIT = 100;

export const toView = (e) => ({
  id: e.id,
  time: e.time === null ? null : new Date(e.time).toISOString(),
  magnitude: e.magnitude,
  depthKm: e.depth,
  lat: e.lat,
  lon: e.lon,
  place: e.place,
  url: e.url,
});

export function createHandlers(events, metadata = {}) {
  return {
    datasetInfo() {
      const { count, timeRange, unknownMagnitudeCount } = summarize(events);
      return {
        eventCount: count,
        unknownMagnitudeCount,
        timeRange: timeRange && {
          start: new Date(timeRange.start).toISOString(),
          end: new Date(timeRange.end).toISOString(),
        },
        source: metadata.title ?? null,
        fetchedAt: metadata.fetchedAt ?? null,
        query: metadata.query ?? null,
      };
    },

    filterEarthquakes(params = {}) {
      const limit = params.limit ?? 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}`);
      }
      const { total, events: rows } = runQuery(events, { ...params, limit });
      return { totalMatched: total, returned: rows.length, events: rows.map(toView) };
    },

    summarizeEarthquakes(params = {}) {
      const { events: rows } = runQuery(events, { ...params, limit: undefined });
      const s = summarize(rows);
      return {
        count: s.count,
        unknownMagnitudeCount: s.unknownMagnitudeCount,
        strongest: s.strongest && toView(s.strongest),
        timeRange: s.timeRange && {
          start: new Date(s.timeRange.start).toISOString(),
          end: new Date(s.timeRange.end).toISOString(),
        },
        magnitudeBuckets: s.magnitudeBuckets,
        perDayUtc: s.perDay,
      };
    },

    getEarthquake({ id }) {
      const found = events.find((e) => e.id === id);
      if (!found) throw new Error(`No event with id: ${id}`);
      return toView(found);
    },
  };
}
