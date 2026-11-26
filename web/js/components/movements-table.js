// Observed ARR/DEP from our ADS-B detector (actual times, not scheduled).
import { esc } from '../lib/dom.js';
import { hm } from '../lib/time.js';
import { airlineName, loadAirlines } from '../lib/airlines.js';

/** @param {HTMLElement} el @param {import('../types.js').Movement[]} list */
export function renderMovements(el, list, { limit = 6, showRunway = true, empty = 'No landings or takeoffs observed recently.' } = {}) {
  const rows = (list ?? []).slice().sort((a, b) => b.ts - a.ts).slice(0, limit);
  if (!rows.length) {
    el.innerHTML = `<p class="muted">${esc(empty)}</p>${note()}`;
    return;
  }
  const draw = () => {
    el.innerHTML = `<table class="tbl movements">
      <thead><tr><th>Time</th><th></th><th>Flight</th><th>From / to</th><th class="hide-sm">Airline</th><th>Type</th>${showRunway ? '<th>Rwy</th>' : ''}</tr></thead>
      <tbody>${rows.map((m) => `<tr>
        <td class="num">${esc(hm(m.ts))}</td>
        <td><span class="kind kind-${m.kind.toLowerCase()}">${m.kind === 'ARR' ? 'Landed' : 'Took off'}</span>${m.confidence === 'LOW'
          ? ' <span class="conf-low" title="Low confidence: inferred from where coverage was lost or first gained, not from a ground contact.">est.</span>' : ''}</td>
        <td class="mono">${esc(m.callsign ?? m.reg ?? m.hex.toUpperCase())}</td>
        <td class="mono" title="${esc(m.other?.name ?? 'Route unknown')} (community route data, unverified)">${m.other ? `${m.kind === 'ARR' ? 'from' : 'to'} ${esc(m.other.iata ?? m.other.icao)}` : '—'}</td>
        <td class="hide-sm">${esc(airlineName(m.airline) ?? (m.airline ?? '—'))}</td>
        <td class="mono">${esc(m.type ?? '—')}</td>
        ${showRunway ? `<td class="mono">${esc(m.runway ?? '—')}</td>` : ''}
      </tr>`).join('')}</tbody></table>${note()}`;
  };
  draw();
  loadAirlines().then(draw);
}

const note = () => '<p class="fine">Detected from ADS-B. Low-altitude coverage at YYT can be thin, so some movements are missed or marked “est.”</p>';
