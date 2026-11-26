// Read helpers with an in-isolate last-good fallback. Handlers never 5xx on DB trouble.
import { getState, queryHourly, queryMovements, type StateKey, type StateRow } from '../store/d1';
import type { DbStatus, Movement, StatsHourlyRow } from '../types';

const lastGood = new Map<string, unknown>();

export type Loaded<T> = { value: T; db: DbStatus };

export async function loadState(db: D1Database, keys: StateKey[]): Promise<Loaded<Partial<Record<StateKey, StateRow>>>> {
  const r = await getState(db, keys);
  if (r.ok) {
    for (const k of keys) if (r.value[k]) lastGood.set(`state:${k}`, r.value[k]);
    // Fill keys missing in D1 (never written yet) from memory too.
    for (const k of keys) if (!r.value[k] && lastGood.has(`state:${k}`)) r.value[k] = lastGood.get(`state:${k}`) as StateRow;
    return { value: r.value, db: 'ok' };
  }
  const out: Partial<Record<StateKey, StateRow>> = {};
  for (const k of keys) if (lastGood.has(`state:${k}`)) out[k] = lastGood.get(`state:${k}`) as StateRow;
  return { value: out, db: r.db };
}

export async function loadMovements(db: D1Database, since: number): Promise<Loaded<Movement[]>> {
  const r = await queryMovements(db, since);
  const key = 'movements';
  if (r.ok) {
    const prev = (lastGood.get(key) as { since: number } | undefined);
    if (!prev || since <= prev.since) lastGood.set(key, { since, rows: r.value });
    return { value: r.value, db: 'ok' };
  }
  const lg = lastGood.get(key) as { since: number; rows: Movement[] } | undefined;
  return { value: lg ? lg.rows.filter((m) => m.ts >= since) : [], db: r.db };
}

export async function loadHourly(db: D1Database, since: number): Promise<Loaded<StatsHourlyRow[]>> {
  const r = await queryHourly(db, since);
  if (r.ok) { lastGood.set('hourly', r.value); return { value: r.value, db: 'ok' }; }
  return { value: ((lastGood.get('hourly') as StatsHourlyRow[]) ?? []).filter((x) => x.hour_ts >= since), db: r.db };
}

/** Worst DB status of several loads. */
export function worstDb(...s: DbStatus[]): DbStatus {
  return s.includes('quota') ? 'quota' : s.includes('error') ? 'error' : 'ok';
}
