import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createQuotaProvider, createNativeReader } from './quota-provider.mjs';

const root = resolve(dirname(process.argv[1]), '..');
const resourceUri = 'ui://codex-quota-panel/dashboard-v1';
const provider = createQuotaProvider({ readNative: createNativeReader(resolve(root, 'bin/QuotaReader.exe')) });
const readonly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const server = new McpServer({ name: 'codex-quota-panel', version: '0.1.0' });
const uiMetadata = type => ({ ui: { resourceUri }, 'openai/ui': { entrypoints: [{ type }] } });

for (const [name, title, type] of [
  ['quota_open_panel', 'Codex 额度', 'thread'],
  ['quota_dashboard', '额度看板', 'global'],
]) {
  server.registerTool(name, {
    title, description: type === 'thread' ? '在当前聊天右侧打开当前账号的 Codex 额度面板。' : '打开当前账号的 Codex 额度看板。',
    inputSchema: z.object({}), annotations: readonly, _meta: uiMetadata(type),
  }, async () => ({ content: [{ type: 'text', text: '额度面板支持每 5 分钟自动更新和手动刷新。' }], structuredContent: { pollIntervalMs: 300000 } }));
}
server.registerTool('quota_status', {
  title: '读取 Codex 额度', description: '读取本机当前登录账号的 5 小时和每周剩余额度、重置时间及数据来源。',
  inputSchema: z.object({ force: z.boolean().optional().describe('手动刷新时跳过短期缓存。') }), annotations: readonly,
  _meta: { ui: { visibility: ['app', 'model'] } },
}, async ({ force = false }) => {
  try {
    const quota = await provider.read({ force });
    return { content: [{ type: 'text', text: JSON.stringify(quota) }], structuredContent: quota };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});
server.registerResource('quota-dashboard', resourceUri, { mimeType: 'text/html;profile=mcp-app', title: 'Codex 额度面板' }, async () => ({
  contents: [{ uri: resourceUri, mimeType: 'text/html;profile=mcp-app', text: await readFile(resolve(root, 'ui/index.html'), 'utf8'),
    _meta: { ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } }, 'openai/ui': { availableDisplayModes: ['fullscreen'], preferredDisplayMode: 'fullscreen' } },
  }],
}));
server.connect(new StdioServerTransport()).catch(() => { console.error('额度插件启动失败。'); process.exitCode = 1; });
