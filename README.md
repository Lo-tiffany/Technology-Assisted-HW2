# Earthquake Explorer: 地震事件互動地圖與篩選工具

- 在可縮放、拖曳的地圖上顯示地震事件 
- 可依規模與時間篩選，點擊標記或清單查看事件資料 
- 同一套篩選邏輯也包成 **MCP server**，讓 AI agent 能直接查詢 

```
固定地震資料 (.geoJSON)
   → parse(缺值保留 null)
   → filter / sort / stats (純函式，單元測試的重點)
    ├─→ 網頁: 地圖 + 事件清單 + 統計
    └─→ MCP server: dataset_info / filter_earthquakes / summarize_earthquakes / get_earthquake
```

## 目錄結構

```
src/core/      純邏輯: parse、filter、sort、stats、query、geo、time
src/mcp/       MCP server(server.js)與工具邏輯(handlers.js，可單獨測試)
web/           網頁(index.html、app.js、style.css)
scripts/       fetch-usgs.js(下載資料)、make-sample.js、serve.js、gemini-demo.js(Gemini + MCP 示範)
data/          sample.geojson(合成範例)、earthquakes.geojson(下載的真實資料)
test/          單元測試(node:test)
```

## 使用說明

需要 Node.js 18.17 以上 (建議 20 以上)

```bash
npm install                    # 安裝依賴(網頁與單元測試不需要,MCP 與 Gemini 示範需要)

# 1. 看網頁(有 data/earthquakes.geojson 就用真實資料,否則用合成範例)
npm start                      # 然後開 http://localhost:8000/web/

# 2. 下載真實資料(見下節)
npm run fetch-data

# 3. 跑單元測試
npm test
```

> 地圖的底圖是使用 OpenStreetMap 線上圖磚，Leaflet 也從 CDN 載入，**展示時需要網路**。

## 資料集如何蒐集

### 資料來源

[USGS 地震目錄](https://earthquake.usgs.gov/earthquakes/search/)(ComCat)的 FDSN Event API，
格式為 GeoJSON，每筆含：位置 `[經度, 緯度, 深度]`、規模 `mag`、時間 `time`(UTC 毫秒)、`place`、`url` 等。

### 方法一 (建議)：用腳本下載並固定下來

```bash
# 預設:台灣周邊、近 1 年、規模 4.0 以上 → data/earthquakes.geojson
npm run fetch-data

# 自訂條件 (舉例)
node scripts/fetch-usgs.js --start 2025-10-01 --end 2026-10-01 --minmag 3.5
node scripts/fetch-usgs.js --preset world --minmag 6 --start 2020-01-01
node scripts/fetch-usgs.js --bbox 21.5,25.8,119,123       # minLat,maxLat,minLon,maxLon
node scripts/fetch-usgs.js --out data/my-data.geojson
```

腳本會把**擷取時間、查詢網址、查詢條件**寫進檔案的 `metadata`(`fetchedAt`、`queryUrl`、`query`)，網頁頂端會顯示。

### 方法二:手動下載

到 [USGS 搜尋頁](https://earthquake.usgs.gov/earthquakes/search/) 設定條件，輸出選 GeoJSON。
手動下載的檔案沒有 `fetchedAt`，要自行記下下載日期與條件。

### 本專案目前使用的資料集

- 共 **104 筆**事件
- 事件時間範圍:2025-10-08 至 2026-09-30 (UTC+8)
- 擷取時間與查詢條件記錄在 `data/earthquakes.geojson` 的 `metadata` 欄位

### 資料的限制

- USGS 對小規模事件並不完整，台灣周邊約從規模 4 左右才比較完善
- 單次查詢上限 20000 筆，超過時會跳出警告，請縮小範圍分次下載。
- 時間是 UTC，網頁以 UTC+8 顯示與篩選。
- 部分事件規模可能缺值，程式一律視為「未知」。
- `data/sample.geojson` 是**合成資料**(`make-sample.js` 以固定亂數產生)，只用於測試用，不是真實地震。

## 網頁操作

1. 一開始顯示全部事件
2. 拉動「最小規模」滑桿到 5，只保留規模 5 以上
3. 調整起迄日縮小時間範圍
4. 點地圖標記(或左側清單)查看事件資料，清單點擊會飛到該事件
5. 標記大小與顏色代表規模，灰色代表規模未知

## 單元測試

```bash
npm test
```

- 測的是自己寫的資料邏輯，不是 Leaflet：
篩選邊界(規模 5.0 含邊界、時間起迄含邊界)、空資料、排序(null 永遠在最後、穩定排序)、
規模與時間缺值不被當成 0、座標順序、跨 180° 經線、距離計算、時區換算、MCP 工具邏輯
- GitHub Actions 會在每次 push 自動執行(`.github/workflows/test.yml`)

### 測試範圍與限制

| 部分 | 驗證方式 |
|---|---|
| `src/core/*`、`src/mcp/handlers.js` | 自動化單元測試 |
| `web/app.js`(地圖與介面) | 人工操作驗證，沒有自動化測試 |
| `scripts/fetch-usgs.js` | 依賴外部網路，以實際下載驗證，沒有自動化測試 |
| `src/mcp/server.js` | 以 MCP Inspector 與 Gemini API 實測，沒有自動化測試 |

## MCP server

把篩選、排序、統計包成 4 個工具，讓 agent 可以呼叫。網頁與 MCP 共用 `src/core/` 同一套邏輯。

| 工具 | 用途 |
|---|---|
| `dataset_info` | 資料筆數、時間範圍、來源、擷取時間 |
| `filter_earthquakes` | 依規模/時間/區域/距離篩選，可排序與限制筆數，回報符合的總數 |
| `summarize_earthquakes` | 總數、最大規模事件、規模分級、每日件數 |
| `get_earthquake` | 以 id 取得單一事件 |

資料檔預設讀 `data/earthquakes.geojson`(沒有就選擇 `sample.geojson`)，可用環境變數 `EQ_DATA` 指定。
每次工具被呼叫時，server 會在 stderr 印出 `[tool] 工具名稱 參數`，方便確認 agent 真的呼叫了工具。

### 方式一:MCP Inspector(不需要 API 金鑰)

```bash
npx @modelcontextprotocol/inspector node src/mcp/server.js
```

在開啟的網頁按 Connect → Tools → List Tools，即可手動執行各工具。

### 方式二:Gemini API + MCP(Windows PowerShell 範例)

```powershell
npm install
# 到 https://aistudio.google.com/apikey 申請金鑰
$env:GEMINI_API_KEY="你的金鑰"
node scripts/gemini-demo.js "這份資料涵蓋哪段時間?規模 5 以上的地震有幾筆?最大的是哪一筆?"
```

其他問法範例：
- 「這份資料裡規模最大的地震是哪一筆？」
- 「9 月規模 5 以上有幾筆？」
- 「離台北 100 公里內規模 4 以上的事件有哪些？」

### 驗證結果

| 檢查項目 | 結果 |
|---|---|
| Gemini API 自動呼叫 `dataset_info`、`summarize_earthquakes`、`filter_earthquakes` | 成功，終端機有 `[tool]` 記錄 |
| 交叉驗證:規模 ≥ 5 的事件數 | 網頁 **11** 筆 = MCP 回傳 **11** 筆，一致 |
| MCP 回報規模最大的事件 | `us7000rl2n`，規模 6.6，2025-12-27 23:05(UTC+8)，深度 63 km |

註:Gemini 的回答由模型生成，措辭每次可能不同，以工具回傳的資料為準。