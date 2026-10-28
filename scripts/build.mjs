import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(repo, 'plugins/codex-quota-panel');
const pkg = JSON.parse(await readFile(resolve(repo, 'package.json'), 'utf8'));
for (const dir of ['server', 'ui', 'bin', 'assets', '.codex-plugin']) await mkdir(resolve(root, dir), { recursive: true });

await build({ absWorkingDir: repo, entryPoints: ['src/server.mjs'], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: resolve(root, 'server/index.cjs'), logLevel: 'warning' });
const client = await build({ absWorkingDir: repo, entryPoints: ['src/app.mjs'], bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', minify: true, write: false, logLevel: 'warning' });
const html = (await readFile(resolve(repo, 'src/index.html'), 'utf8')).replace('/*APP_SCRIPT*/', () => client.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await writeFile(resolve(root, 'ui/index.html'), html);
await copyFile(resolve(repo, 'native/QuotaReader.exe'), resolve(root, 'bin/QuotaReader.exe'));

const display = { displayName: 'Codex 额度', shortDescription: '在聊天侧栏查看账号剩余额度', longDescription: '显示本机当前 Codex 账号的 5 小时和每周剩余额度，支持每 5 分钟自动更新和手动刷新，并标明服务器查询或本机快照及数据时间。', category: 'Developer Tools', capabilities: ['Read', 'Interactive'], logo: './assets/icon.svg', composerIcon: './assets/icon.svg', defaultPrompt: '在右侧打开我的 Codex 额度面板' };
await writeFile(resolve(root, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'codex-quota-panel', version: pkg.version, description: display.longDescription, homepage: 'https://github.com/voniat/codex-quota-panel', repository: 'https://github.com/voniat/codex-quota-panel', extensions: { 'com.openai': { interface: display } } }, null, 2)+'\n');
await writeFile(resolve(root, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'codex-quota-panel', version: pkg.version, description: display.longDescription, mcpServers: './.mcp.json', interface: display }, null, 2)+'\n');
await writeFile(resolve(root, 'mcp.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { quota: { type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/server/index.cjs'], cwd: '${PLUGIN_ROOT}' } } }, null, 2)+'\n');
await writeFile(resolve(root, '.mcp.json'), JSON.stringify({ mcpServers: { quota: { command: 'node', args: ['./server/index.cjs'], cwd: '.' } } }, null, 2)+'\n');
await mkdir(resolve(repo, '.agents/plugins'), { recursive: true });
await writeFile(resolve(repo, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'local-quota', interface: { displayName: '本地额度插件' }, plugins: [{ name: 'codex-quota-panel', source: { source: 'local', path: './plugins/codex-quota-panel' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Developer Tools' }] }, null, 2)+'\n');
console.log(JSON.stringify({ plugin: root, version: pkg.version, uiBytes: Buffer.byteLength(html) }));
