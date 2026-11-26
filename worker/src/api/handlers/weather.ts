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
  // Rows stored before `kind` existed are classified from their raw text.
  const pirep = ((rows.pirep?.value as Pirep[] | undefined) ?? [])
    .map((p) => (p.kind ? p : { ...p, kind: pirepKind({ rawOb: p.raw, pirepType: p.type }), negative: p.negative ?? null }));
  return {
    ...buildWeather(rows, now, db),
    meta: meta(),
    pirep,
    windsAloft: windsAloft(pirep),
    sigmet: (rows.sigmet?.value as SigmetCollection | undefined) ?? { type: 'FeatureCollection', features: [] },
    runway: live(rows).runway,
  };
}
