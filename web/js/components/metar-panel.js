// Raw (copyable) + decoded METAR, flight category badge (FAA convention), age, pressure trend.
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/units.js';
import { ddhhmmZ, hm } from '../lib/time.js';
import { wxToWords } from '../lib/wx.js';

const METAR_OLD_MIN = 70;

export const categoryBadge = (cat, { long = false } = {}) => cat
  ? `<span class="cat cat-${esc(cat.toLowerCase())}" title="Flight category, US FAA convention (derived, not official)">${esc(cat)}${long ? ' <small>FAA conv.</small>' : ''}</span>`
  : '<span class="cat cat-none">—</span>';

const TREND_ARROW = { RISING: '↑', FALLING: '↓', STEADY: '→' };

export function renderMetarPanel(el, w) {
  const m = w?.metar?.decoded;
  const d = w?.derived;
  if (!m) { el.innerHTML = '<p class="muted">No METAR available.</p>'; return; }
  const age = d?.ageMin ?? null;
  const wind = m.windKt === 0 ? 'Calm'
    : `${m.windVariable || m.windDirDeg == null ? 'VRB' : fmt.dir(m.windDirDeg) + ' true'} ${fmt.num(m.windKt)} kt${m.gustKt ? ` gust ${fmt.num(m.gustKt)} kt` : ''}`;
  const clouds = m.vertVisFt != null ? `Vertical visibility ${m.vertVisFt.toLocaleString()} ft`
    : m.cavok ? 'CAVOK' : m.clouds.length ? m.clouds.map((c) => `${c.cover} ${c.baseFt != null ? c.baseFt.toLocaleString() + ' ft' : ''}`).join(', ') : 'Clear';
  const rows = [
    ['Observed', `${ddhhmmZ(m.obsTime)} (${hm(m.obsTime)} local)`],
    ['Wind', wind],
    ['Visibility', fmt.visSm(m.visSm, m.visPlus, 'aviation')],
    ['Weather', wxToWords(m.wx) ?? 'None reported'],
    ['Cloud', clouds],
    ['Temp / dew point', `${fmt.temp(m.tempC)} / ${fmt.temp(m.dewpC)}`],
    ['Altimeter', `${fmt.hpa(m.altimHpa)} · ${fmt.inHg(m.altimHpa)}`],
  ];
  el.innerHTML = `
    <div class="metar-top">
      ${categoryBadge(d?.category, { long: true })}
      <span class="age ${age != null && age > METAR_OLD_MIN ? 'age-old' : ''}">${age != null ? `${age} min old` : ''}${age != null && age > METAR_OLD_MIN ? ' — check for a newer report' : ''}</span>
      ${d?.trend ? `<span class="trend" title="Change over ${esc(d.trend.spanHours)} h">${TREND_ARROW[d.trend.trend]} ${esc(d.trend.trend.toLowerCase())} ${d.trend.deltaHpa > 0 ? '+' : ''}${esc(d.trend.deltaHpa)} hPa / ${esc(d.trend.spanHours)} h</span>` : ''}
    </div>
    <div class="raw-wrap"><pre class="raw" id="metar-raw">${esc(m.raw)}</pre><button type="button" class="btn-copy" data-copy="${esc(m.raw)}">Copy</button></div>
    <table class="tbl kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
  const btn = el.querySelector('.btn-copy');
  btn?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied'; } catch { btn.textContent = 'Select & copy'; }
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  });
}
