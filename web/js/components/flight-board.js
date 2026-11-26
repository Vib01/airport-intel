// Live arrivals / departures board from our own ADS-B tracking + community route data.
// Covers flights in or near coverage (not tomorrow's timetable). Routes are unverified; ETAs are estimates.
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/units.js';
import { hm } from '../lib/time.js';
import { airlineName, loadAirlines } from '../lib/airlines.js';

const STATUS = {
  ON_FINAL: ['On final', 'st-final'],
  APPROACHING: ['Approaching', 'st-appr'],
  EN_ROUTE: ['En route', 'st-enroute'],
  LANDED: ['Landed', 'st-landed'],
  AT_GATE: ['At gate', 'st-gate'],
  TAXIING: ['Taxiing', 'st-taxi'],
  DEPARTED: ['Departed', 'st-dep'],
  ON_GROUND: ['On ground', 'st-gate'],
  CLIMBING: ['Climbing', 'st-dep'],
  DESCENDING: ['Descending', 'st-appr'],
  LEVEL: ['Level', 'st-enroute'],
};

const place = (ap) => (ap ? `${ap.iata ?? ap.icao}${ap.location ? ` <small>${esc(ap.location)}</small>` : ''}` : '<span class="muted">—</span>');

function status(r, kind) {
  const [label, cls] = STATUS[r.status] ?? [r.status, ''];
  let t = '';
  if (r.statusTs && (r.status === 'LANDED' || r.status === 'DEPARTED')) t = ` ${hm(r.statusTs)}`;
  else if (kind === 'arr' && r.etaTs) t = ` · ETA ~${hm(r.etaTs)}`;
  return `<span class="fst ${cls}">${esc(label)}</span>${esc(t)}`;
}

function table(rows, kind, compact) {
  if (!rows?.length) {
    return `<p class="muted">${kind === 'arr' ? 'No inbound flights to YYT in range right now.' : 'No outbound flights from YYT in range right now.'}</p>`;
  }
  return `<table class="tbl fboard">
    <thead><tr><th>Flight</th><th>${kind === 'arr' ? 'From' : 'To'}</th><th>Status</th>${compact ? '' : '<th class="hide-sm">Aircraft</th><th class="hide-sm">Alt / dist</th>'}</tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.tracked ? '' : 'untracked'}">
      <td><b class="mono">${esc(r.callsign)}</b><br><small>${esc(airlineName(r.airline) ?? r.airline ?? '')}</small></td>
      <td>${place(r.other)}</td>
      <td>${status(r, kind)}</td>
      ${compact ? '' : `<td class="hide-sm mono">${esc(r.type ?? '—')}${r.reg ? `<br><small>${esc(r.reg)}</small>` : ''}</td>
      <td class="hide-sm">${r.tracked ? `${esc(r.altFt != null ? fmt.flAlt(r.altFt) : 'GND')}<br><small>${esc(r.distNm)} nm</small>` : '<small class="muted">out of coverage</small>'}</td>`}
    </tr>`).join('')}</tbody></table>`;
}

function localTable(rows) {
  if (!rows?.length) return '<p class="muted">No low-level traffic within 15 nm.</p>';
  return `<table class="tbl fboard">
    <thead><tr><th>Aircraft</th><th>Status</th><th>Alt / dist</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><b class="mono">${esc(r.callsign)}</b><br><small>${esc([r.type, airlineName(r.airline)].filter(Boolean).join(' · '))}</small></td>
      <td>${status(r, 'local')}</td>
      <td>${esc(r.altFt != null ? fmt.flAlt(r.altFt) : 'GND')}<br><small>${esc(r.distNm)} nm</small></td>
    </tr>`).join('')}</tbody></table>`;
}

/** @param {HTMLElement} el */
export function renderFlightBoard(el, board, { compact = false, which = 'both' } = {}) {
  const draw = () => {
    const parts = [];
    if (which !== 'dep') parts.push(`<div class="fb-col"><h3 class="fb-h">Arrivals</h3>${table(board?.arrivals, 'arr', compact)}</div>`);
    if (which !== 'arr') parts.push(`<div class="fb-col"><h3 class="fb-h">Departures</h3>${table(board?.departures, 'dep', compact)}</div>`);
    if (which === 'both' && !compact) parts.push(`<div class="fb-col"><h3 class="fb-h">Local traffic</h3>${localTable(board?.local)}</div>`);
    const over = board?.overflights ?? 0;
    el.innerHTML = `<div class="fb fb-${which}">${parts.join('')}</div>
      ${compact ? '' : `<p class="fb-summary">${over ? `Also tracking <b>${over}</b> overflight${over === 1 ? '' : 's'} passing YYT (not landing or departing). ` : ''}Shown on the map below.</p>
      <p class="fine">Live from ADS-B tracking: flights inbound to or outbound from YYT within ~60 nm, landings/takeoffs detected in the last 3 h,
      and local traffic (helicopters, light aircraft, unknown routes) within 15 nm below 10,000 ft.
      Origins/destinations come from ${esc(board?.routeSource ?? 'community route data')} — unverified. ETAs are distance ÷ ground speed, not airline estimates.
      Coverage depends on volunteer ADS-B receivers: smaller aircraft at low altitude near St. John's are sometimes not received, so the scheduled board above is the complete list.</p>`}`;
  };
  draw();
  loadAirlines().then(draw);
}
