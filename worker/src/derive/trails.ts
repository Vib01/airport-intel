// Pure. Append a point to a trail, then trim to the last `trailMinutes` and ≤ `trailMaxPts` points.
import { DETECT } from '../config';
import type { TrailPoint } from '../types';

export function appendTrail(trail: TrailPoint[], p: TrailPoint, now: number, cfg = DETECT): TrailPoint[] {
  const last = trail[trail.length - 1];
  const next = last && last[0] === p[0] && last[1] === p[1] ? trail.slice() : [...trail, p];
  const cutoff = now - cfg.trailMinutes * 60;
  const kept = next.filter((q) => q[3] >= cutoff);
  return kept.length > cfg.trailMaxPts ? kept.slice(kept.length - cfg.trailMaxPts) : kept;
}
