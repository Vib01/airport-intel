// Pure. Observed runway in use from recent low-altitude aligned tracks. Never inferred from wind.
import { AIRPORT, DETECT, type RunwayConfig } from '../config';
import { angleDiff } from '../lib/geo';
import type { Aircraft, FinalObs, RunwayInUse } from '../types';

export const runwaysConfigured = (runways: RunwayConfig[]) => runways.length > 0 && runways.every((r) => r.trueHdg != null);

/** Runway whose true heading is within `runwayAlignDeg` of the track. */
export function matchRunway(trackDeg: number | null, runways: RunwayConfig[], cfg = DETECT): string | null {
  if (trackDeg == null) return null;
  let best: { id: string; d: number } | null = null;
  for (const r of runways) {
    if (r.trueHdg == null) continue;
    const d = angleDiff(trackDeg, r.trueHdg);
    if (d <= cfg.runwayAlignDeg && (!best || d < best.d)) best = { id: r.id, d };
  }
  return best?.id ?? null;
}

/** New alignment observations this minute: airborne, inside finalNm, below finalAglFt. */
export function observeFinals(aircraft: Aircraft[], now: number, runways: RunwayConfig[], ap = AIRPORT, cfg = DETECT): FinalObs[] {
  const out: FinalObs[] = [];
  for (const a of aircraft) {
    if (a.onGround || a.distNm > ap.finalNm || a.altFt == null) continue;
    if (a.altFt - ap.elevFt > cfg.finalAglFt) continue;
    const rwy = matchRunway(a.trackDeg, runways, cfg);
    if (rwy) out.push({ hex: a.hex, rwy, ts: now });
  }
  return out;
}

/** Merge and keep only the look-back window; one entry per (hex, rwy), latest ts. */
export function mergeFinals(prev: FinalObs[], add: FinalObs[], now: number, cfg = DETECT): FinalObs[] {
  const m = new Map<string, FinalObs>();
  for (const f of [...prev, ...add]) {
    if (now - f.ts > cfg.runwayWindowSec) continue;
    const k = `${f.hex}:${f.rwy}`;
    const cur = m.get(k);
    if (!cur || f.ts > cur.ts) m.set(k, f);
  }
  return [...m.values()];
}

export function runwayInUse(finals: FinalObs[], now: number, runways: RunwayConfig[], cfg = DETECT): RunwayInUse {
  if (!runwaysConfigured(runways)) return { runway: null, count: 0, lastSeenAt: null, reason: 'RUNWAY_CONFIG_MISSING' };
  const tally = new Map<string, { hexes: Set<string>; last: number }>();
  for (const f of finals) {
    if (now - f.ts > cfg.runwayWindowSec) continue;
    const t = tally.get(f.rwy) ?? { hexes: new Set(), last: 0 };
    t.hexes.add(f.hex);
    t.last = Math.max(t.last, f.ts);
    tally.set(f.rwy, t);
  }
  let best: { rwy: string; count: number; last: number } | null = null;
  for (const [rwy, t] of tally) {
    const c = t.hexes.size;
    if (!best || c > best.count || (c === best.count && t.last > best.last)) best = { rwy, count: c, last: t.last };
  }
  if (!best) return { runway: null, count: 0, lastSeenAt: null, reason: 'NO_RECENT_TRAFFIC' };
  return { runway: best.rwy, count: best.count, lastSeenAt: best.last };
}
