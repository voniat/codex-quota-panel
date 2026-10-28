import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const runFile = promisify(execFile);

function parseDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  const time = match ? Number(match[1]) : Date.parse(value);
  return Number.isFinite(time) && Math.abs(time) <= 8640000000000000 ? new Date(time).toISOString() : null;
}
function normalizeWindow(value, windowMinutes) {
  if (!value || typeof value.Remaining !== 'number' || !Number.isFinite(value.Remaining)) return null;
  return { remainingPercent: Math.max(0, Math.min(100, value.Remaining)), resetsAt: parseDate(value.ResetAt), windowMinutes };
}
export function normalizeQuota(raw) {
  if (!raw || typeof raw !== 'object' || !parseDate(raw.RecordedAt)) throw new Error('额度记录格式无效，请重新刷新。');
  return {
    fiveHour: normalizeWindow(raw.FiveHour, 300), weekly: normalizeWindow(raw.Weekly, 10080),
    recordedAt: parseDate(raw.RecordedAt), source: raw.IsLive === true ? 'live' : 'snapshot',
    plan: typeof raw.Plan === 'string' ? raw.Plan.slice(0, 30) : '',
    note: typeof raw.Note === 'string' ? raw.Note.slice(0, 160) : '',
  };
}
export function createNativeReader(readerPath) {
  return async () => {
    try {
      const { stdout } = await runFile(readerPath, ['--check'], { windowsHide: true, timeout: 25000, maxBuffer: 262144, encoding: 'utf8' });
      return JSON.parse(stdout.trim());
    } catch {
      throw new Error('暂时无法读取额度，请确认本机 Codex 已登录后重试。');
    }
  };
}
export function createQuotaProvider({ readNative, now = Date.now, cacheMs = 15000 } = {}) {
  let cached = null, cachedAt = 0, pending = null;
  return {
    read({ force = false } = {}) {
      if (pending) return pending;
      if (!force && cached && now() - cachedAt < cacheMs) return Promise.resolve(cached);
      pending = Promise.resolve().then(readNative).then(raw => {
        cached = normalizeQuota(raw); cachedAt = now(); return cached;
      }).finally(() => { pending = null; });
      return pending;
    },
  };
}
