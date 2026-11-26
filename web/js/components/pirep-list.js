// PIREPs within 150 nm. Order: urgent (UUA) → pilot reports (UA) and any report with turbulence/icing
// → one winds-aloft summary row standing in for all routine AIREPs (expandable).
import { esc } from '../lib/dom.js';
import { ago, nowSec } from '../lib/time.js';
import { compassAbbr, fmt } from '../lib/units.js';

const KIND_LABEL = { UUA: 'Urgent PIREP', UA: 'PIREP', AIREP: 'AIREP' };
const rank = (p) => (p.kind === 'UUA' ? 0 : p.turbulence || p.icing ? 1 : p.kind === 'UA' ? 2 : 3);
const isRoutine = (p) => p.kind === 'AIREP' && !p.turbulence && !p.icing;

function row(p, now) {
  const hazard = [p.turbulence && `Turb ${p.turbulence}`, p.icing && `Ice ${p.icing}`].filter(Boolean).join(' · ');
  return `<tr class="${p.kind === 'UUA' ? 'uua' : hazard ? 'hl' : ''}" title="${esc(p.raw)}">
    <td class="num">${esc(ago(p.obsTime, now))}</td>
    <td><span class="pk pk-${esc((p.kind ?? 'UA').toLowerCase())}">${esc(KIND_LABEL[p.kind] ?? p.type)}</span></td>
    <td>${esc(p.distNm)} nm ${esc(compassAbbr(p.bearingDeg))}</td>
    <td class="mono">${esc(fmt.flAlt(p.altFt))}</td>
    <td class="mono">${esc(p.acType ?? '—')}</td>
    <td>${hazard ? `<b>${esc(hazard)}</b>` : esc(p.negative ? `None reported (${p.negative})` : '—')}</td>
    <td class="hide-sm mono">${p.windKt != null ? `${esc(fmt.dir(p.windDirDeg))}/${esc(p.windKt)}kt` : ''} ${p.tempC != null ? esc(fmt.temp(p.tempC)) : ''}</td>
  </tr>`;
}

function summaryRow(w, routine, now) {
  const range = (a, b, f) => (a == null ? '—' : a === b ? f(a) : `${f(a)}–${f(b)}`);
  return `<tr class="aloft"><td colspan="7">
    <details><summary><b>Winds aloft</b> from ${w.count} routine AIREP${w.count === 1 ? '' : 's'} (no turbulence or icing):
      ${esc(range(w.minAltFt, w.maxAltFt, fmt.flAlt))} ·
      avg <span class="mono">${esc(fmt.dir(w.avgDirDeg))}/${esc(w.avgKt)} kt</span> (${esc(range(w.minKt, w.maxKt, (k) => `${k}`))} kt) ·
      ${esc(range(w.minTempC, w.maxTempC, fmt.temp))} · newest ${esc(ago(w.newest, now))}</summary>
      <table class="tbl pireps inner"><tbody>${routine.map((p) => row(p, now)).join('')}</tbody></table>
    </details></td></tr>`;
}

/**
 * @param {HTMLElement} el
 * @param {any[]} list
 * @param {{limit?: number, now?: number, windsAloft?: any}} opts
 */
export function renderPirepList(el, list, { limit = 20, now = nowSec(), windsAloft = null } = {}) {
  const all = list ?? [];
  if (!all.length) { el.innerHTML = '<p class="muted">No pilot reports within 150 nm in the last 3 h.</p>'; return; }
  const notable = all.filter((p) => !isRoutine(p)).sort((a, b) => rank(a) - rank(b) || b.obsTime - a.obsTime).slice(0, limit);
  const routine = all.filter(isRoutine);
  el.innerHTML = `${notable.length ? '' : '<p class="fine">No pilot reports (UA/UUA) and no turbulence or icing reported in the last 3 h.</p>'}
  <table class="tbl pireps"><thead><tr><th>Age</th><th>Kind</th><th>Position</th><th>Alt</th><th>Type</th><th>Turb / icing</th><th class="hide-sm">Wind / temp</th></tr></thead><tbody>
  ${notable.map((p) => row(p, now)).join('')}
  ${routine.length && windsAloft ? summaryRow(windsAloft, routine, now) : ''}
  </tbody></table>
  <p class="fine">Hover a row for the raw report. AIREPs are routine automated position reports from airliners.</p>`;
}
