// Pure: ADSBExchange-v2-style JSON (adsb.lol / adsb.fi / airplanes.live) → Aircraft[].
import { AIRPORT, DB_FLAG_BITS, PRIVACY } from '../config';
import { bearingDeg, distanceNm, round } from '../lib/geo';
import { classifySquawk } from '../derive/squawk';
import type { Aircraft } from '../types';

type RawAc = Record<string, unknown>;
type RawResponse = { ac?: RawAc[]; aircraft?: RawAc[]; now?: number };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

/** ICAO airline designator from an airline-style callsign (e.g. "ACA694" → "ACA"). */
export function airlineFromCallsign(cs: string | null): string | null {
  if (!cs) return null;
  const m = cs.match(/^([A-Z]{3})\d[0-9A-Z]*$/);
  return m ? m[1] : null;
}

/** Response timestamp in unix seconds (adsb.lol sends ms, adsb.fi sends ms or s). */
export function responseTime(raw: RawResponse, fallbackNow: number): number {
  const n = num(raw?.now);
  if (n == null) return fallbackNow;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

export function isHiddenByPrivacy(dbFlags: unknown): boolean {
  const f = num(dbFlags);
  if (f == null) return false;
  return PRIVACY.hideDbFlags.some((k) => (f & DB_FLAG_BITS[k]) !== 0);
}

export function normalizeAdsbV2(raw: RawResponse, now: number, elevFt = AIRPORT.elevFt): Aircraft[] {
  const list = Array.isArray(raw?.ac) ? raw.ac : Array.isArray(raw?.aircraft) ? raw.aircraft : [];
  const respTs = responseTime(raw, now);
  const out: Aircraft[] = [];
  for (const a of list) {
    const hex = str(a.hex)?.toLowerCase();
    const lat = num(a.lat), lon = num(a.lon);
    if (!hex || lat == null || lon == null) continue;
    if (hex.startsWith('~')) continue;            // non-ICAO (TIS-B) addresses: no stable identity
    if (isHiddenByPrivacy(a.dbFlags)) continue;

    const onGround = a.alt_baro === 'ground';
    const altBaroFt = onGround ? null : num(a.alt_baro);
    const altGeomFt = num(a.alt_geom);
    const altFt = onGround ? elevFt : (altGeomFt ?? altBaroFt);
    const callsign = str(a.flight);
    const squawk = str(a.squawk);
    const seenPos = num(a.seen_pos);
    out.push({
      hex,
      callsign,
      reg: str(a.r),
      type: str(a.t),
      desc: str(a.desc),
      airline: airlineFromCallsign(callsign),
      lat: round(lat, 5),
      lon: round(lon, 5),
      onGround,
      altBaroFt,
      altGeomFt,
      altFt,
      gsKt: num(a.gs),
      trackDeg: num(a.track) ?? num(a.true_heading),
      vsFpm: num(a.baro_rate) ?? num(a.geom_rate),
      squawk,
      alert: classifySquawk(squawk),
      category: str(a.category),
      distNm: round(distanceNm(AIRPORT.lat, AIRPORT.lon, lat, lon), 1),
      bearingDeg: Math.round(bearingDeg(AIRPORT.lat, AIRPORT.lon, lat, lon)),
      seenPosSec: seenPos,
      ts: respTs - Math.round(seenPos ?? 0),
    });
  }
  out.sort((x, y) => x.distNm - y.distNm);
  return out;
}
