// Side sheet with details for one aircraft.
import { esc } from '../lib/dom.js';
import { compassAbbr, fmt } from '../lib/units.js';
import { ago, hm, nowSec } from '../lib/time.js';
import { airlineName, loadAirlines } from '../lib/airlines.js';

/** @param {HTMLElement} el @param {import('../types.js').Aircraft|null} a */
export function renderAircraftDetail(el, a, onClose, now = nowSec()) {
  if (!a) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const draw = () => {
    const rows = [
      ['Callsign', a.callsign ?? '—'],
      ['Airline', airlineName(a.airline) ?? a.airline ?? '—'],
      ['Registration', a.reg ?? '—'],
      ['Type', [a.type, a.desc].filter(Boolean).join(' · ') || '—'],
      ['Altitude', a.onGround ? 'On ground' : `${fmt.alt(a.altFt)}${a.altBaroFt != null ? ` (baro ${fmt.flAlt(a.altBaroFt)})` : ''}`],
      ['Ground speed', a.gsKt != null ? `${fmt.num(a.gsKt)} kt` : '—'],
      ['Vertical speed', a.vsFpm != null ? `${a.vsFpm > 0 ? '+' : ''}${fmt.num(a.vsFpm).toLocaleString()} ft/min` : '—'],
      ['Track', a.trackDeg != null ? `${fmt.dir(a.trackDeg)} true` : '—'],
      ['Squawk', a.squawk ?? '—'],
      ['From YYT', `${a.distNm} nm ${compassAbbr(a.bearingDeg)} (${fmt.dir(a.bearingDeg)})`],
      ['ICAO hex', a.hex.toUpperCase()],
      ['Position', `${hm(a.ts)} local · ${ago(a.ts, now)}`],
      ['Route', 'Not shown — ADS-B routes are community-sourced and unverified'],
    ];
    el.innerHTML = `<div class="sheet-h">
        <h3>${esc(a.callsign ?? a.reg ?? a.hex.toUpperCase())}</h3>
        <button type="button" class="btn-close" aria-label="Close details">×</button></div>
      ${a.alert ? `<p class="alert-banner alert-${esc(a.alert.kind.toLowerCase())}">${esc(a.alert.label)}</p>` : ''}
      <table class="tbl kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      <p class="fine">Trail: last 15 min. <a href="https://globe.adsb.lol/?icao=${esc(a.hex)}" target="_blank" rel="noopener">Open on adsb.lol globe</a></p>`;
    el.querySelector('.btn-close').addEventListener('click', () => onClose?.());
  };
  draw();
  loadAirlines().then(() => { if (!el.hidden) draw(); });
}
