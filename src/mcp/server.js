#!/usr/bin/env node
// Earthquake Explorer 的 MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGeoJSON } from '../core/parse.js';
import { createHandlers } from './handlers.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dataPath =
  process.env.EQ_DATA ??
  [join(root, 'data/earthquakes.geojson'), join(root, 'data/sample.geojson')].find(existsSync);
if (!dataPath || !existsSync(dataPath)) {
  console.error('找不到資料檔。請先執行 npm run fetch-data,或用環境變數 EQ_DATA 指定路徑');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(dataPath, 'utf8'));
const { events, skipped } = parseGeoJSON(raw);
console.error(`[earthquake-explorer] 載入 ${events.length} 筆(略過 ${skipped} 筆)← ${dataPath}`);
const h = createHandlers(events, raw.metadata ?? {});

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const run = (name, fn) => (args) => {
  console.error(`[tool] ${name} ${JSON.stringify(args ?? {})}`); // 記錄每次被呼叫的工具與參數
  try { return ok(fn(args)); }
  catch (err) { return { isError: true, content: [{ type: 'text', text: String(err.message ?? err) }] }; }
};

const filterShape = {
  minMagnitude: z.number().optional().describe('最小規模(含)。啟用規模篩選時,規模未知的事件會被排除'),
  maxMagnitude: z.number().optional().describe('最大規模(含)'),
  includeUnknownMagnitude: z.boolean().optional().describe('規模篩選時是否保留規模未知的事件,預設 false'),
  startTime: z.string().optional().describe('起始時間(含),ISO 8601,例如 2026-09-01T00:00:00+08:00,只給日期視為 UTC'),
  endTime: z.string().optional().describe('結束時間(含),格式同 startTime'),
  minLat: z.number().optional().describe('矩形範圍:最小緯度(四個範圍參數須一起提供)'),
  maxLat: z.number().optional(),
  minLon: z.number().optional(),
  maxLon: z.number().optional(),
  nearLat: z.number().optional().describe('距離篩選:中心緯度(須與 nearLon、radiusKm 一起提供)'),
  nearLon: z.number().optional(),
  radiusKm: z.number().positive().optional().describe('距離篩選:半徑(公里)'),
};

const server = new McpServer({ name: 'earthquake-explorer', version: '1.0.0' });

server.registerTool('dataset_info', {
  title: '資料集資訊',
  description: '回報目前載入的地震資料集:筆數、時間範圍、來源與擷取時間。回答問題前可先用它確認資料涵蓋範圍',
  inputSchema: {},
}, run('dataset_info', () => h.datasetInfo()));

server.registerTool('filter_earthquakes', {
  title: '篩選地震事件',
  description: '依規模、時間、區域或距離篩選地震事件,結果依指定欄位排序後回傳前 limit 筆,並回報符合條件的總數',
  inputSchema: {
    ...filterShape,
    sortBy: z.enum(['time', 'magnitude', 'depth']).optional().describe('排序欄位,預設 time'),
    order: z.enum(['asc', 'desc']).optional().describe('排序方向,預設 desc'),
    limit: z.number().int().min(1).max(100).optional().describe('最多回傳幾筆,預設 20,上限 100'),
  },
}, run('filter_earthquakes', (args) => h.filterEarthquakes(args)));

server.registerTool('summarize_earthquakes', {
  title: '統計地震事件',
  description: '對符合條件的事件做統計:總數、最大規模事件、規模分級、每日件數(UTC)',
  inputSchema: filterShape,
}, run('summarize_earthquakes', (args) => h.summarizeEarthquakes(args)));

server.registerTool('get_earthquake', {
  title: '取得單一事件',
  description: '以事件 id 取得單一地震事件的完整資料',
  inputSchema: { id: z.string().describe('事件 id,例如 us7000abcd') },
}, run('get_earthquake', (args) => h.getEarthquake(args)));

await server.connect(new StdioServerTransport());
console.error('[earthquake-explorer] MCP server 已啟動(stdio)');
