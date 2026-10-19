import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const question = process.argv.slice(2).join(' ') || '這份資料裡規模最大的地震是哪一筆?';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('請先設定環境變數 GEMINI_API_KEY');
  process.exit(1);
}

const serverPath = fileURLToPath(new URL('../src/mcp/server.js', import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,          // 用目前的 node 啟動 MCP server
  args: [serverPath],
  env: { ...process.env },            // 讓 EQ_DATA 等環境變數傳進去
  stderr: 'inherit',                  // 顯示 server 的載入訊息,方便除錯
});
const mcp = new Client({ name: 'earthquake-demo', version: '1.0.0' });
await mcp.connect(transport);

try {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
    contents: question,
    config: {
      // mcpToTool 會讀取 server 的工具清單,並在模型要求時自動呼叫
      tools: [mcpToTool(mcp)],
      systemInstruction:
        '你可以使用地震資料工具。回答前先用 dataset_info 確認資料涵蓋的時間範圍。' +
        '只根據工具回傳的資料回答,不要自行編造。工具回傳的時間是 UTC,回答時請換算成 UTC+8。',
    },
  });
  console.log(response.text);
} finally {
  await mcp.close();
}
