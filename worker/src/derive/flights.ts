// Pure. Live arrivals/departures board for the airport, built from tracked aircraft + cached
// community routes + detected movements. Routes are unverified; ETAs are naive estimates.
import { AIRPORT, BOARD } from '../config';
import type { Aircraft, AirportRef, FlightBoard, FlightRow, FlightStatus, Movement, RouteCache, RouteEntry } from '../types';

type Ap = typeof AIRPORT;
const isRoute = (e: RouteEntry | undefined): e is { codes: string[]; ts: number } => !!e && 'codes' in e;

/** For a route through `icao`: the previous stop (arrival leg) and next stop (departure leg). */
export function legsAt(codes: string[], icao: string): { from: string | null; to: string | null } | null {
  const i = codes.indexOf(icao);
  if (i < 0) return null;
  return { from: i > 0 ? codes[i - 1] : null, to: i < codes.length - 1 ? codes[i + 1] : null };
}

export function arrivalStatus(a: Aircraft, ap: Ap, cfg = BOARD): FlightStatus {
  if (a.onGround) return a.distNm <= ap.terminalNm ? 'LANDED' : 'EN_ROUTE';
  if (a.distNm <= ap.finalNm && a.altFt != null && a.altFt - ap.elevFt < cfg.finalAglFt) return 'ON_FINAL';
  if (a.distNm <= cfg.approachNm) return 'APPROACHING';
  return 'EN_ROUTE';
}

export function departureStatus(a: Pick<Aircraft, 'onGround' | 'gsKt'>): FlightStatus {
  if (a.onGround) return (a.gsKt ?? 0) >= 5 ? 'TAXIING' : 'AT_GATE';
  return 'DEPARTED';
}

