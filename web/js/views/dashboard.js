// Single-page dashboard: every KPI and detail on one page, grouped into sections.
import { POLL_SLOW_MS, LINKS } from '../config.js';
import { combine, poll } from '../api.js';
import { subscribe } from '../state.js';
import { panel, setPanelStatus, esc } from '../lib/dom.js';
import { onUnitMode, fmt } from '../lib/units.js';
import { ddhhmmZ, nowSec } from '../lib/time.js';
import { loadAirlines } from '../lib/airlines.js';
import { renderKpis } from '../components/kpi-strip.js';
import { liveMapEmbed } from '../components/live-map-embed.js';
import { boardEmbed } from '../components/board-embed.js';
import { renderFlightBoard } from '../components/flight-board.js';
import { renderMovements } from '../components/movements-table.js';
import { renderWeatherCard } from '../components/weather-card.js';
import { renderMetarPanel } from '../components/metar-panel.js';
import { renderTafTimeline } from '../components/taf-timeline.js';
import { renderWindRunways } from '../components/wind-runways.js';
import { renderDaPanel } from '../components/da-panel.js';
import { renderRunwayInUse } from '../components/runway-in-use.js';
import { renderPirepList } from '../components/pirep-list.js';
import { renderSunTimes } from '../components/sun-times.js';

export const SECTIONS = [
  ['overview', 'Overview'], ['flights', 'Flights'], ['traffic', 'Traffic'], ['weather', 'Weather'],
  ['pilot', 'Pilot'],
];

function section(id, title) {
  const s = document.createElement('section');
  s.id = `sec-${id}`;
  s.className = `sec sec-${id}`;
  s.setAttribute('aria-labelledby', `sec-${id}-h`);
  s.innerHTML = `<h2 class="sec-h" id="sec-${id}-h">${esc(title)}</h2>`;
  return s;
}

