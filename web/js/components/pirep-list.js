// PIREPs / AIREPs within 150 nm.
import { esc } from '../lib/dom.js';
import { ago } from '../lib/time.js';
import { compassAbbr, fmt } from '../lib/units.js';

export function renderPirepList(el, list, { limit = 20 } = {}) {
  const rows = (list ?? []).slice(0, limit);
  if (!rows.length) { el.innerHTML = '<p class="muted">No pilot reports within 150 nm in the last 3 h.</p>'; return; }
  const sig = rows.filter((p) => p.turbulence || p.icing);
  el.innerHTML = `${sig.length ? '' : '<p class="fine">No turbulence or icing reported in these reports.</p>'}
  <table class="tbl pireps"><thead><tr><th>Age</th><th>Position</th><th>Alt</th><th>Type</th><th>Turb / icing</th><th class="hide-sm">Wind / temp</th></tr></thead><tbody>
  ${rows.map((p) => `<tr class="${p.turbulence || p.icing ? 'hl' : ''}" title="${esc(p.raw)}">
    <td class="num">${esc(ago(p.obsTime))}</td>
    <td>${esc(p.distNm)} nm ${esc(compassAbbr(p.bearingDeg))}</td>
    <td class="mono">${esc(fmt.flAlt(p.altFt))}</td>
    <td class="mono">${esc(p.acType ?? '—')} <small>${esc(p.type)}</small></td>
    <td>${esc([p.turbulence && `Turb ${p.turbulence}`, p.icing && `Ice ${p.icing}`].filter(Boolean).join(' · ') || '—')}</td>
    <td class="hide-sm mono">${p.windKt != null ? `${esc(fmt.dir(p.windDirDeg))}/${esc(p.windKt)}kt` : ''} ${p.tempC != null ? esc(fmt.temp(p.tempC)) : ''}</td>
  </tr>`).join('')}</tbody></table>
  <p class="fine">Hover a row for the raw report. AIREPs are routine automated position reports.</p>`;
}
