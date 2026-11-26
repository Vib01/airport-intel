// Route lookups for tracked callsigns (bounded per tick, cached in state['routes']).
import { ROUTES } from '../config';
import { callsignsToLookup, mergeRoutes } from '../derive/flights';
import { fetchJson, HttpError } from '../lib/http';
import { normalizeRoute, routePath } from '../normalize/route';
import { getState, runBatch, stateStmt } from '../store/d1';
import type { AirportRef, Env, LiveState, RouteCache } from '../types';

export async function ingestRoutes(env: Env, now: number): Promise<string> {
  const st = await getState(env.DB, ['live', 'routes']);
  if (!st.ok) throw new Error(`D1 read: ${st.error}`);
  const live = st.value.live?.value as LiveState | undefined;
  const cache = (st.value.routes?.value as RouteCache | undefined) ?? null;
  const todo = callsignsToLookup(live?.aircraft ?? [], cache, now, ROUTES.maxLookupsPerTick, ROUTES.ttlSec, ROUTES.missTtlSec);
  if (!todo.length) return 'cache';

  const results: { callsign: string; codes: string[] | null; airports: AirportRef[] }[] = [];
  let errors = 0;
  for (const cs of todo) {
    const path = routePath(cs);
    if (!path) { results.push({ callsign: cs, codes: null, airports: [] }); continue; }
    try {
      const r = normalizeRoute(await fetchJson(`${ROUTES.baseUrl}/${path}.json`, env.CONTACT_EMAIL));
      results.push({ callsign: cs, codes: r?.codes ?? null, airports: r?.airports ?? [] });
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) results.push({ callsign: cs, codes: null, airports: [] });
      else errors++;   // transient: retry next tick
    }
  }
  if (results.length) {
    const w = await runBatch(env.DB, [stateStmt(env.DB, 'routes', mergeRoutes(cache, results, now, ROUTES.maxCached), now)]);
    if (!w.ok) throw new Error(`D1 write: ${w.error}`);
  }
  if (errors && !results.length) throw new Error(`route lookups failed (${errors})`);
  return `${results.length} looked up`;
}
