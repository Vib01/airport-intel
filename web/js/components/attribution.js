import { esc } from '../lib/dom.js';
import { BOARD_PROVIDER } from '../config.js';
import { PROVIDERS } from './board-embed.js';

const SOURCES = [
  ['Aircraft', [['adsb.lol', 'https://adsb.lol', 'ODbL'], ['adsb.fi', 'https://adsb.fi', null]]],
  ['Weather', [['aviationweather.gov', 'https://aviationweather.gov', null], ['Open-Meteo', 'https://open-meteo.com', 'CC BY 4.0']]],
  ['Radar', [['ECCC MSC GeoMet', 'https://eccc-msc.github.io/open-data/', 'OGL-Canada']]],
  ['Map', [['© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright', null]]],
  ['Airline names', [['OpenFlights', 'https://openflights.org/data', 'ODbL']]],
  ['Scheduled flights', [[PROVIDERS[BOARD_PROVIDER]?.name ?? '—', PROVIDERS[BOARD_PROVIDER]?.url ?? '#', null]]],
  ['Routes', [['adsb.lol route data (unverified)', 'https://adsb.lol', null]]],
];

/** @param {string|null} adsbSourceUsed which ADS-B source served the latest data */
export function attribution(adsbSourceUsed = null, compact = false) {
  const el = document.createElement('p');
  el.className = `attribution${compact ? ' compact' : ''}`;
  el.innerHTML = 'Data: ' + SOURCES.map(([what, list]) =>
    `${esc(what)} ${list.map(([n, u, lic]) =>
      `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>${lic ? ` (${esc(lic)})` : ''}${adsbSourceUsed === n ? ' <span class="muted">· in use</span>' : ''}`).join(', ')}`).join(' · ') +
    ' · Sun times: SunCalc · ' +
    '<a href="https://github.com/Vib01/airport-intel" class="repo-link" target="_blank" rel="noopener">Open source (MIT)</a>';
  return el;
}
