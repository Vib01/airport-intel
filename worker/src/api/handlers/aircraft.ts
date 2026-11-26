import { loadState } from '../data';
import { health, live, meta, nowSec } from './common';
import type { Env } from '../../types';

export async function aircraftList(env: Env) {
  const { value: rows, db } = await loadState(env.DB, ['live', 'health']);
  const l = live(rows);
  const now = nowSec();
  return { generatedAt: l.generatedAt, source: l.source, aircraft: l.aircraft, runway: l.runway, meta: meta(), health: health(rows, now, db) };
}

export async function aircraftOne(env: Env, hex: string) {
  const { value: rows, db } = await loadState(env.DB, ['live', 'health']);
  const l = live(rows);
  const a = l.aircraft.find((x) => x.hex === hex.toLowerCase()) ?? null;
  return { generatedAt: l.generatedAt, aircraft: a, schedule: null, health: health(rows, nowSec(), db) };
}
