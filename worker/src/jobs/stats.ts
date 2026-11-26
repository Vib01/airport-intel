import { AIRPORT, RETENTION } from '../config';
import { rollupHourRow } from '../derive/stats';
import { localHourStart } from '../lib/time';
import { getState, hourlyStmt, pruneStmts, queryMovements, runBatch } from '../store/d1';
import type { Env, TrackState } from '../types';

/** Roll up the previous full hour and the current partial hour (idempotent upserts). */
export async function rollupHours(env: Env, now: number) {
  const cur = localHourStart(now, AIRPORT.tz), prev = cur - 3600;   // local clock hours
  const [mv, st] = await Promise.all([queryMovements(env.DB, prev, cur + 3600), getState(env.DB, ['tracks'])]);
  if (!mv.ok) throw new Error(`D1 read: ${mv.error}`);
  const hm = st.ok ? ((st.value.tracks?.value as TrackState | undefined)?.hourMax ?? []) : [];
  const max = (h: number) => (Array.isArray(hm) ? hm.find((x) => x.hourTs === h)?.max ?? 0 : 0);
  const rows = [rollupHourRow(prev, mv.value, max(prev)), rollupHourRow(cur, mv.value, max(cur))];
  const r = await runBatch(env.DB, rows.map((row) => hourlyStmt(env.DB, row)));
  if (!r.ok) throw new Error(`D1 write: ${r.error}`);
}

export async function prune(env: Env, now: number) {
  const r = await runBatch(env.DB, pruneStmts(env.DB, now - RETENTION.movementsDays * 86400, now - RETENTION.statsDays * 86400));
  if (!r.ok) throw new Error(`D1 write: ${r.error}`);
}
