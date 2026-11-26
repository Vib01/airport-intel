// Top-of-page KPI tiles: the key numbers at a glance. Every tile has a text label (not colour only).
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/units.js';
import { hm, nowSec } from '../lib/time.js';
import { sunTimes } from './sun-times.js';
import { categoryBadge } from './metar-panel.js';

const CEIL = new Set(['BKN', 'OVC']);
/** Display helper only (the Worker owns flight category); lowest BKN/OVC layer or VV. */
function ceiling(m) {
  if (!m) return null;
  if (m.vertVisFt != null) return { ft: m.vertVisFt, txt: `VV ${m.vertVisFt.toLocaleString()} ft` };
  const l = (m.clouds ?? []).filter((c) => CEIL.has(c.cover) && c.baseFt != null).sort((a, b) => a.baseFt - b.baseFt)[0];
  return l ? { ft: l.baseFt, txt: `${l.cover} ${l.baseFt.toLocaleString()} ft` } : { ft: null, txt: 'None' };
}

const TREND = { RISING: '↑ rising', FALLING: '↓ falling', STEADY: '→ steady' };

/** @param {HTMLElement} el @param {import('../types.js').Dashboard|null} d */
export function renderKpis(el, d, now = nowSec()) {
  const m = d?.weather?.metar?.decoded ?? null;
  const dv = d?.weather?.derived ?? null;
  const t = d?.stats?.today ?? null;
  const ac = d?.aircraft ?? [];
  const airborne = ac.filter((a) => !a.onGround).length;
  const alerts = ac.filter((a) => a.alert);
  const inbound = (d?.flights?.arrivals ?? []).filter((r) => r.tracked && r.status !== 'LANDED');
  const outbound = (d?.flights?.departures ?? []).filter((r) => r.tracked);
  const c = ceiling(m);
  const sun = sunTimes(new Date(now * 1000));
  const rw = d?.runway;
  const wind = !m ? '—' : m.windKt === 0 ? 'Calm'
    : `${m.windVariable || m.windDirDeg == null ? 'VRB' : fmt.dir(m.windDirDeg)} ${fmt.num(m.windKt)}${m.gustKt ? 'G' + fmt.num(m.gustKt) : ''} kt`;

  const tiles = [
    ['Flight category', categoryBadge(dv?.category, { long: true }), dv?.ageMin != null ? `METAR ${dv.ageMin} min old` : '', dv?.ageMin > 70 ? 'warn' : ''],
    ['Wind', esc(wind), m && m.windKt ? `${esc(fmt.wind(m.windKt, 'metric'))}${m.gustKt ? ' gust ' + esc(fmt.wind(m.gustKt, 'metric')) : ''}` : ''],
    ['Visibility', esc(fmt.visSm(m?.visSm, m?.visPlus, 'aviation')), esc(fmt.visSm(m?.visSm, m?.visPlus, 'metric'))],
    ['Ceiling', esc(c?.txt ?? '—'), c?.ft != null ? esc(fmt.alt(c.ft, 'metric')) : ''],
    ['Temp / dew', esc(`${fmt.temp(m?.tempC)} / ${fmt.temp(m?.dewpC)}`), m?.wx ? esc(m.wx) : ''],
    ['Altimeter', esc(fmt.hpa(m?.altimHpa)), `${esc(fmt.inHg(m?.altimHpa))}${dv?.trend ? ' · ' + esc(TREND[dv.trend.trend]) : ''}`],
    ['Density alt.', esc(dv?.da ? fmt.alt(dv.da.densityAltFt) : '—'), dv?.da ? `PA ${esc(fmt.alt(dv.da.pressureAltFt))}` : ''],
    ['Runway in use', esc(rw?.runway ?? '—'), esc(rw?.runway ? `${rw.count} aircraft / 20 min (observed)` : rw?.reason === 'RUNWAY_CONFIG_MISSING' ? 'headings not configured' : 'no recent traffic')],
    ['Aircraft nearby', `${ac.length}`, `${airborne} airborne · 60 nm${alerts.length ? ` · <b class="alert-text">${alerts.length} special squawk</b>` : ''}`, alerts.length ? 'bad' : ''],
    ['Arriving now', `${inbound.length}`, inbound[0] ? esc(`next: ${inbound[0].callsign}${inbound[0].etaTs ? ' ~' + hm(inbound[0].etaTs) : ''}`) : 'no inbound in range'],
    ['Departing now', `${outbound.length}`, outbound[0] ? esc(`${outbound[0].callsign} → ${outbound[0].other?.iata ?? outbound[0].other?.icao ?? '?'}`) : 'none in range'],
    ['Movements today', `${t?.total ?? '—'}`, t ? `${t.arr} landed · ${t.dep} departed` : ''],
    ['Busiest hour', esc(t?.busiestHour ? hm(t.busiestHour.hourTs) : '—'), t?.busiestHour ? `${t.busiestHour.count} movements` : ''],
    ['Sunrise / sunset', esc(sun ? `${hm(sun.sunrise)} / ${hm(sun.sunset)}` : '—'), sun ? `civil ${esc(hm(sun.dawn))}–${esc(hm(sun.dusk))}` : ''],
  ];
  el.innerHTML = `<dl class="kpis">${tiles.map(([k, v, sub, tone]) =>
    `<div class="kpi ${tone ? 'kpi-' + tone : ''}"><dt>${esc(k)}</dt><dd>${v}</dd>${sub ? `<small>${sub}</small>` : ''}</div>`).join('')}</dl>`;
}
