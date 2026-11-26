// Pure. METAR wind direction is TRUE; runway designators are MAGNETIC, so config holds TRUE headings.
import { round } from '../lib/geo';
import type { RunwayConfig } from '../config';
import type { Metar, RunwayWind } from '../types';

export function components(windDirDeg: number, speedKt: number, rwyTrueHdg: number) {
  const th = ((windDirDeg - rwyTrueHdg) * Math.PI) / 180;
  return { head: speedKt * Math.cos(th), cross: speedKt * Math.sin(th) };
}

export function runwayWinds(m: Pick<Metar, 'windDirDeg' | 'windVariable' | 'windKt' | 'gustKt'> | null, runways: RunwayConfig[]): RunwayWind[] {
  return runways.map((r): RunwayWind => {
    if (r.trueHdg == null) return { rwy: r.id, ok: false, reason: 'RUNWAY_CONFIG_MISSING' };
    if (!m || m.windKt == null) return { rwy: r.id, ok: false, reason: 'NO_WIND' };
    if (m.windKt === 0) return { rwy: r.id, ok: false, reason: 'CALM' };
    if (m.windVariable || m.windDirDeg == null) return { rwy: r.id, ok: false, reason: 'VARIABLE' };
    const s = components(m.windDirDeg, m.windKt, r.trueHdg);
    const g = m.gustKt != null ? components(m.windDirDeg, m.gustKt, r.trueHdg) : null;
    const cross = round(s.cross, 1);
    return {
      rwy: r.id, ok: true,
      headwindKt: round(s.head, 1) + 0,   // +0 turns -0 into 0
      crosswindKt: Math.abs(cross) + 0,
      side: cross > 0 ? 'R' : cross < 0 ? 'L' : null,    // wind from the right/left of the runway
      gustHeadwindKt: g ? round(g.head, 1) + 0 : null,
      gustCrosswindKt: g ? Math.abs(round(g.cross, 1)) + 0 : null,
    };
  });
}
