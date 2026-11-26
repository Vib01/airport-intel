import { API_LIMITS } from '../../config';
import { loadMovements, loadState, worstDb } from '../data';
import { health, intParam, nowSec } from './common';
import type { Env } from '../../types';

export async function movements(env: Env, url: URL) {
  const now = nowSec();
  const hours = intParam(url, 'hours', 24, 1, API_LIMITS.movementsMaxHours);
  const [mv, st] = await Promise.all([loadMovements(env.DB, now - hours * 3600), loadState(env.DB, ['health'])]);
  return {
    now, hours,
    arrivals: mv.value.filter((m) => m.kind === 'ARR'),
    departures: mv.value.filter((m) => m.kind === 'DEP'),
    health: health(st.value, now, worstDb(mv.db, st.db)),
  };
}
