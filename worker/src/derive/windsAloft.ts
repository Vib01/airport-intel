// Pure. Collapse routine AIREPs (no turbulence/icing) into one winds-aloft summary.
// Direction is a vector average weighted by speed, so 350° and 010° average to 000°, not 180°.
import type { Pirep } from '../types';

export type WindsAloft = {
  count: number;
  minAltFt: number | null; maxAltFt: number | null;
  avgDirDeg: number | null; avgKt: number | null; minKt: number | null; maxKt: number | null;
  minTempC: number | null; maxTempC: number | null;
  newest: number | null;
} | null;

export const isRoutine = (p: Pick<Pirep, 'kind' | 'turbulence' | 'icing'>) => p.kind === 'AIREP' && !p.turbulence && !p.icing;

export function windsAloft(list: Pirep[]): WindsAloft {
  const r = list.filter(isRoutine);
  if (!r.length) return null;
  const alts = r.map((p) => p.altFt).filter((v): v is number => v != null);
  const temps = r.map((p) => p.tempC).filter((v): v is number => v != null);
  const winds = r.filter((p) => p.windKt != null && p.windDirDeg != null);
  let x = 0, y = 0;
  for (const p of winds) {
    const a = (p.windDirDeg! * Math.PI) / 180;
    x += p.windKt! * Math.sin(a);
    y += p.windKt! * Math.cos(a);
  }
  const kts = winds.map((p) => p.windKt!);
  return {
    count: r.length,
    minAltFt: alts.length ? Math.min(...alts) : null,
    maxAltFt: alts.length ? Math.max(...alts) : null,
    avgDirDeg: winds.length ? Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360) : null,
    avgKt: kts.length ? Math.round(kts.reduce((s, k) => s + k, 0) / kts.length) : null,
    minKt: kts.length ? Math.min(...kts) : null,
    maxKt: kts.length ? Math.max(...kts) : null,
    minTempC: temps.length ? Math.min(...temps) : null,
    maxTempC: temps.length ? Math.max(...temps) : null,
    newest: Math.max(...r.map((p) => p.obsTime)),
  };
}
