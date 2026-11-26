// LIVE / STALE / OFFLINE, overall + per source (details in the tooltip and popover).
import { esc } from '../lib/dom.js';
import { ago, nowSec } from '../lib/time.js';

const LABEL = { adsb: 'Aircraft', metar: 'METAR', taf: 'TAF', pirep: 'PIREPs', sigmet: 'SIGMETs', forecast: 'Forecast', stats: 'Stats', prune: 'Cleanup' };

/** @param {'LIVE'|'STALE'|'OFFLINE'} fetchStatus  @param {import('../types.js').HealthReport|null} health */
export function overallStatus(fetchStatus, health) {
  if (fetchStatus !== 'LIVE') return fetchStatus;
  const s = health?.sources ?? {};
  if (s.adsb?.status === 'OFFLINE' && s.metar?.status === 'OFFLINE') return 'OFFLINE';
  if (['adsb', 'metar'].some((k) => s[k] && s[k].status !== 'LIVE') || (health && health.db !== 'ok')) return 'STALE';
  return 'LIVE';
}

export function renderStatusPill(el, fetchStatus, health, okAtMs, now = nowSec()) {
  const st = overallStatus(fetchStatus, health);
  const rows = Object.entries(health?.sources ?? {})
    .filter(([k]) => k !== 'prune')
    .map(([k, v]) => `<li><span class="dot dot-${v.status.toLowerCase()}"></span>${esc(LABEL[k] ?? k)}: <b>${esc(v.status)}</b>` +
      `${v.lastOkAt ? ` · ${esc(ago(v.lastOkAt, now))}` : ''}${v.sourceUsed ? ` · ${esc(v.sourceUsed)}` : ''}</li>`).join('');
  const db = health && health.db !== 'ok' ? `<li>Database: <b>${health.db === 'quota' ? 'daily quota reached — showing last saved data' : 'unavailable — showing last saved data'}</b></li>` : '';
  const updated = okAtMs ? `Updated ${ago(Math.floor(okAtMs / 1000), now)}` : 'No data yet';
  el.innerHTML = `<details class="status">
    <summary class="pill pill-${st.toLowerCase()}" title="Data status — ${esc(updated)}"><span class="dot dot-${st.toLowerCase()}"></span>${esc(st)}</summary>
    <div class="status-pop"><p>${esc(updated)}${fetchStatus !== 'LIVE' ? ' · cannot reach the data service' : ''}</p><ul>${rows}${db}</ul></div>
  </details>`;
}
