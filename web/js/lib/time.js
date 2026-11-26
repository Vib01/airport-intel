// Times arrive as unix seconds UTC. Render in America/St_Johns.
import { TZ } from '../config.js';

const cache = new Map();
function f(opts) {
  const k = JSON.stringify(opts);
  if (!cache.has(k)) cache.set(k, new Intl.DateTimeFormat('en-CA', { timeZone: TZ, ...opts }));
  return cache.get(k);
}

export const hm = (ts) => (ts ? f({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ts * 1000) : '—');
export const hour = (ts) => f({ hour: '2-digit', hourCycle: 'h23' }).format(ts * 1000);
export const dayShort = (ts) => f({ weekday: 'short', day: 'numeric' }).format(ts * 1000);
export const dateLong = (ts) => f({ weekday: 'long', month: 'long', day: 'numeric' }).format(ts * 1000);
export const tzAbbr = (ts) =>
  (new Intl.DateTimeFormat('en-CA', { timeZone: TZ, timeZoneName: 'short' }).formatToParts(ts * 1000).find((p) => p.type === 'timeZoneName')?.value) ?? '';
export const zulu = (ts) => (ts ? `${new Date(ts * 1000).toISOString().slice(11, 16).replace(':', '')}Z` : '—');
export const ddhhmmZ = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
};
export const nowSec = () => Math.floor(Date.now() / 1000);

export function ago(ts, now = nowSec()) {
  if (!ts) return 'never';
  const s = Math.max(0, now - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
