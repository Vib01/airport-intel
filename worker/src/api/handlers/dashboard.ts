import { AIRPORT, API_LIMITS } from '../../config';
import { todaySummary } from '../../derive/stats';
import { buildBoard, legsAt } from '../../derive/flights';
import { localDayStart } from '../../lib/time';
import { loadMovements, loadState, worstDb } from '../data';
import { health, live, meta, nowSec, weather } from './common';
import type { Env, Movement, RouteCache } from '../../types';

/** Attach the other airport (origin for ARR, destination for DEP) from the route cache. */
export function withRoutes(list: Movement[], cache: RouteCache | null) {
  return list.map((m) => {
    const e = m.callsign ? cache?.routes[m.callsign] : undefined;
    const legs = e && 'codes' in e ? legsAt(e.codes, AIRPORT.icao) : null;
    const icao = m.kind === 'ARR' ? legs?.from : legs?.to;
    const ap = icao ? cache?.airports[icao] : undefined;
    return { ...m, other: icao ? { icao, iata: ap?.iata ?? null, name: ap?.name ?? null, location: ap?.location ?? null } : null };
  });
}

export async function dashboard(env: Env) {
  const now = nowSec();
  const today0 = localDayStart(now, AIRPORT.tz);
  const since = Math.min(today0, now - API_LIMITS.dashboardMovementHours * 3600);
  const [st, mv] = await Promise.all([
    loadState(env.DB, ['live', 'metar_hist', 'taf', 'forecast', 'health', 'routes']),
    loadMovements(env.DB, since),
  ]);
  const db = worstDb(st.db, mv.db);
  const l = live(st.value);
  const w = weather(st.value, now, db);
  const routes = (st.value.routes?.value as RouteCache | undefined) ?? null;
  const cutoff = now - API_LIMITS.dashboardMovementHours * 3600;
  return {
    now,
    meta: meta(),
    aircraft: l.aircraft,
    aircraftGeneratedAt: l.generatedAt,
    movements: withRoutes(mv.value.filter((m) => m.ts >= cutoff), routes),
    flights: buildBoard(l.aircraft, mv.value, routes, now),
    weather: { metar: w.metar, derived: w.derived, taf: w.taf, forecast: w.forecast },
    runway: l.runway,
    stats: { today: todaySummary(mv.value, today0, now) },
    health: health(st.value, now, db),
  };
}

export async function healthRoute(env: Env) {
  const { value: rows, db } = await loadState(env.DB, ['health']);
  return health(rows, nowSec(), db);
}
