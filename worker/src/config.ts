// All thresholds and tunables live here. No magic numbers elsewhere.

export const AIRPORT = {
  icao: 'CYYT', iata: 'YYT', name: "St. John's International",
  // Confirm lat/lon/elevFt against the Canada Flight Supplement when filling RUNWAYS (Block 6).
  lat: 47.6186, lon: -52.7519, elevFt: 461, tz: 'America/St_Johns',
  ingestRadiusNm: 60, terminalNm: 8, finalNm: 5,
};

export type RunwayConfig = { id: string; trueHdg: number | null; lengthFt: number | null };

// TRUE headings. DO NOT GUESS. While any value is null, wind components and runway-in-use report
// "RUNWAY_CONFIG_MISSING" and test/config.test.ts lists the gap.
// Values below: OurAirports runways.csv (public domain), retrieved 2026-11-25, approved by the owner
// on 2026-11-25 pending verification against the Canada Flight Supplement (CFS). Runway 02/20 is
// closed and omitted. If the CFS differs, the CFS wins — update here and RUNWAY_SOURCE.
export const RUNWAY_SOURCE = 'OurAirports (2026-11-25) — verify against the Canada Flight Supplement';
export const RUNWAYS: RunwayConfig[] = [
  { id: '10', trueHdg: 86, lengthFt: 8502 }, { id: '28', trueHdg: 266, lengthFt: 8502 },
  { id: '16', trueHdg: 142, lengthFt: 7005 }, { id: '34', trueHdg: 322, lengthFt: 7005 },
];

export const DETECT = {
  lowAglFt: 2000, vsArrFpm: -300, vsDepFpm: 300,
  // lostAfterSec: two missed polls at the 3-minute ADS-B cadence (ADSB_POLL_MIN) before a track is "lost".
  lostAfterSec: 360, dedupeSec: 1800, trailMinutes: 15, trailMaxPts: 16,
  runwayAlignDeg: 20,                 // track within ±20° of runway heading
  finalAglFt: 1500,                   // runwayInUse: below this AGL inside finalNm
  runwayWindowSec: 20 * 60,           // runwayInUse look-back
  trackForgetSec: 30 * 60,            // drop ground tracks not seen for this long
};

export const PRIVACY = { hideDbFlags: ['PIA', 'LADD'] as const }; // hide privacy-program aircraft
// readsb dbFlags bit values
export const DB_FLAG_BITS = { MILITARY: 1, INTERESTING: 2, PIA: 4, LADD: 8 } as const;

export const FEATURES = { schedule: false, radar: true, sigmet: true };

export const WX = {
  metarHistoryHours: 3,
  pressureTrendHpa: 1,                // |Δ| ≥ this over 3 h → RISING / FALLING
  ftPerHpa: 27,                       // pressure-altitude approximation per spec
  isaSeaLevelC: 15, isaLapseCPer1000ft: 2, daFtPerC: 120,
  stdPressureHpa: 1013.25,
  inHgToHpa: 33.8639,
  pirepRadiusNm: 150, pirepMaxAgeHours: 3,
  // SIGMET bbox filter: anything with a vertex inside this box is kept.
  sigmetBox: { minLat: 40, maxLat: 56, minLon: -66, maxLon: -38 },
  forecastHours: 36,
  metarOldMin: 70,                    // UI: observation age warning
};

export const CATEGORY = {             // FAA convention
  lifrCeilFt: 500, lifrVisSm: 1,
  ifrCeilFt: 1000, ifrVisSm: 3,
  mvfrCeilFt: 3000, mvfrVisSm: 5,
};

// adsb.lol allows 500 requests/day per IP: every 3 minutes = 480/day. Lower only with a keyed source.
export const ADSB_POLL_MIN = 3;
// After a 429, wait this long before trying that source again (Cloudflare egress IPs vary, so another
// address may still have quota). Never later than the daily reset at 00:00 UTC.
export const ADSB_429_RETRY_SEC = 30 * 60;

export const SQUAWK = { emergency: '7700', radioFail: '7600', special: '7500' };

export const HTTP = { timeoutMs: 8000, userAgentBase: 'airport-intel/1.0 (+https://thevibs.com/airport-intel' };

/**
 * ADSBExchange-v2-format sources, tried in order. A source with `keySecret` is used only when that
 * Worker secret is set; the key is sent in the `keyHeader` request header.
 */