export function mount(root) {
  root.className = 'view view-dash';

  // ---- Overview: KPI strip
  const sOver = section('overview', 'At a glance');
  const kpi = document.createElement('div');
  sOver.append(kpi);

  // ---- Flights: live arrivals/departures board (own tracking) + scheduled widget/links
  const sFl = section('flights', 'Arrivals & departures');
  const pBoard = panel('Scheduled arrivals & departures', { cls: 'd-board' });
  const pFlights = panel('Tracked now (our ADS-B)', { cls: 'd-flights' });
  const board = boardEmbed('both');
  pBoard.body.append(board);
  sFl.append(pBoard.el, pFlights.el);

  // ---- Traffic: map + observed movements
  const sTraffic = section('traffic', 'Live traffic');
  const pMap = panel('Live map', { cls: 'd-map' });
  const pMv = panel('Observed landings & takeoffs', { cls: 'd-mv' });
  sTraffic.append(pMap.el, pMv.el);

  // ---- Weather
  const sWx = section('weather', 'Weather');
  const pWx = panel('Now & next 24 h', { cls: 'd-wx' });
  const pMetar = panel('METAR', { cls: 'd-metar' });
  const pTaf = panel('TAF', { cls: 'd-taf' });
  sWx.append(pWx.el, pMetar.el, pTaf.el);

  // ---- Pilot
  const sPilot = section('pilot', 'Pilot data');
  const pWind = panel('Runway wind', { cls: 'd-wind' });
  const pRwy = panel('Observed runway in use', { cls: 'd-rwy' });
  const pDa = panel('Pressure & density altitude', { cls: 'd-da' });
  const pPirep = panel('PIREPs within 150 nm', { cls: 'd-pirep' });
  const pSig = panel('SIGMETs affecting the area', { cls: 'd-sig' });
  const pLinks = panel('Official sources & sun', { cls: 'd-links' });
  sPilot.append(pWind.el, pRwy.el, pDa.el, pPirep.el, pSig.el, pLinks.el);

  root.append(sOver, sFl, sTraffic, sWx, sPilot);


  pMap.body.append(liveMapEmbed());
  pLinks.body.innerHTML = `<ul class="links">
      <li><a href="${esc(LINKS.navcanCfps)}" target="_blank" rel="noopener">NAV CANADA CFPS</a> — NOTAMs, GFA, official METAR/TAF</li>
      <li>NOTAMs are <b>not</b> shown on this site. Always check them.</li>
      <li><a href="${esc(LINKS.flightaware)}" target="_blank" rel="noopener">FlightAware</a> · <a href="${esc(LINKS.flightradar)}" target="_blank" rel="noopener">Flightradar24</a></li>
    </ul><div class="sun-slot"></div>`;
  const sunSlot = pLinks.body.querySelector('.sun-slot');
  renderSunTimes(sunSlot, true);

  // ---- data
  const stopPilot = poll('pilot', '/v1/pilot', POLL_SLOW_MS);

  let lastDash = null;
  const drawDash = (s) => {
    lastDash = s;
    const now = nowSec();                     // one clock reading per render, passed to every panel
    const d = s.data;
    const src = d?.health?.sources ?? {};
    const adsb = combine(s.status, src.adsb?.status);
    renderKpis(kpi, d, now);
    renderFlightBoard(pFlights.body, d?.flights);
    setPanelStatus(pFlights, adsb);


    renderMovements(pMv.body, d?.movements ?? [], { limit: 10, showRunway: true });
    setPanelStatus(pMv, adsb);
    renderWeatherCard(pWx.body, d?.weather, { now });
    setPanelStatus(pWx, combine(s.status, src.metar?.status));
    renderRunwayInUse(pRwy.body, d?.runway, now);
    setPanelStatus(pRwy, adsb);
  };
  const drawPilot = (s) => {
    const now = nowSec();
    const d = s.data;
    const src = d?.health?.sources ?? {};
    const metarSt = combine(s.status, src.metar?.status);
    renderMetarPanel(pMetar.body, d);
    setPanelStatus(pMetar, metarSt);
    renderTafTimeline(pTaf.body, d?.taf, { now });
    setPanelStatus(pTaf, combine(s.status, src.taf?.status));
    renderWindRunways(pWind.body, d, d?.meta);
    setPanelStatus(pWind, metarSt);
    renderDaPanel(pDa.body, d, d?.meta);
    setPanelStatus(pDa, metarSt);
    renderPirepList(pPirep.body, d?.pirep, { limit: 12, now, windsAloft: d?.windsAloft });
    setPanelStatus(pPirep, combine(s.status, src.pirep?.status));
    renderSigmetList(pSig.body, d?.sigmet);
    setPanelStatus(pSig, combine(s.status, src.sigmet?.status));

  };
  const unsubs = [
    subscribe('dashboard', drawDash),
    subscribe('pilot', drawPilot),
    onUnitMode(() => lastDash && drawDash(lastDash)),
  ];
  loadAirlines().then(() => { lastDash && drawDash(lastDash); });
  const sunTimer = setInterval(() => renderSunTimes(sunSlot, true), 10 * 60_000);

  return () => { unsubs.forEach((u) => u()); stopPilot(); clearInterval(sunTimer); board.destroy?.(); };
}

function renderSigmetList(el, fc) {
  const f = fc?.features ?? [];
  if (!f.length) { el.innerHTML = '<p class="muted">No international SIGMETs within the area (approx. 40–56°N, 38–66°W).</p>'; return; }
  el.innerHTML = `<ul class="sigmets">${f.map(({ properties: p }) => `<li>
    <b>${esc(p.hazard)}${p.qualifier ? ' ' + esc(p.qualifier) : ''}</b> · ${esc(p.fir)} ·
    ${esc(fmt.flAlt(p.baseFt ?? 0))}–${esc(fmt.flAlt(p.topFt))} · valid ${esc(ddhhmmZ(p.validFrom))}–${esc(ddhhmmZ(p.validTo))}
    <details><summary>Raw</summary><pre class="raw small">${esc(p.raw)}</pre></details></li>`).join('')}</ul>`;
}
