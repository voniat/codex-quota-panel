import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('packaged plugin serves its tools and UI using portable paths', async () => {
  const root = fileURLToPath(new URL('../plugins/codex-quota-panel/', import.meta.url));
  const config = JSON.parse(await readFile(`${root}/mcp.json`, 'utf8')).mcpServers.quota;
  const expand = value => value.replaceAll('${PLUGIN_ROOT}', root);
  const transport = new StdioClientTransport({ command: config.command, args: config.args.map(expand), cwd: expand(config.cwd) });
  const client = new Client({ name: 'quota-panel-verification', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const panel = tools.find(tool => tool.name === 'quota_open_panel');
    assert.equal(panel._meta['openai/ui'].entrypoints[0].type, 'thread');
    assert.equal(tools.find(tool => tool.name === 'quota_dashboard')._meta['openai/ui'].entrypoints[0].type, 'global');
    assert.equal(tools.find(tool => tool.name === 'quota_status').annotations.readOnlyHint, true);
    const opened = await client.callTool({ name: 'quota_open_panel', arguments: {} });
    assert.equal(opened.structuredContent.pollIntervalMs, 300000);
    const ui = await client.readResource({ uri: panel._meta.ui.resourceUri });
    assert.equal(ui.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.ok(ui.contents[0].text.includes('id="refresh"'));
    assert.deepEqual(ui.contents[0]._meta.ui.csp.connectDomains, []);
  } finally { await client.close(); }
});
