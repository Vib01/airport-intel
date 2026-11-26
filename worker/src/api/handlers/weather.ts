import { windsAloft } from '../../derive/windsAloft';
import { pirepKind } from '../../normalize/pirep';
import { loadState } from '../data';
import { live, meta, nowSec, weather as buildWeather } from './common';
import type { Env, Pirep, SigmetCollection } from '../../types';

export async function weather(env: Env) {
  const { value: rows, db } = await loadState(env.DB, ['metar_hist', 'taf', 'forecast', 'health']);
  return buildWeather(rows, nowSec(), db);
}

export async function pilot(env: Env) {
  const { value: rows, db } = await loadState(env.DB, ['metar_hist', 'taf', 'forecast', 'health', 'pirep', 'sigmet', 'live']);
  const now = nowSec();
  // Rows stored by an older normalizer: classify from raw text and drop "NEG…" pseudo-hazards.
  const neg = (v: string | null) => (v && /^(NEG|NIL|NONE|SMTH|SMOOTH)/i.test(v) ? null : v);
  const pirep = ((rows.pirep?.value as Pirep[] | undefined) ?? []).map((p) => {
    if (p.kind && 'negative' in p) return p;
    const turbulence = neg(p.turbulence), icing = neg(p.icing);
    const negative = [p.turbulence && !turbulence ? 'TB NEG' : null, p.icing && !icing ? 'IC NEG' : null].filter(Boolean).join(', ') || null;
    return { ...p, kind: pirepKind({ rawOb: p.raw, pirepType: p.type }), turbulence, icing, negative };
  });
  return {
    ...buildWeather(rows, now, db),
    meta: meta(),
    pirep,
    windsAloft: windsAloft(pirep),
    sigmet: (rows.sigmet?.value as SigmetCollection | undefined) ?? { type: 'FeatureCollection', features: [] },
    runway: live(rows).runway,
  };
}
