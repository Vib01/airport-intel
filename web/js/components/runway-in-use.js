// Observed runway in use (derived from ADS-B tracks — never from wind, never official).
import { esc } from '../lib/dom.js';
import { ago } from '../lib/time.js';

export function runwayInUseText(r) {
  if (!r) return 'No data';
  if (r.reason === 'RUNWAY_CONFIG_MISSING') return 'Not available — runway headings not configured';
  if (!r.runway) return 'No recent traffic';
  return `Observed in use: ${r.runway} (${r.count} aircraft / 20 min)`;
}

export function renderRunwayInUse(el, r) {
  el.innerHTML = `<p class="rwy-use">${r?.runway ? `<span class="rwy-big">${esc(r.runway)}</span>` : ''}<span>${esc(runwayInUseText(r))}</span></p>
    ${r?.lastSeenAt ? `<p class="fine">Last aligned aircraft ${esc(ago(r.lastSeenAt))}.</p>` : ''}
    <p class="fine">Inferred from aircraft below 1,500 ft within 5 nm aligned with a runway. Not an ATC/ATIS statement — check the ATIS.</p>`;
}
