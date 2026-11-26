// TAF raw + timeline bars coloured by category (with text labels — colour is never the only signal).
import { esc } from '../lib/dom.js';
import { ddhhmmZ, hm, localHour, localHourStart, nowSec } from '../lib/time.js';
import { fmt } from '../lib/units.js';

const ROW = { BASE: 0, FM: 0, BECMG: 1, TEMPO: 2, PROB: 3 };
const ROW_LABEL = ['Prevailing', 'BECMG', 'TEMPO', 'PROB'];

function summary(p) {
  const w = p.windKt == null ? '' : p.windKt === 0 ? 'calm' : `${p.windVariable || p.windDirDeg == null ? 'VRB' : fmt.dir(p.windDirDeg)}${fmt.num(p.windKt)}${p.gustKt ? 'G' + fmt.num(p.gustKt) : ''}KT`;
  const v = p.visSm != null ? `${p.visPlus ? 'P' : ''}${fmt.num(p.visSm, 2)}SM` : '';
  const c = p.vertVisFt != null ? `VV${String(Math.round(p.vertVisFt / 100)).padStart(3, '0')}` : (p.clouds ?? []).map((l) => `${l.cover}${l.baseFt != null ? String(Math.round(l.baseFt / 100)).padStart(3, '0') : ''}`).join(' ');
  return [w, v, p.wx, c].filter(Boolean).join(' ');
}

/** Ticks on real LOCAL clock hours divisible by `every` (e.g. 00:00, 03:00 … NST = 03:30Z, 06:30Z …). */
export function localTicks(t0, t1, every = 3) {
  const out = [];
  for (let t = localHourStart(t0) + (localHourStart(t0) < t0 ? 3600 : 0); t < t1; t += 3600) {
    if (localHour(t) % every === 0) out.push(t);
  }
  return out;
}

export function renderTafTimeline(el, taf, { showRaw = true, now = nowSec() } = {}) {
  if (!taf?.periods?.length) { el.innerHTML = '<p class="muted">No TAF available.</p>'; return; }
  const t0 = taf.validFrom, t1 = taf.validTo, span = Math.max(1, t1 - t0);
  const usedRows = [...new Set(taf.periods.map((p) => ROW[p.change] ?? 0))].sort();
  const pct = (t) => ((Math.min(Math.max(t, t0), t1) - t0) / span) * 100;

  const ticks = localTicks(t0, t1, 3);
  const nowP = pct(now);

  const bar = (p) => {
    const l = pct(p.from), w = Math.max(0.4, pct(p.to) - l);
    const label = `${p.change === 'PROB' ? `PROB${p.probability ?? ''}` : p.change === 'BASE' ? '' : p.change} ${p.category ?? ''}`.trim();
    const tip = `${p.change}${p.probability ? ' ' + p.probability + '%' : ''} ${ddhhmmZ(p.from)}–${ddhhmmZ(p.to)}: ${summary(p)} → ${p.category ?? '?'}`;
    return `<span class="taf-bar cat-${(p.category ?? 'none').toLowerCase()}" style="left:${l}%;width:${w}%" title="${esc(tip)}">${esc(label)}</span>`;
  };

  el.innerHTML = `
    ${showRaw ? `<pre class="raw raw-taf">${esc(taf.raw.replace(/\s(?=(FM\d{6}|TEMPO|BECMG|PROB\d{2}|RMK))/g, '\n  '))}</pre>` : ''}
    <div class="taf-chart" role="img" aria-label="TAF timeline from ${esc(ddhhmmZ(t0))} to ${esc(ddhhmmZ(t1))}">
      <div class="taf-axis"><span class="taf-rl"></span><div class="taf-track">
        ${ticks.map((t) => `<span class="taf-tick" style="left:${pct(t)}%">${esc(hm(t))}</span>`).join('')}</div></div>
      ${usedRows.map((r) => `<div class="taf-row"><span class="taf-rl">${ROW_LABEL[r]}</span><div class="taf-track">
        ${ticks.map((t) => `<span class="taf-grid" style="left:${pct(t)}%"></span>`).join('')}
        ${taf.periods.filter((p) => (ROW[p.change] ?? 0) === r).map(bar).join('')}
        ${nowP > 0 && nowP < 100 ? `<span class="taf-now" style="left:${nowP}%"></span>` : ''}</div></div>`).join('')}
    </div>
    <ol class="taf-list">${taf.periods.map((p) => `<li><span class="cat cat-${(p.category ?? 'none').toLowerCase()}">${esc(p.category ?? '—')}</span>
      <b>${esc(p.change === 'PROB' ? `PROB${p.probability ?? ''}` : p.change === 'BASE' ? 'Initial' : p.change)}</b>
      ${esc(ddhhmmZ(p.from))}–${esc(ddhhmmZ(p.to))} <span class="mono">${esc(summary(p))}</span></li>`).join('')}</ol>
    <p class="fine">Times on the chart are local hours; list times are UTC. Categories are derived (FAA convention). TEMPO/PROB/BECMG inherit unchanged fields from the prevailing period.</p>`;
}
