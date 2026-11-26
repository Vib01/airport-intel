// Pressure altitude, density altitude, altimeter (hPa + inHg).
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/units.js';

export function renderDaPanel(el, w, meta) {
  const m = w?.metar?.decoded, da = w?.derived?.da;
  if (!m) { el.innerHTML = '<p class="muted">No observation.</p>'; return; }
  const items = [
    ['Altimeter', fmt.hpa(m.altimHpa), fmt.inHg(m.altimHpa)],
    ['Pressure altitude', da ? fmt.alt(da.pressureAltFt) : '—', ''],
    ['Density altitude', da ? fmt.alt(da.densityAltFt) : '—', da ? `ISA ${fmt.temp(da.isaTempC)} · OAT ${fmt.temp(m.tempC)}` : ''],
  ];
  el.innerHTML = `<dl class="stats-grid">${items.map(([k, v, s]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')}</dl>
    <p class="fine">Field elevation ${esc(meta?.elevFt ?? '—')} ft (config, verify against CFS). PA ≈ elev + (1013.25 − QNH) × 27 ft; DA = PA + 120 × (OAT − ISA). Estimates only.</p>`;
}