export function buildBoard(
  aircraft: Aircraft[], movements: Pick<Movement, 'kind' | 'callsign' | 'hex' | 'ts' | 'airline' | 'type' | 'reg'>[],
  cache: RouteCache | null, now: number, ap: Ap = AIRPORT, cfg = BOARD,
): FlightBoard {
  const routes = cache?.routes ?? {};
  const airports = cache?.airports ?? {};
  const ref = (icao: string | null): AirportRef | null => (icao ? airports[icao] ?? { icao, iata: null, name: null, location: null } : null);
  const lastMove = new Map<string, { kind: string; ts: number }>();
  for (const m of movements) {
    if (!m.callsign) continue;
    const k = `${m.callsign}:${m.kind}`;
    const cur = lastMove.get(k);
    if (!cur || m.ts > cur.ts) lastMove.set(k, { kind: m.kind, ts: m.ts });
  }

  const arrivals: FlightRow[] = [], departures: FlightRow[] = [], local: FlightRow[] = [];
  const seen = new Set<string>();
  let overflights = 0;

  for (const a of aircraft) {
    const e = a.callsign ? routes[a.callsign] : undefined;
    const legs = isRoute(e) ? legsAt(e.codes, ap.icao) : null;
    const base = {
      callsign: a.callsign ?? a.reg ?? a.hex.toUpperCase(), hex: a.hex, airline: a.airline, type: a.type, reg: a.reg,
      distNm: a.distNm, altFt: a.onGround ? null : a.altFt, gsKt: a.gsKt, tracked: true,
    };
    const arrTs = a.callsign ? lastMove.get(`${a.callsign}:ARR`)?.ts ?? null : null;
    const depTs = a.callsign ? lastMove.get(`${a.callsign}:DEP`)?.ts ?? null : null;
    if (!legs || !a.callsign) {
      // No YYT route. If we detected it landing/taking off recently, it belongs on that list (still tracked);
      // otherwise it's local traffic when near and low, or an overflight.
      const recent = (t: number | null) => t != null && now - t <= cfg.recentMovementSec;
      const lastKind = recent(depTs) && (!recent(arrTs) || depTs! > arrTs!) ? 'DEP' : recent(arrTs) ? 'ARR' : null;
      if (a.callsign && lastKind === 'DEP' && !a.onGround) {
        departures.push({ ...base, other: null, status: 'DEPARTED', statusTs: depTs, etaTs: null });
        seen.add(`${a.callsign}:DEP`);
      } else if (a.callsign && lastKind === 'ARR') {
        arrivals.push({ ...base, other: null, status: a.onGround ? 'LANDED' : arrivalStatus(a, ap, cfg), statusTs: arrTs, etaTs: null });
        seen.add(`${a.callsign}:ARR`);
      } else if (isLocal(a, ap, cfg)) {
        local.push({ ...base, other: null, status: localStatus(a, cfg), statusTs: null, etaTs: null });
      } else {
        overflights++;
      }
      continue;
    }
    // Which leg is it flying now? YYT is the origin → departure; YYT is the destination → arrival;
    // YYT is an intermediate stop → departure only once a departure was detected after any arrival.
    const departing = legs.from == null ? true : legs.to == null ? false : depTs != null && (arrTs == null || depTs > arrTs);
    if (!departing) {
      const status = arrivalStatus(a, ap, cfg);
      const eta = !a.onGround && (a.gsKt ?? 0) >= cfg.minGsForEtaKt ? Math.round(now + (a.distNm / a.gsKt!) * 3600) : null;
      arrivals.push({ ...base, other: ref(legs.from), status, statusTs: status === 'LANDED' ? arrTs : null, etaTs: eta });
      seen.add(`${a.callsign}:ARR`);
    } else {
      departures.push({ ...base, other: ref(legs.to), status: departureStatus(a), statusTs: depTs, etaTs: null });
      seen.add(`${a.callsign}:DEP`);
    }
  }

  // Recently detected movements whose aircraft is no longer tracked (landed & switched off, or left coverage).
  for (const m of movements) {
    if (!m.callsign || now - m.ts > cfg.recentMovementSec) continue;
    const key = `${m.callsign}:${m.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const e = routes[m.callsign];
    const legs = isRoute(e) ? legsAt(e.codes, ap.icao) : null;
    const row: FlightRow = {
      callsign: m.callsign, hex: m.hex, airline: m.airline, type: m.type, reg: m.reg,
      other: ref(m.kind === 'ARR' ? legs?.from ?? null : legs?.to ?? null),
      status: m.kind === 'ARR' ? 'LANDED' : 'DEPARTED', statusTs: m.ts, etaTs: null,
      distNm: null, altFt: null, gsKt: null, tracked: false,
    };
    (m.kind === 'ARR' ? arrivals : departures).push(row);
  }

  const ORDER: Record<FlightStatus, number> = {
    ON_FINAL: 0, APPROACHING: 1, EN_ROUTE: 2, LANDED: 3, TAXIING: 0, AT_GATE: 1, DEPARTED: 2,
    ON_GROUND: 0, DESCENDING: 1, CLIMBING: 1, LEVEL: 2,
  };
  const sortArr = (a: FlightRow, b: FlightRow) => ORDER[a.status] - ORDER[b.status] || (a.etaTs ?? Infinity) - (b.etaTs ?? Infinity) || (b.statusTs ?? 0) - (a.statusTs ?? 0);
  const sortDep = (a: FlightRow, b: FlightRow) => ORDER[a.status] - ORDER[b.status] || (b.statusTs ?? 0) - (a.statusTs ?? 0) || (a.distNm ?? 0) - (b.distNm ?? 0);
  return {
    arrivals: arrivals.sort(sortArr).slice(0, cfg.maxRows),
    departures: departures.sort(sortDep).slice(0, cfg.maxRows),
    local: local.sort((a, b) => (a.distNm ?? 0) - (b.distNm ?? 0)).slice(0, cfg.maxRows),
    overflights,
    routeSource: 'adsb.lol community route data (unverified)',
  };
}

export function isLocal(a: Aircraft, ap: Ap, cfg = BOARD): boolean {
  if (a.distNm > cfg.localNm) return false;
  if (a.onGround) return true;
  return a.altFt != null && a.altFt - ap.elevFt < cfg.localMaxAglFt;
}

export function localStatus(a: Pick<Aircraft, 'onGround' | 'vsFpm'>, cfg = BOARD): FlightStatus {
  if (a.onGround) return 'ON_GROUND';
  const vs = a.vsFpm ?? 0;
  return vs >= cfg.levelFpm ? 'CLIMBING' : vs <= -cfg.levelFpm ? 'DESCENDING' : 'LEVEL';
}

/** Callsigns that need a (re)lookup, nearest aircraft first, bounded. */
export function callsignsToLookup(aircraft: Aircraft[], cache: RouteCache | null, now: number, max: number, ttlSec: number, missTtlSec: number): string[] {
  const out: string[] = [];
  for (const a of [...aircraft].sort((x, y) => x.distNm - y.distNm)) {
    if (!a.callsign || out.includes(a.callsign)) continue;
    const e = cache?.routes[a.callsign];
    const ttl = e && 'miss' in e ? missTtlSec : ttlSec;
    if (e && now - e.ts < ttl) continue;
    out.push(a.callsign);
    if (out.length >= max) break;
  }
  return out;
}

/** Merge lookup results into the cache and trim it to the most recent `max` entries. */
export function mergeRoutes(
  cache: RouteCache | null, results: { callsign: string; codes: string[] | null; airports: AirportRef[] }[], now: number, max: number,
): RouteCache {
  const routes = { ...(cache?.routes ?? {}) };
  const airports = { ...(cache?.airports ?? {}) };
  for (const r of results) {
    routes[r.callsign] = r.codes ? { codes: r.codes, ts: now } : { miss: true, ts: now };
    for (const a of r.airports) airports[a.icao] = a;
  }
  const keys = Object.keys(routes);
  if (keys.length > max) {
    keys.sort((a, b) => routes[a].ts - routes[b].ts).slice(0, keys.length - max).forEach((k) => delete routes[k]);
  }
  return { v: 1, routes, airports };
}
