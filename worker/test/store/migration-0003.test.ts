// Runs the real migration SQL on SQLite (node:sqlite, same engine family as D1) with seeded data.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { localHourStart } from '../../src/lib/time';

const here = dirname(fileURLToPath(import.meta.url));
const sql = (f: string) => readFileSync(join(here, '..', '..', 'migrations', f), 'utf8');
const Z = (iso: string) => Date.parse(iso) / 1000;
const TZ = 'America/St_Johns';

async function db() {
  const { DatabaseSync } = await import('node:sqlite');
  const d = new DatabaseSync(':memory:');
  d.exec(sql('0001_init.sql'));
  d.exec(sql('0002_stats.sql'));
  return d;
}

type Row = { hour_ts: number; arr: number; dep: number; by_airline: string; by_type: string; by_runway: string; max_aircraft_seen: number };

describe('migration 0003: re-bucket stats_hourly on local hours', () => {
  it('recounts from movements on NST hours and keeps max_aircraft_seen', async () => {
    const d = await db();
    const ins = d.prepare('INSERT INTO movements (kind, hex, callsign, airline, type, runway, ts, confidence) VALUES (?,?,?,?,?,?,?,?)');
    ins.run('ARR', 'a', 'ACA1', 'ACA', 'A320', '28', Z('2026-11-25T23:40:00Z'), 'HIGH');   // 20:10 NST
    ins.run('DEP', 'b', 'WJA2', 'WJA', 'B738', '28', Z('2026-11-26T00:20:00Z'), 'LOW');    // 20:50 NST
    ins.run('ARR', 'c', 'PVL3', 'PVL', 'DH8D', null, Z('2026-11-26T00:35:00Z'), 'HIGH');   // 21:05 NST
    // Old UTC-aligned rows as the previous code wrote them (23:00Z and 00:00Z buckets).
    const old = d.prepare('INSERT INTO stats_hourly VALUES (?,?,?,?,?,?,?)');
    old.run(Z('2026-11-25T23:00:00Z'), 1, 0, '{"ACA":1}', '{"A320":1}', '{"28":1}', 5);
    old.run(Z('2026-11-26T00:00:00Z'), 1, 1, '{"WJA":1,"PVL":1}', '{"B738":1,"DH8D":1}', '{"28":1}', 9);

    d.exec(sql('0003_rebucket_stats_local_hours.sql'));
    const rows = d.prepare('SELECT * FROM stats_hourly ORDER BY hour_ts').all() as Row[];

    // Every row is now on a local hour boundary.
    for (const r of rows) expect(localHourStart(r.hour_ts, TZ)).toBe(r.hour_ts);
    const h20 = rows.find((r) => r.hour_ts === Z('2026-11-25T23:30:00Z'))!;                // 20:00 NST
    const h21 = rows.find((r) => r.hour_ts === Z('2026-11-26T00:30:00Z'))!;                // 21:00 NST
    expect(h20).toMatchObject({ arr: 1, dep: 1, max_aircraft_seen: 9 });
    expect(JSON.parse(h20.by_airline)).toEqual({ ACA: 1, WJA: 1 });
    expect(JSON.parse(h20.by_runway)).toEqual({ '28': 2 });
    expect(h21).toMatchObject({ arr: 1, dep: 0 });
    expect(JSON.parse(h21.by_type)).toEqual({ DH8D: 1 });
    expect(JSON.parse(h21.by_runway)).toEqual({});
    // Totals preserved: 3 movements in, 3 out.
    expect(rows.reduce((s, r) => s + r.arr + r.dep, 0)).toBe(3);
    // Temp table cleaned up.
    expect(d.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'stats_hourly_local'").get()).toEqual({ n: 0 });
  });

  it('old rows beyond movement retention are kept (shifted 30 min); local-aligned rows untouched', async () => {
    const d = await db();
    d.prepare('INSERT INTO movements (kind, hex, ts, confidence) VALUES (?,?,?,?)').run('ARR', 'x', Z('2026-11-25T12:10:00Z'), 'HIGH');
    const old = d.prepare('INSERT INTO stats_hourly VALUES (?,?,?,?,?,?,?)');
    old.run(Z('2026-06-01T15:00:00Z'), 4, 2, '{"ACA":6}', '{}', '{}', 11);                // ancient UTC row
    old.run(Z('2026-11-25T14:30:00Z'), 0, 0, '{}', '{}', '{}', 3);                         // already local
    old.run(Z('2026-11-25T18:00:00Z'), 2, 0, '{"ACA":2}', '{}', '{}', 7);                  // UTC row, no movements

    d.exec(sql('0003_rebucket_stats_local_hours.sql'));
    const get = (ts: number) => d.prepare('SELECT * FROM stats_hourly WHERE hour_ts = ?').get(ts) as Row | undefined;

    expect(get(Z('2026-06-01T14:30:00Z'))).toMatchObject({ arr: 4, dep: 2, max_aircraft_seen: 11 });
    expect(get(Z('2026-11-25T14:30:00Z'))).toMatchObject({ arr: 0, dep: 0, max_aircraft_seen: 3 });
    expect(get(Z('2026-11-25T17:30:00Z'))).toMatchObject({ arr: 0, dep: 0, max_aircraft_seen: 7 });   // inside window: counts not trusted
    expect(get(Z('2026-11-25T11:30:00Z'))).toMatchObject({ arr: 1, dep: 0 });
  });
});
