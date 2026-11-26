// Pure: OpenSky /states/all → Aircraft[] (same shape as normalizeAdsbV2).
// State vector: [icao24, callsign, origin_country, time_position, last_contact, lon, lat,
//   baro_altitude (m), on_ground, velocity (m/s), true_track, vertical_rate (m/s), sensors,
//   geo_altitude (m), squawk, spi, position_source, category?]
// OpenSky has no registration/type; those stay null (routes still come from the callsign).
import { AIRPORT } from '../config';
import { bearingDeg, distanceNm, round } from '../lib/geo';
import { classifySquawk } from '../derive/squawk';
import { airlineFromCallsign } from './adsbV2';
import type { Aircraft } from '../types';

const M_TO_FT = 3.28084, MS_TO_KT = 1.943844, MS_TO_FPM = 196.8504;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizeOpenSky(raw: unknown, now: number, ap = AIRPORT): Aircraft[] {
  const states = (raw as { states?: unknown[][] | null })?.states;
  if (!Array.isArray(states)) return [];
  const out: Aircraft[] = [];
  for (const s of states) {
    if (!Array.isArray(s)) continue;
    const hex = str(s[0])?.toLowerCase();
    const lon = num(s[5]), lat = num(s[6]);
    if (!hex || lat == null || lon == null) continue;
    const distNm = distanceNm(ap.lat, ap.lon, lat, lon);
    if (distNm > ap.ingestRadiusNm) continue;           // bbox corners extend past the radius
    const onGround = s[8] === true;
    const baroM = num(s[7]), geoM = num(s[13]);
    const altBaroFt = onGround || baroM == null ? null : Math.round(baroM * M_TO_FT);
    const altGeomFt = geoM == null ? null : Math.round(geoM * M_TO_FT);
    const vs = num(s[11]), gs = num(s[9]);
    const callsign = str(s[1]);
    const squawk = str(s[14]);
    out.push({
      hex, callsign, reg: null, type: null, desc: null,
      airline: airlineFromCallsign(callsign),
      lat: round(lat, 5), lon: round(lon, 5),
      onGround,
      altBaroFt, altGeomFt,
      altFt: onGround ? ap.elevFt : (altGeomFt ?? altBaroFt),
      gsKt: gs == null ? null : round(gs * MS_TO_KT, 1),
      trackDeg: num(s[10]),
      vsFpm: vs == null ? null : Math.round(vs * MS_TO_FPM),
      squawk, alert: classifySquawk(squawk), category: null,
      distNm: round(distNm, 1),
      bearingDeg: Math.round(bearingDeg(ap.lat, ap.lon, lat, lon)),
      seenPosSec: null,
      ts: num(s[3]) ?? num(s[4]) ?? now,
    });
  }
  return out.sort((a, b) => a.distNm - b.distNm);
}
