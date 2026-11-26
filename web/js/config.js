// Front-end configuration. No secrets here — this file is public.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_BASE = isLocal
  ? 'http://localhost:8787'
  // Deployed Cloudflare Worker (backend). Works from any host: GitHub Pages, Vercel, your portfolio.
  : 'https://airport-intel.airport-intel-worker.workers.dev';

export const POLL_MS = 15_000;            // dashboard / aircraft
export const POLL_SLOW_MS = 60_000;       // weather / pilot
export const POLL_STATS_MS = 300_000;     // stats
export const FETCH_TIMEOUT_MS = 10_000;
export const STALE_AFTER_MS = 90_000;     // client: no successful fetch for this long → STALE
export const OFFLINE_AFTER_MS = 300_000;  // → OFFLINE

// 'airportia' (default) | 'avionio' | 'planetrack' | 'none'. See components/board-embed.js.
// Avionio widget code (free, no restrictions) is installed unchanged in web/embeds/avionio-*.html.
// Airportia's builder is behind a bot check, so generate it in a browser if you switch back.
export const BOARD_PROVIDER = 'avionio';
// Set to true only when web/embeds/<provider>-arrivals.html and -departures.html contain the provider's code.
export const BOARD_CONFIGURED = true;

// Show only the flight rows of the widget (owner request, 2026-11-25). The widget code is unchanged;
// we render it at a fixed width (so it always uses its one-line table layout) and show a window over
// its rows, scaled to the panel. Offsets were measured on the Avionio "legacy black" layout at
// ≥ 800 px width: first flight row at 244 px, 33 px per row. If Avionio changes its layout, re-measure
// these or set enabled:false to show the whole widget.
export const BOARD_VIEW = {
  enabled: true,
  rows: 11,
  renderWidth: 900,      // px the widget is laid out at (≥ 800 → one line per flight)
  firstRowPx: 244,
  rowPx: 33,
  frameHeight: 700,      // our embed page: 650 px widget + credit line
  refreshMs: 5 * 60_000, // reload so the widget's time window follows the clock
};

export const FEATURES = { radar: true, sigmet: true, schedule: false };

// ECCC MSC GeoMet WMS. Layer names verified with GetCapabilities on 2026-11-25.
export const RADAR = {
  url: 'https://geo.weather.gc.ca/geomet',
  layers: { rain: 'RADAR_1KM_RRAI', snow: 'RADAR_1KM_RSNO' },
  refreshMs: 6 * 60_000,
};

export const MAP = {
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  rings: [5, 10, 25, 50],
  centerlineNm: 10,
  zoom: 9, miniZoom: 8,
  fitNm: 60, miniFitNm: 45,   // initial view radius around CYYT (ingest radius is 60 nm)
};

export const LINKS = {
  flightaware: 'https://www.flightaware.com/live/airport/CYYT',
  flightradar: 'https://www.flightradar24.com/data/airports/yyt',
  airportia: 'https://www.airportia.com/canada/st.-john_s-international-airport/',
  // NAV CANADA Collaborative Flight Planning Services: NOTAMs, GFA, official METAR/TAF.
  navcanCfps: 'https://plan.navcanada.ca/wxrecall/',
};

export const TZ = 'America/St_Johns';
