// tv.html — public display for a monitor. Fixed 1920×1080 stage scaled to the screen, no interaction,
// cursor hidden, data polled every 15 s, flight boards reloaded every 5 min, full page reload every 6 h.
import { BOARD_CONFIGURED, POLL_MS, POLL_SLOW_MS } from './config.js';
import { combine, poll, refreshStatuses } from './api.js';
import { subscribe } from './state.js';
import { panel, setPanelStatus, esc } from './lib/dom.js';
import { hm, nowSec, tzAbbr, ago, dateLong } from './lib/time.js';
import { fmt } from './lib/units.js';
import { AircraftMap } from './components/aircraft-map.js';
import { boardEmbed } from './components/board-embed.js';
import { renderFlightBoard } from './components/flight-board.js';
import { categoryBadge } from './components/metar-panel.js';
import { weatherSentence } from './components/weather-card.js';
import { renderWindRunways } from './components/wind-runways.js';
import { runwayInUseText } from './components/runway-in-use.js';
import { renderSunTimes } from './components/sun-times.js';
import { renderStatusPill } from './components/status-pill.js';
import { disclaimer } from './components/disclaimer.js';
import { attribution } from './components/attribution.js';

const RELOAD_MS = 6 * 3600 * 1000;
const W = 1920, H = 1080;
const $ = (id) => document.getElementById(id);

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  $('stage').style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit();
setTimeout(() => location.reload(), RELOAD_MS);

const clock = () => { const t = nowSec(); $('tv-clock').innerHTML = `${esc(hm(t))} <small>${esc(tzAbbr(t))} · ${esc(dateLong(t))}</small>`; };
clock(); setInterval(clock, 10_000);
setInterval(refreshStatuses, 5_000);

// ---- Flight boards (provider widget, 11 rows each) or our live board as a fallback
const boards = $('tv-boards');
if (BOARD_CONFIGURED) boards.append(boardEmbed('both', { rows: 11, links: false }));
else boards.innerHTML = '<div class="tv-live-board" id="tv-live-board"></div>';

// ---- Panels
const wx = panel('Weather & runway wind');
$('tv-wx').replaceWith(Object.assign(wx.el, { className: 'tv-wx panel' }));
const info = panel('Today at YYT');
$('tv-info').replaceWith(Object.assign(info.el, { className: 'tv-info panel' }));
info.body.innerHTML = '<dl class="tv-kpis" id="tv-kpis"></dl><div id="tv-sun"></div>';

const map = new AircraftMap($('tv-map'), { labels: true, trails: true, interactive: false, fitNm: 40 });

poll('dashboard', '/v1/dashboard', POLL_MS);
poll('pilot', '/v1/pilot', POLL_SLOW_MS);

subscribe('dashboard', (s) => {
  const d = s.data;
  const src = d?.health?.sources ?? {};
  const m = d?.weather?.metar?.decoded;
  $('tv-cat').innerHTML = categoryBadge(d?.weather?.derived?.category, { long: true });
  $('tv-wxline').textContent = m ? `${fmt.temp(m.tempC)} · ${weatherSentence(m)}` : '';
  renderStatusPill($('tv-status'), s.status, d?.health ?? null, s.okAt);
  if (d) { map.setMeta(d.meta); map.update(d.aircraft ?? []); }
  $('tv-count').textContent = `${(d?.aircraft ?? []).length} aircraft within 60 nm · live ADS-B`;
  if (!BOARD_CONFIGURED) renderFlightBoard($('tv-live-board'), d?.flights, { compact: true });

  const t = d?.stats?.today;
  const inbound = (d?.flights?.arrivals ?? []).filter((r) => r.tracked && r.status !== 'LANDED');
  const tiles = [
    ['Landings today', t?.arr ?? '—'], ['Takeoffs today', t?.dep ?? '—'],
    ['Aircraft nearby', (d?.aircraft ?? []).length], ['Inbound now', inbound.length],
    ['Runway in use', d?.runway?.runway ?? '—'],
    ['Busiest hour', t?.busiestHour ? hm(t.busiestHour.hourTs) : '—'],
  ];
  $('tv-kpis').innerHTML = tiles.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  setPanelStatus(info, combine(s.status, src.adsb?.status));

  $('tv-foot').replaceChildren(disclaimer(true), attribution(src.adsb?.sourceUsed ?? null, true),
    Object.assign(document.createElement('span'), { className: 'tv-upd', textContent: `Updated ${s.okAt ? ago(Math.floor(s.okAt / 1000)) : '—'}` }));
});

subscribe('pilot', (s) => {
  const d = s.data;
  renderWindRunways(wx.body, d, d?.meta);
  wx.body.insertAdjacentHTML('beforeend', `<p class="tv-rwy">${esc(runwayInUseText(d?.runway))}</p>`);
  setPanelStatus(wx, combine(s.status, d?.health?.sources?.metar?.status));
});

renderSunTimes($('tv-sun'), true);
setInterval(() => renderSunTimes($('tv-sun'), true), 10 * 60_000);
