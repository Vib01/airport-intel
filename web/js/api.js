// fetch + timeout + last-good cache + staleness. Browsers only ever talk to our Worker.
import { API_BASE, FETCH_TIMEOUT_MS, OFFLINE_AFTER_MS, STALE_AFTER_MS } from './config.js';
import { set } from './state.js';
import { storage } from './lib/dom.js';

const pollers = new Map();

async function fetchJson(path) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctl.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Poll `path` every `intervalMs`, publishing to state key `key` as
 * { data, okAt, error, status: 'LIVE'|'STALE'|'OFFLINE', fromCache }.
 * Ref-counted: several views can share one poller. Pauses while the tab is hidden.
 */
export function poll(key, path, intervalMs) {
  let p = pollers.get(key);
  if (p) { p.refs++; return () => release(key); }

  const cached = storage.get(`lastgood:${key}`);
  p = { refs: 1, timer: null, okAt: cached?.okAt ?? 0, data: cached?.data ?? null, error: null, path, intervalMs };
  pollers.set(key, p);
  if (p.data) publish(key, p, true);

  const tick = async () => {
    if (document.hidden) { p.timer = setTimeout(tick, 1000); return; }
    try {
      p.data = await fetchJson(p.path);
      p.okAt = Date.now();
      p.error = null;
      storage.set(`lastgood:${key}`, { okAt: p.okAt, data: p.data });
      publish(key, p, false);
    } catch (e) {
      p.error = String(e?.message ?? e);
      publish(key, p, true);
    }
    if (pollers.get(key) === p) p.timer = setTimeout(tick, p.intervalMs);
  };
  tick();
  return () => release(key);
}

function release(key) {
  const p = pollers.get(key);
  if (!p) return;
  if (--p.refs <= 0) { clearTimeout(p.timer); pollers.delete(key); }
}

function publish(key, p, fromCache) {
  const age = Date.now() - p.okAt;
  const status = !p.okAt ? 'OFFLINE' : age > OFFLINE_AFTER_MS ? 'OFFLINE' : age > STALE_AFTER_MS || p.error ? 'STALE' : 'LIVE';
  set(key, { data: p.data, okAt: p.okAt, error: p.error, status, fromCache });
}

/** Re-evaluate staleness without fetching (call every few seconds from the shell). */
export function refreshStatuses() {
  for (const [key, p] of pollers) publish(key, p, !!p.error);
}

/** Combine client fetch status with a server-side source status. Worst wins. */
export function combine(fetchStatus, sourceStatus) {
  const rank = { LIVE: 0, STALE: 1, OFFLINE: 2 };
  const a = rank[fetchStatus] ?? 2, b = rank[sourceStatus] ?? 0;
  return ['LIVE', 'STALE', 'OFFLINE'][Math.max(a, b)];
}

export { fetchJson };
