// Aircraft ingest: OpenSky (if configured) → adsb.lol → adsb.fi → airplanes.live (if enabled).
// Then movement detection + persistence.
import { ADSB_SOURCES, AIRPORT, OPENSKY, RUNWAYS } from '../config';
import { emptyTrackState, detectMovements } from '../derive/movements';
import { mergeFinals, observeFinals, runwayInUse } from '../derive/runwayInUse';
import { fetchJson, HttpError } from '../lib/http';
import { normalizeAdsbV2 } from '../normalize/adsbV2';
import { normalizeOpenSky } from '../normalize/opensky';
import { getState, movementStmt, runBatch, stateStmt } from '../store/d1';
import type { Aircraft, Env, LiveState, TrackState } from '../types';

// OAuth token cached per isolate (valid ~30 min); refreshed shortly before expiry.
let osToken: { token: string; exp: number } | null = null;

async function openSkyToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (osToken && osToken.exp - OPENSKY.tokenRefreshMarginSec > now) return osToken.token;
  const body = new URLSearchParams({
    grant_type: 'client_credentials', client_id: env.OPENSKY_CLIENT_ID!, client_secret: env.OPENSKY_CLIENT_SECRET!,
  }).toString();
  const r = await fetchJson<{ access_token?: string; expires_in?: number }>(OPENSKY.tokenUrl, env.CONTACT_EMAIL, {
    method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!r.access_token) throw new Error('OpenSky token: no access_token in response');
  osToken = { token: r.access_token, exp: now + (r.expires_in ?? 1800) };
  return osToken.token;
}

async function fetchOpenSky(env: Env, now: number): Promise<Aircraft[]> {
  const token = await openSkyToken(env);
  const b = OPENSKY.boxDeg;
  const q = `lamin=${AIRPORT.lat - b.lat}&lomin=${AIRPORT.lon - b.lon}&lamax=${AIRPORT.lat + b.lat}&lomax=${AIRPORT.lon + b.lon}`;
  try {
    return normalizeOpenSky(await fetchJson(`${OPENSKY.statesUrl}?${q}`, env.CONTACT_EMAIL, { headers: { Authorization: `Bearer ${token}` } }), now);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) osToken = null;   // expired/revoked: refresh next time
    throw e;
  }
}

/** OpenSky first (when configured), then the ADSBExchange-v2 sources. Returns normalized aircraft. */
export async function fetchAircraft(env: Env, now: number, paused: Record<string, number> = {}): Promise<{ source: string; aircraft: Aircraft[] }> {
  const errors: string[] = [];
  if (OPENSKY.enabled && env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET) {
    try {
      return { source: 'opensky', aircraft: await fetchOpenSky(env, now) };
    } catch (e) {
      errors.push(`opensky: ${(e as Error).message}`);
    }
  }
  try {
    const { source, raw } = await fetchAdsb(env, now, paused);
    return { source, aircraft: normalizeAdsbV2(raw as never, now) };
  } catch (e) {
    throw new Error([...errors, (e as Error).message].join(' | '));
  }
}

export async function fetchAdsb(env: Env, now = Math.floor(Date.now() / 1000), paused: Record<string, number> = {}): Promise<{ source: string; raw: unknown }> {
  const errors: string[] = [];
  for (const s of ADSB_SOURCES) {
    if (!s.enabled) continue;
    if ((paused[s.id] ?? 0) > now) { errors.push(`${s.id}: paused (daily limit) until ${new Date(paused[s.id] * 1000).toISOString().slice(11, 16)}Z`); continue; }
    const key = s.keySecret ? env[s.keySecret]?.trim() : undefined;
    if (s.keySecret && !key) continue;                       // keyed source without its key: skip
    try {
      const headers = key && s.keyHeader ? { [s.keyHeader]: key } : undefined;
      const raw = await fetchJson(s.url(AIRPORT.lat, AIRPORT.lon, AIRPORT.ingestRadiusNm), env.CONTACT_EMAIL, { headers });
      return { source: s.id, raw };
    } catch (e) {
      // 429 = daily quota used up: stop asking until it resets (next 00:00 UTC) instead of hammering it.
      if (e instanceof HttpError && e.status === 429) paused[s.id] = nextUtcMidnight(now);
      errors.push(`${s.id}: ${(e as Error).message}`);
    }
  }
  throw new Error(`all ADS-B sources failed — ${errors.join(' | ')}`);
}

export const nextUtcMidnight = (now: number) => (Math.floor(now / 86400) + 1) * 86400;

/** Returns the source used (recorded as health.sourceUsed). */
export async function ingestAdsb(env: Env, now: number): Promise<string> {
  const prev = await getState(env.DB, ['tracks']);
  if (!prev.ok) throw new Error(`D1 read: ${prev.error}`);
  const prevTracks = (prev.value.tracks?.value as TrackState | undefined)?.v === 1 ? (prev.value.tracks!.value as TrackState) : emptyTrackState(now);
  const paused: Record<string, number> = { ...(prevTracks.paused ?? {}) };

  let source: string, aircraft: Aircraft[];
  try {
    ({ source, aircraft } = await fetchAircraft(env, now, paused));
  } catch (e) {
    // Remember any new pause so the next tick doesn't retry a source that is out of quota.
    if (JSON.stringify(paused) !== JSON.stringify(prevTracks.paused ?? {})) {
      await runBatch(env.DB, [stateStmt(env.DB, 'tracks', { ...prevTracks, paused }, now)]);
    }
    throw e;
  }

  const finals = mergeFinals(prevTracks.finals ?? [], observeFinals(aircraft, now, RUNWAYS), now);
  const runway = runwayInUse(finals, now, RUNWAYS);
  const { state, events } = detectMovements({ ...prevTracks, finals }, aircraft, now, RUNWAYS, runway.runway);

  for (const a of aircraft) a.trail = state.tracks[a.hex]?.trail ?? [];
  const live: LiveState = { generatedAt: now, source, aircraft, runway };

  const res = await runBatch(env.DB, [
    stateStmt(env.DB, 'live', live, now),
    stateStmt(env.DB, 'tracks', { ...state, paused: Object.fromEntries(Object.entries(paused).filter(([, t]) => t > now)) }, now),
    ...events.map((e) => movementStmt(env.DB, e)),
  ]);
  if (!res.ok) throw new Error(`D1 write: ${res.error}`);
  if (events.length) console.log(JSON.stringify({ msg: 'movements', events }));
  return source;
}
