// Sunrise / sunset / civil twilight via vendored SunCalc (BSD-2), computed client-side.
import { hm } from '../lib/time.js';
import { esc } from '../lib/dom.js';

const LAT = 47.6186, LON = -52.7519;

export function sunTimes(date = new Date()) {
  const SC = window.SunCalc;
  if (!SC) return null;
  const t = SC.getTimes(date, LAT, LON);
  const s = (d) => (d instanceof Date && !isNaN(d) ? Math.floor(d.getTime() / 1000) : null);
  return { dawn: s(t.dawn), sunrise: s(t.sunrise), sunset: s(t.sunset), dusk: s(t.dusk) };
}

export function renderSunTimes(el, compact = false, now = null) {
  const t = sunTimes(now != null ? new Date(now * 1000) : new Date());
  if (!t) { el.textContent = 'Sun times unavailable'; return; }
  const items = [['Civil dawn', t.dawn], ['Sunrise', t.sunrise], ['Sunset', t.sunset], ['Civil dusk', t.dusk]];
  el.innerHTML = `<dl class="sun ${compact ? 'compact' : ''}">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(hm(v))}</dd></div>`).join('')}</dl>`;
}
