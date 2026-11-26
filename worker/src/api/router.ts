// Tiny hand-written router. GET only.
import { CACHE_SEC } from '../config';
import { cached, json } from './cache';
import { allowedOrigin, preflight, withCors } from './cors';
import { aircraftList, aircraftOne } from './handlers/aircraft';
import { dashboard, healthRoute } from './handlers/dashboard';
import { movements } from './handlers/movements';
import { stats } from './handlers/stats';
import { pilot, weather } from './handlers/weather';
import type { Env } from '../types';

export async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const origin = allowedOrigin(req.headers.get('Origin'), env.EXTRA_ORIGINS);
  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'GET' && req.method !== 'HEAD') return withCors(json({ error: 'method not allowed' }, 0, 405), origin);

  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  let res: Response;
  try {
    if (p === '/v1/dashboard') res = await cached(req, ctx, CACHE_SEC.dashboard, () => dashboard(env));
    else if (p === '/v1/aircraft') res = await cached(req, ctx, CACHE_SEC.aircraft, () => aircraftList(env));
    else if (p.startsWith('/v1/aircraft/')) {
      const hex = p.slice('/v1/aircraft/'.length);
      res = /^[0-9a-f]{6}$/i.test(hex) ? await cached(req, ctx, CACHE_SEC.aircraft, () => aircraftOne(env, hex)) : json({ error: 'bad hex' }, 60, 400);
    }
    else if (p === '/v1/movements') res = await cached(req, ctx, CACHE_SEC.movements, () => movements(env, url));
    else if (p === '/v1/weather') res = await cached(req, ctx, CACHE_SEC.weather, () => weather(env));
    else if (p === '/v1/pilot') res = await cached(req, ctx, CACHE_SEC.pilot, () => pilot(env));
    else if (p === '/v1/stats') res = await cached(req, ctx, CACHE_SEC.stats, () => stats(env, url));
    else if (p === '/v1/health') res = await cached(req, ctx, CACHE_SEC.health, () => healthRoute(env));
    else if (p === '/') res = json({ name: 'airport-intel', routes: ['/v1/dashboard', '/v1/aircraft', '/v1/aircraft/:hex', '/v1/movements?hours=24', '/v1/weather', '/v1/pilot', '/v1/stats?days=7', '/v1/health'] }, 300);
    else res = json({ error: 'not found' }, 60, 404);
  } catch (e) {
    // Last-resort guard: handlers already degrade, but never surface a 5xx for upstream/DB trouble.
    console.error(JSON.stringify({ route: p, error: String((e as Error)?.message ?? e) }));
    res = json({ error: 'degraded', health: { db: 'error' } }, 5, 200);
  }
  return withCors(res, origin);
}
