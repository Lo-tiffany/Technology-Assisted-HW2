# Earthquake Explorer:地震事件互動地圖與篩選工具

可縮放、拖曳的地圖上顯示地震事件;可依規模與時間篩選,點擊標記或清單查看事件資料。
同一套篩選邏輯也包成 **MCP server**,讓 AI agent 能直接查詢。

```
固定地震資料 (GeoJSON)
   → parse(缺值保留 null)
   → filter / sort / stats(純函式,單元測試的重點)
   ├─→ 網頁:地圖 + 事件清單 + 統計
   └─→ MCP server:filter_earthquakes / summarize_earthquakes / ...
```

## 目錄結構

```
src/core/      純邏輯:parse、filter、sort、stats、query、geo、time
src/mcp/       MCP server(server.js)與工具邏輯(handlers.js,可單獨測試)
web/           網頁(index.html、app.js、style.css)
scripts/       fetch-usgs.js(下載資料)、make-sample.js、serve.js
data/          sample.geojson(合成範例)、earthquakes.geojson(你下載的真實資料)
test/          單元測試(node:test,零依賴)
docs/          AI_COLLABORATION.md(協作紀錄範本)
```

## 快速開始

需要 Node.js 18.17 以上(建議 20 以上)。

```bash
# 1. 直接用合成範例資料看網頁(不需網路下載資料)
npm start                      # 然後開 http://localhost:8000/web/

# 2. 下載真實資料(見下節),網頁會自動優先使用 data/earthquakes.geojson
npm run fetch-data

# 3. 跑單元測試(不需要 npm install)
npm test
```

> 地圖底圖使用 OpenStreetMap 線上圖磚,Leaflet 也從 CDN 載入,**展示時需要網路**。
> 本機有資料檔不代表地圖可以離線顯示。若要離線展示,需要另外準備本機圖磚,這個版本沒有做。

## 資料集如何蒐集

### 資料來源

[USGS 地震目錄](https://earthquake.usgs.gov/earthquakes/search/)(ComCat)的 FDSN Event API,
格式為 GeoJSON,每筆含:位置 `[經度, 緯度, 深度]`、規模 `mag`、時間 `time`(UTC 毫秒)、`place`、`url` 等。

### 方法一(建議):用腳本下載並固定下來

```bash
# 預設:台灣周邊、近 1 年、規模 4.0 以上 → data/earthquakes.geojson
npm run fetch-data

# 自訂條件
node scripts/fetch-usgs.js --start 2025-10-01 --end 2026-10-01 --minmag 3.5
node scripts/fetch-usgs.js --preset world --minmag 6 --start 2020-01-01
node scripts/fetch-usgs.js --bbox 21.5,25.8,119,123       # minLat,maxLat,minLon,maxLon
node scripts/fetch-usgs.js --out data/my-data.geojson
```

腳本會把**擷取時間、查詢網址、查詢條件**寫進檔案的 `metadata`,網頁頂端會顯示,
報告裡也可以直接引用,別人能重現同一份資料。

做法重點:**下載一次後就把檔案 commit 進 git**,展示與測試都用這份固定資料,不做即時監控。

### 方法二:手動下載

到 [USGS 搜尋頁](https://earthquake.usgs.gov/earthquakes/search/) 設定條件,輸出選 GeoJSON,
存成 `data/earthquakes.geojson`。這種檔案沒有 `fetchedAt`,請自己在報告中記下下載日期與條件。

### 方法三:USGS 即時摘要檔(快速試用)

USGS 提供每小時更新的 [GeoJSON 摘要檔](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
(例如過去 30 天、規模 4.5 以上),下載後存成 `data/earthquakes.geojson` 即可。

### 資料的限制(建議寫進報告)

- USGS 全球目錄對小規模事件並不完整;台灣周邊約從規模 4 左右才比較完整。想看小地震,需要改用中央氣象署的資料,
  這個版本沒有做該資料源的轉接。
- 單次查詢上限 20000 筆,超過時腳本會警告,請縮小範圍分次下載。
- 時間是 UTC;網頁以 UTC+8 顯示與篩選。
- 部分事件規模可能缺值,程式一律視為「未知」,不會當成 0。
- `data/sample.geojson` 是**合成資料**(`make-sample.js` 以固定亂數種子產生),只用於展示與測試,請勿當成真實地震引用。
- 資料使用請依 USGS 網站的授權與引用說明標註來源。

## 網頁操作

1. 一開始顯示全部事件。
2. 拉動「最小規模」滑桿到 5,只保留規模 5 以上。
3. 調整起迄日縮小時間範圍。
4. 點地圖標記(或左側清單)查看事件資料;清單點擊會飛到該事件。

標記大小與顏色代表規模;灰色代表規模未知。

## 單元測試

```bash
npm test
```

測的是自己寫的資料邏輯,不是 Leaflet:
篩選邊界(規模 5.0 含邊界、時間起迄含邊界)、空資料、排序(null 永遠在最後、穩定排序)、
規模與時間缺值不被當成 0、座標順序、跨 180° 經線、距離計算、時區換算、MCP 工具邏輯。
GitHub Actions 會在每次 push 自動執行(`.github/workflows/test.yml`)。

## MCP server

```bash
npm install                    # 安裝 @modelcontextprotocol/sdk 與 zod(只有 MCP 需要)
npx @modelcontextprotocol/inspector node src/mcp/server.js   # 用 Inspector 手動測試
```

提供的工具:

| 工具 | 用途 |
|---|---|
| `dataset_info` | 資料筆數、時間範圍、來源、擷取時間 |
| `filter_earthquakes` | 依規模/時間/區域/距離篩選,可排序與限制筆數,回報符合的總數 |
| `summarize_earthquakes` | 總數、最大規模事件、規模分級、每日件數 |
| `get_earthquake` | 以 id 取得單一事件 |

資料檔預設讀 `data/earthquakes.geojson`(沒有就退回 `sample.geojson`),可用環境變數 `EQ_DATA` 指定。

**Claude Code:**

```bash
claude mcp add earthquake -- node /絕對路徑/earthquake-explorer/src/mcp/server.js
```

**Claude Desktop**(`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "earthquake-explorer": {
      "command": "node",
      "args": ["/絕對路徑/earthquake-explorer/src/mcp/server.js"],
      "env": { "EQ_DATA": "/絕對路徑/earthquake-explorer/data/earthquakes.geojson" }
    }
  }
}
```

展示問法範例:「這份資料裡規模最大的地震是哪一筆?」「9 月規模 5 以上有幾筆?」
「離台北 100 公里內規模 4 以上的事件有哪些?」

## 範圍

不做:即時監控、3D 地球、多資料來源、預警、地震預測。
