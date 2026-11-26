// Pure. Movement detector, evaluated once per ingest (≈ every minute). ARCHITECTURE §4.4.
//  ARR/HIGH: airborne inside terminalNm, then on ground.
//  ARR/LOW : last seen inside terminalNm, AGL < lowAglFt, descending, then lost for lostAfterSec.
//  DEP/HIGH: on ground → airborne inside terminalNm.
//  DEP/LOW : first seen inside terminalNm, AGL < lowAglFt, climbing.
//  Dedupe (hex, kind) within dedupeSec.
import { AIRPORT, DETECT, type RunwayConfig } from '../config';
import { localHourStart } from '../lib/time';
import { appendTrail } from './trails';
import { matchRunway } from './runwayInUse';
import type { Aircraft, MovementEvent, MovementKind, Confidence, Track, TrackSample, TrackState } from '../types';

export function emptyTrackState(now: number): TrackState {
  return { v: 1, updatedAt: now, tracks: {}, recent: {}, finals: [], hourMax: [{ hourTs: localHourStart(now, AIRPORT.tz), max: 0 }] };
}

export function toSample(a: Aircraft, elevFt: number): TrackSample {
  return {
    ts: a.ts, lat: a.lat, lon: a.lon, onGround: a.onGround,
    aglFt: a.onGround ? 0 : a.altFt != null ? Math.round(a.altFt - elevFt) : null,
    vsFpm: a.vsFpm, trackDeg: a.trackDeg, distNm: a.distNm,
  };
}

type Ctx = { now: number; runways: RunwayConfig[]; runwayHint: string | null; ap: typeof AIRPORT; cfg: typeof DETECT };

export function detectMovements(
  prev: TrackState,
  aircraft: Aircraft[],
  now: number,
  runways: RunwayConfig[],
  runwayHint: string | null = null,
  ap = AIRPORT,
  cfg = DETECT,
): { state: TrackState; events: MovementEvent[] } {
  const ctx: Ctx = { now, runways, runwayHint, ap, cfg };
  const tracks: Record<string, Track> = {};
  const recent: Record<string, number> = {};
  for (const [k, ts] of Object.entries(prev.recent ?? {})) if (now - ts < cfg.dedupeSec) recent[k] = ts;
  const events: MovementEvent[] = [];

  const emit = (t: Pick<Track, 'hex' | 'callsign' | 'reg' | 'type' | 'airline'>, kind: MovementKind, confidence: Confidence, ts: number, trackDeg: number | null) => {
    const key = `${t.hex}:${kind}`;
    if (recent[key] != null && ts - recent[key] < cfg.dedupeSec) return;
    recent[key] = ts;
    events.push({
      kind, hex: t.hex, callsign: t.callsign, reg: t.reg, type: t.type, airline: t.airline,
      runway: matchRunway(trackDeg, ctx.runways, cfg) ?? ctx.runwayHint, ts, confidence,
    });
  };

  const seen = new Set<string>();
  for (const a of aircraft) {
    seen.add(a.hex);
    const s = toSample(a, ap.elevFt);
    const inTerm = s.distNm <= ap.terminalNm;
    const p = prev.tracks?.[a.hex];
    const ident = {
      hex: a.hex,
      callsign: a.callsign ?? p?.callsign ?? null, reg: a.reg ?? p?.reg ?? null,
      type: a.type ?? p?.type ?? null, airline: a.airline ?? p?.airline ?? null,
    };

    if (p) {
      const l = p.last;
      if (!l.onGround && s.onGround && inTerm && l.distNm <= ap.terminalNm) {
        emit(ident, 'ARR', 'HIGH', s.ts, (p.lastAirborne ?? l).trackDeg);
      } else if (l.onGround && !s.onGround && inTerm) {
        emit(ident, 'DEP', 'HIGH', s.ts, s.trackDeg);
      }
    } else if (!s.onGround && inTerm && s.aglFt != null && s.aglFt < cfg.lowAglFt && (s.vsFpm ?? 0) >= cfg.vsDepFpm) {
      emit(ident, 'DEP', 'LOW', s.ts, s.trackDeg);
    }

    tracks[a.hex] = {
      ...ident,
      firstSeen: p?.firstSeen ?? s.ts,
      last: s,
      lastAirborne: s.onGround ? p?.lastAirborne ?? null : s,
      trail: appendTrail(p?.trail ?? [], [a.lat, a.lon, a.onGround ? null : a.altFt, s.ts], now, cfg),
    };
  }

  // Tracks not in this snapshot: keep until lost, then evaluate ARR/LOW and drop.
  for (const [hex, t] of Object.entries(prev.tracks ?? {})) {
    if (seen.has(hex)) continue;
    const l = t.last;
    if (now - l.ts < cfg.lostAfterSec) { tracks[hex] = t; continue; }
    if (!l.onGround && l.distNm <= ap.terminalNm && l.aglFt != null && l.aglFt < cfg.lowAglFt && (l.vsFpm ?? 0) <= cfg.vsArrFpm) {
      emit(t, 'ARR', 'LOW', l.ts, l.trackDeg);
    }
  }

  const h = localHourStart(now, ap.tz);
  const count = aircraft.length;
  const hist = (Array.isArray(prev.hourMax) ? prev.hourMax : []).filter((x) => x.hourTs !== h && h - x.hourTs <= 3 * 3600);
  const cur = (Array.isArray(prev.hourMax) ? prev.hourMax : []).find((x) => x.hourTs === h);
  const hourMax = [...hist, { hourTs: h, max: Math.max(cur?.max ?? 0, count) }];

  return { state: { v: 1, updatedAt: now, tracks, recent, finals: prev.finals ?? [], hourMax }, events };
}