export type AdsbSource = {
  id: string; enabled: boolean; url: (lat: number, lon: number, nm: number) => string;
  keySecret?: 'AIRPLANES_LIVE_KEY'; keyHeader?: string;
};
export const ADSB_SOURCES: AdsbSource[] = [
  // Primary once the owner's API key is stored: npx wrangler secret put AIRPLANES_LIVE_KEY --name airport-intel
  // keyHeader must match airplanes.live's API docs (confirm when the key is issued).
  { id: 'airplanes.live', enabled: true, keySecret: 'AIRPLANES_LIVE_KEY', keyHeader: 'api-auth',
    url: (lat, lon, nm) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${nm}` },
  // 500 requests/day per IP (shared Cloudflare egress IPs): fallback only.
  { id: 'adsb.lol', enabled: true, url: (lat, lon, nm) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${nm}` },
  // Blocks Cloudflare (403 bot challenge, tested 2026-11-26); harmless last resort.
  { id: 'adsb.fi', enabled: true, url: (lat, lon, nm) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}` },
];

// Callsign → route lookups (community-sourced "standing data", static files; no key). Label as unverified.
export const ROUTES = {
  baseUrl: 'https://vrs-standing-data.adsb.lol/routes',
  maxLookupsPerTick: 8,          // bounded subrequests per cron run
  ttlSec: 24 * 3600,             // re-check a known route daily
  missTtlSec: 6 * 3600,          // don't re-ask for unknown callsigns for 6 h
  maxCached: 600,
};

export const BOARD = {
  recentMovementSec: 3 * 3600,   // landed/departed rows stay on the board this long
  minGsForEtaKt: 60,
  maxRows: 20,
  approachNm: 30,                // inbound within this distance → APPROACHING
  finalAglFt: 3000,              // inbound within finalNm and below this AGL → ON_FINAL
  localNm: 15,                   // "local traffic": within this distance…
  localMaxAglFt: 10000,          // …and below this AGL (helicopters, GA, unknown routes)
  levelFpm: 300,                 // |vertical speed| below this → LEVEL
};

// OpenSky Network (free account, OAuth2 client credentials). Primary aircraft source when the
// OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET secrets exist. A bbox under 25 sq° costs 1 credit;
// registered users get 4,000/day, so one request a minute (1,440/day) fits.
export const OPENSKY = {
  // OFF: OpenSky drops connections from Cloudflare (HTTP 522 from Workers, tested 2026-11-26), though the
  // same credentials work from a home connection. Re-enable only if requests come from a non-cloud IP.
  enabled: false,
  tokenUrl: 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
  statesUrl: 'https://opensky-network.org/api/states/all',
  boxDeg: { lat: 1.0, lon: 1.48 },   // ≈ ±60 nm around the airport (cos 47.6° ≈ 0.675)
  tokenRefreshMarginSec: 60,
};

export const AWC_BASE = 'https://aviationweather.gov/api/data';
export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// Source health: STALE after `staleSec` without success, OFFLINE after `offlineSec`.
export const HEALTH: Record<string, { staleSec: number; offlineSec: number }> = {
  adsb: { staleSec: 420, offlineSec: 1800 },      // polled every ADSB_POLL_MIN minutes
  routes: { staleSec: 900, offlineSec: 6 * 3600 },
  metar: { staleSec: 900, offlineSec: 3 * 3600 },
  taf: { staleSec: 1800, offlineSec: 6 * 3600 },
  pirep: { staleSec: 1800, offlineSec: 6 * 3600 },
  sigmet: { staleSec: 1800, offlineSec: 6 * 3600 },
  forecast: { staleSec: 2 * 3600, offlineSec: 12 * 3600 },
  stats: { staleSec: 2 * 3600, offlineSec: 6 * 3600 },
  prune: { staleSec: 26 * 3600, offlineSec: 72 * 3600 },
};

// Catch-up runs for jobs that never succeeded or went STALE (bounded so one tick stays light).
export const CATCHUP = { maxPerTick: 3, retryAfterSec: 300 };

export const CACHE_SEC = { dashboard: 15, aircraft: 15, movements: 30, weather: 60, pilot: 60, stats: 300, health: 15 };

export const RETENTION = { movementsDays: 90, statsDays: 730, flightsDays: 14 };

export const API_LIMITS = { movementsMaxHours: 72, statsMaxDays: 30, dashboardMovementHours: 12 };

export const CORS_ORIGINS = ['https://thevibs.com', 'https://www.thevibs.com'];
