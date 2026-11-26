// Typed D1 queries. Never throws to callers: every function returns a Result.
import type { DbStatus, MovementEvent, Movement, StatsHourlyRow } from '../types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; db: DbStatus };

export function classifyDbError(e: unknown): DbStatus {
  const msg = String((e as Error)?.message ?? e);
  return /quota|exceed|limit|too many/i.test(msg) ? 'quota' : 'error';
}

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 300), db: classifyDbError(e) };
  }
}

export type StateKey = 'live' | 'tracks' | 'metar' | 'metar_hist' | 'taf' | 'pirep' | 'sigmet' | 'forecast' | 'health' | 'routes';
export type StateRow<T = unknown> = { value: T; updatedAt: number };

export function getState(db: D1Database, keys: StateKey[]): Promise<Result<Partial<Record<StateKey, StateRow>>>> {
  return attempt(async () => {
    const ph = keys.map(() => '?').join(',');
    const { results } = await db.prepare(`SELECT key, value, updated_at FROM state WHERE key IN (${ph})`).bind(...keys)
      .all<{ key: StateKey; value: string; updated_at: number }>();
    const out: Partial<Record<StateKey, StateRow>> = {};
    for (const r of results ?? []) {
      try { out[r.key] = { value: JSON.parse(r.value), updatedAt: r.updated_at }; } catch { /* corrupt row: skip */ }
    }
    return out;
  });
}

export function stateStmt(db: D1Database, key: StateKey, value: unknown, now: number): D1PreparedStatement {
  return db.prepare('INSERT INTO state (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3')
    .bind(key, JSON.stringify(value), now);
}

export function movementStmt(db: D1Database, m: MovementEvent): D1PreparedStatement {
  return db.prepare('INSERT INTO movements (kind, hex, callsign, reg, type, airline, runway, ts, confidence) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(m.kind, m.hex, m.callsign, m.reg, m.type, m.airline, m.runway, m.ts, m.confidence);
}

export function hourlyStmt(db: D1Database, r: StatsHourlyRow): D1PreparedStatement {
  return db.prepare(`INSERT INTO stats_hourly (hour_ts, arr, dep, by_airline, by_type, by_runway, max_aircraft_seen)
    VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(hour_ts) DO UPDATE SET arr=?2, dep=?3, by_airline=?4, by_type=?5, by_runway=?6,
    max_aircraft_seen=MAX(stats_hourly.max_aircraft_seen, ?7)`)
    .bind(r.hour_ts, r.arr, r.dep, JSON.stringify(r.by_airline), JSON.stringify(r.by_type), JSON.stringify(r.by_runway), r.max_aircraft_seen);
}

export function runBatch(db: D1Database, stmts: D1PreparedStatement[]): Promise<Result<number>> {
  return attempt(async () => {
    if (!stmts.length) return 0;
    await db.batch(stmts);
    return stmts.length;
  });
}

export function queryMovements(db: D1Database, sinceTs: number, untilTs = 2 ** 31, limit = 2000): Promise<Result<Movement[]>> {
  return attempt(async () => {
    const { results } = await db.prepare(
      'SELECT id, kind, hex, callsign, reg, type, airline, runway, ts, confidence FROM movements WHERE ts >= ? AND ts < ? ORDER BY ts DESC LIMIT ?',
    ).bind(sinceTs, untilTs, limit).all<Movement>();
    return results ?? [];
  });
}

export function queryHourly(db: D1Database, sinceTs: number): Promise<Result<StatsHourlyRow[]>> {
  return attempt(async () => {
    const { results } = await db.prepare('SELECT * FROM stats_hourly WHERE hour_ts >= ? ORDER BY hour_ts ASC')
      .bind(sinceTs).all<Record<string, unknown>>();
    const parse = (s: unknown) => { try { return JSON.parse(String(s)) as Record<string, number>; } catch { return {}; } };
    return (results ?? []).map((r) => ({
      hour_ts: Number(r.hour_ts), arr: Number(r.arr), dep: Number(r.dep),
      by_airline: parse(r.by_airline), by_type: parse(r.by_type), by_runway: parse(r.by_runway),
      max_aircraft_seen: Number(r.max_aircraft_seen),
    }));
  });
}

export function pruneStmts(db: D1Database, movementsBefore: number, statsBefore: number): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM movements WHERE ts < ?').bind(movementsBefore),
    db.prepare('DELETE FROM stats_hourly WHERE hour_ts < ?').bind(statsBefore),
  ];
}
