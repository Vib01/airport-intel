// Runway wind diagram: compass with runways (TRUE headings) and wind arrow, plus head/crosswind per runway.
// Runway geometry is only drawn when official headings are configured in the Worker.
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/units.js';

const REASON = {
  CALM: 'Calm wind',
  VARIABLE: 'Variable wind — components not computed',
  NO_WIND: 'No wind reported',
  RUNWAY_CONFIG_MISSING: 'Runway headings not configured yet (awaiting official CFS values)',
};

function compass(meta, m) {
  const R = 90, cx = 110, cy = 110;
  const pt = (deg, r) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  const rwys = (meta?.runways ?? []).filter((r) => r.trueHdg != null);
  const drawn = new Set();
  const strips = rwys.map((r) => {
    const key = Math.round(((r.trueHdg % 180) + 180) % 180);
    if (drawn.has(key)) return '';
    drawn.add(key);
    const [x1, y1] = pt(r.trueHdg, 62), [x2, y2] = pt(r.trueHdg + 180, 62);
    return `<line class="rwy" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('') + rwys.map((r) => {
    // label at the approach end: aircraft on runway X fly heading X, so the threshold is at X+180.
    const [x, y] = pt(r.trueHdg + 180, 76);
    return `<text class="rwy-l" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${esc(r.id)}</text>`;
  }).join('');
  let arrow = '';
  if (m && m.windKt > 0 && m.windDirDeg != null && !m.windVariable) {
    const [sx, sy] = pt(m.windDirDeg, R - 4), [ex, ey] = pt(m.windDirDeg, 18);
    arrow = `<line class="wind-arrow" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" marker-end="url(#ah)"/>`;
  }
  const ticks = [0, 90, 180, 270].map((d, i) => { const [x, y] = pt(d, R + 12); return `<text class="card" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${'NESW'[i]}</text>`; }).join('');
  return `<svg viewBox="0 0 220 220" class="compass" role="img" aria-label="Wind and runway diagram">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ah"/></marker></defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" class="ring"/>${ticks}${strips}${arrow}
    ${!rwys.length ? `<text class="fine-svg" x="${cx}" y="${cy}" text-anchor="middle">runways not configured</text>` : ''}
  </svg>`;
}

/** @param {HTMLElement} el */
export function renderWindRunways(el, w, meta) {
  const m = w?.metar?.decoded ?? null;
  const list = w?.derived?.wind ?? [];
  const ok = list.filter((r) => r.ok);
  const best = ok.length ? ok.reduce((a, b) => (b.headwindKt > a.headwindKt ? b : a)) : null;
  const windTxt = !m ? 'No observation' : m.windKt === 0 ? 'Calm'
    : `${m.windVariable || m.windDirDeg == null ? 'VRB' : fmt.dir(m.windDirDeg) + 'T'} ${fmt.num(m.windKt)} kt${m.gustKt ? ` G${fmt.num(m.gustKt)}` : ''}`;
  const missing = list.length && list.every((r) => !r.ok && r.reason === 'RUNWAY_CONFIG_MISSING');
  const comp = (h, c, side) => `${h >= 0 ? 'Head' : 'Tail'} ${Math.abs(fmt.num(h))} · X ${fmt.num(c)}${side ? ' ' + side : ''}`;

  el.innerHTML = `<div class="wind-wrap">
    ${compass(meta, m)}
    <div class="wind-table">
      <p class="wind-now">Wind <b class="mono">${esc(windTxt)}</b></p>
      ${missing || !ok.length ? `<p class="muted">${esc(REASON[list[0]?.reason] ?? 'No wind data')}</p>` : `
      <table class="tbl wind"><thead><tr><th>Rwy</th><th>Sustained (kt)</th><th>Gust (kt)</th></tr></thead><tbody>
      ${list.map((r) => r.ok ? `<tr class="${best && r.rwy === best.rwy ? 'best' : ''} ${r.headwindKt < 0 ? 'tail' : ''}">
        <td class="mono"><b>${esc(r.rwy)}</b>${best && r.rwy === best.rwy ? ' <span class="tag">best headwind</span>' : ''}</td>
        <td>${esc(comp(r.headwindKt, r.crosswindKt, r.side))}</td>
        <td>${r.gustHeadwindKt != null ? esc(comp(r.gustHeadwindKt, r.gustCrosswindKt, r.side)) : '—'}</td></tr>`
        : `<tr><td class="mono">${esc(r.rwy)}</td><td colspan="2" class="muted">${esc(REASON[r.reason] ?? r.reason)}</td></tr>`).join('')}
      </tbody></table>`}
      <p class="fine">Computed from METAR wind (true) and runway true headings. "Best headwind" is arithmetic, not the runway in use.</p>
    </div></div>`;
}
