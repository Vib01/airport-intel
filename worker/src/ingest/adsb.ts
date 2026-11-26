// ADS-B ingest with fallback adsb.lol → adsb.fi → airplanes.live (if enabled). Detection + persistence.
import { ADSB_SOURCES, AIRPORT, RUNWAYS } from '../config';
import { emptyTrackState, detectMovements } from '../derive/movements';
import { mergeFinals, observeFinals, runwayInUse } from '../derive/runwayInUse';
import { fetchJson } from '../lib/http';
import { normalizeAdsbV2 } from '../normalize/adsbV2';
import { getState, movementStmt, runBatch, stateStmt } from '../store/d1';
import type { Env, LiveState, TrackState } from '../types';

export async function fetchAdsb(env: Env): Promise<{ source: string; raw: unknown }> {
  const errors: string[] = [];
  for (const s of ADSB_SOURCES) {
    if (!s.enabled) continue;
    try {
      const raw = await fetchJson(s.url(AIRPORT.lat, AIRPORT.lon, AIRPORT.ingestRadiusNm), env.CONTACT_EMAIL);
      return { source: s.id, raw };
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message}`);
    }
  }
  throw new Error(`all ADS-B sources failed — ${errors.join(' | ')}`);
}

/** Returns the source used (recorded as health.sourceUsed). */
export async function ingestAdsb(env: Env, now: number): Promise<string> {
  const { source, raw } = await fetchAdsb(env);
  const aircraft = normalizeAdsbV2(raw as never, now);

  const prev = await getState(env.DB, ['tracks']);
  if (!prev.ok) throw new Error(`D1 read: ${prev.error}`);
  const prevTracks = (prev.value.tracks?.value as TrackState | undefined)?.v === 1 ? (prev.value.tracks!.value as TrackState) : emptyTrackState(now);

  const finals = mergeFinals(prevTracks.finals ?? [], observeFinals(aircraft, now, RUNWAYS), now);
  const runway = runwayInUse(finals, now, RUNWAYS);
  const { state, events } = detectMovements({ ...prevTracks, finals }, aircraft, now, RUNWAYS, runway.runway);

  for (const a of aircraft) a.trail = state.tracks[a.hex]?.trail ?? [];
  const live: LiveState = { generatedAt: now, source, aircraft, runway };

  const res = await runBatch(env.DB, [
    stateStmt(env.DB, 'live', live, now),
    stateStmt(env.DB, 'tracks', state, now),
    ...events.map((e) => movementStmt(env.DB, e)),
  ]);
  if (!res.ok) throw new Error(`D1 write: ${res.error}`);
  if (events.length) console.log(JSON.stringify({ msg: 'movements', events }));
  return source;
}
