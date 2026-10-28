import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'codex-quota-panel', version: '0.1.0' }, { availableDisplayModes: ['fullscreen'] }, { autoResize: false });
const button = document.querySelector('#refresh');
const status = document.querySelector('#status');
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });
const formatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const stampFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
let quota = null, busy = false, connected = false, nextAt = Date.now() + 300000, lastError = '', stopped = false;

function theme(context = {}) {
  if (context.theme) document.documentElement.dataset.theme = context.theme;
  for (const [key, value] of Object.entries(context.styles?.variables ?? {})) if (key.startsWith('--') && typeof value === 'string') document.documentElement.style.setProperty(key, value);
  for (const [edge, value] of Object.entries(context.safeAreaInsets ?? {})) if (['top', 'right', 'bottom', 'left'].includes(edge) && Number.isFinite(value)) document.documentElement.style.setProperty(`--safe-${edge}`, `${Math.max(0, value)}px`);
}
function card(id, window) {
  const root = document.querySelector(`#${id}`);
  const expired = Boolean(window?.resetsAt && Date.parse(window.resetsAt) <= Date.now());
  root.classList.toggle('unknown', !window || expired);
  root.querySelector('.amount').textContent = !window ? '—' : expired ? '待更新' : `${number.format(window.remainingPercent)}%`;
  root.querySelector('.fill').style.width = !window || expired ? '0%' : `${window.remainingPercent}%`;
  root.querySelector('.reset').textContent = !window ? '暂未返回此额度' : expired ? '重置时间已过，等待新数据' : window.resetsAt ? `${formatter.format(new Date(window.resetsAt))} 重置` : '重置时间未知';
}
function render() {
  card('five-hour', quota?.fiveHour); card('weekly', quota?.weekly);
  document.querySelector('#plan').textContent = quota?.plan ? quota.plan.toUpperCase() : '当前账号';
  status.textContent = lastError || (!quota ? '正在连接…' : quota.source === 'live' ? '服务器查询' : '本机记录 · 非实时');
  status.dataset.kind = lastError ? 'error' : quota?.source === 'live' ? 'live' : 'snapshot';
  status.title = quota?.note ?? '';
  const age = quota ? Math.max(0, Date.now() - Date.parse(quota.recordedAt)) : 0;
  const ago = age < 60000 ? '刚刚' : age < 3600000 ? `${Math.floor(age / 60000)} 分钟前` : `${Math.floor(age / 3600000)} 小时前`;
  document.querySelector('#recorded').textContent = quota ? `${stampFormatter.format(new Date(quota.recordedAt))} · ${ago}` : '尚未读取额度';
  const remaining = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
  document.querySelector('#countdown').textContent = busy ? '正在更新…' : `下次刷新 ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
}
async function refresh(force = false) {
  if (busy || !connected || stopped) return;
  busy = true; button.disabled = true; button.textContent = '刷新中…'; lastError = ''; render();
  try {
    const result = await app.callServerTool({ name: 'quota_status', arguments: { force } });
    if (result.isError || !result.structuredContent?.recordedAt) throw new Error('暂时无法读取额度');
    quota = result.structuredContent;
    if (app.getHostCapabilities()?.updateModelContext) app.updateModelContext({ structuredContent: { quota } }).catch(() => {});
  } catch {
    lastError = quota ? '更新失败 · 保留上次记录' : '读取失败，请确认已登录后重试';
  } finally {
    busy = false; button.disabled = !connected; button.textContent = '立即刷新'; nextAt = Date.now() + 300000; render();
  }
}
button.addEventListener('click', () => refresh(true));
app.onhostcontextchanged = () => theme(app.getHostContext());
app.ontoolresult = result => { if (result.structuredContent?.recordedAt) { quota = result.structuredContent; render(); } };
const clock = setInterval(() => { render(); if (connected && Date.now() >= nextAt && document.visibilityState === 'visible') refresh(); }, 1000);
app.onteardown = async () => { stopped = true; clearInterval(clock); return {}; };
window.addEventListener('pagehide', () => { stopped = true; clearInterval(clock); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() >= nextAt) refresh(); });
const connectionWarning = setTimeout(() => { if (!connected) { lastError = '连接暂未就绪，请重新打开面板'; render(); } }, 12000);
app.connect().then(() => {
  clearTimeout(connectionWarning); theme(app.getHostContext());
  const host = app.getHostVersion();
  if (host && /desktop/i.test(host.name) && /^26\./.test(host.version)) {
    const parts = host.version.split('.').map(Number);
    if (parts[1] < 928 || (parts[1] === 928 && parts[2] < 20710)) { lastError = '请更新 Codex 后重新打开面板'; render(); return; }
  }
  connected = true; button.disabled = false; lastError = ''; refresh();
}).catch(() => { clearTimeout(connectionWarning); lastError = '面板连接失败，请重新打开'; render(); });
render();
