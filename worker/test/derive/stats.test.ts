import { describe, expect, it } from 'vitest';
import { dailyFromHourly, rollupHourRow, todaySummary, topN } from '../../src/derive/stats';
import { healthReport, sourceStatus } from '../../src/derive/health';
import { localDayKey, localDayStart, tzOffsetSec } from '../../src/lib/time';
import type { MovementEvent } from '../../src/types';

const TZ = 'America/St_Johns';
const H = 1_795_600_800;   // an hour boundary (divisible by 3600)

const mv = (kind: 'ARR' | 'DEP', ts: number, airline: string | null = 'ACA', type = 'A320', runway: string | null = '29') =>
  ({ kind, ts, airline, type, runway }) as Pick<MovementEvent, 'kind' | 'ts' | 'airline' | 'type' | 'runway'>;

describe('stats', () => {
  it('rollupHourRow counts only the hour', () => {
    const row = rollupHourRow(H, [mv('ARR', H), mv('DEP', H + 100, 'WJA', 'B738', '11'), mv('ARR', H + 3600), mv('ARR', H - 1)], 7);
    expect(row).toEqual({
      hour_ts: H, arr: 1, dep: 1, max_aircraft_seen: 7,
      by_airline: { ACA: 1, WJA: 1 }, by_type: { A320: 1, B738: 1 }, by_runway: { '29': 1, '11': 1 },
    });
  });

  it('todaySummary: totals, busiest hour, top airlines, hourly buckets', () => {
    const s = todaySummary([mv('ARR', H + 10), mv('DEP', H + 20), mv('ARR', H + 3700, 'WJA'), mv('ARR', H - 10)], H, H + 7200);
    expect(s).toMatchObject({ arr: 2, dep: 1, total: 3, busiestHour: { hourTs: H, count: 2 } });
    expect(s.topAirlines[0]).toEqual({ key: 'ACA', count: 2 });
    expect(s.byHour).toHaveLength(3);
  });

  it('topN sorts by count then key', () => {
    expect(topN({ b: 2, a: 2, c: 5 }, 2)).toEqual([{ key: 'c', count: 5 }, { key: 'a', count: 2 }]);
  });

  it('dailyFromHourly groups by local (St. John\'s) day', () => {
    const d0 = localDayStart(H, TZ);
    const days = dailyFromHourly([
      { hour_ts: d0, arr: 1, dep: 2 }, { hour_ts: d0 + 3600 * 5, arr: 3, dep: 0 }, { hour_ts: d0 + 86400, arr: 1, dep: 1 },
    ], TZ, (ts) => localDayStart(ts, TZ));
    expect(days.map((d) => d.total)).toEqual([6, 2]);
  });
});

describe('time (America/St_Johns)', () => {
  it('offset is −3:30 in winter and −2:30 in summer', () => {
    expect(tzOffsetSec(Date.UTC(2026, 0, 15) / 1000, TZ)).toBe(-12600);
    expect(tzOffsetSec(Date.UTC(2026, 6, 15) / 1000, TZ)).toBe(-9000);
  });
  it('local midnight', () => {
    const ts = Date.UTC(2026, 10, 25, 22, 0) / 1000;          // 18:30 NST on Nov 25
    const d0 = localDayStart(ts, TZ);
    expect(d0).toBe(Date.UTC(2026, 10, 25, 3, 30) / 1000);    // 00:00 NST = 03:30Z
    expect(localDayKey(ts, TZ)).toBe('2026-11-25');
    expect(localDayKey(Date.UTC(2026, 10, 26, 2, 0) / 1000, TZ)).toBe('2026-11-25');   // 22:30 NST
  });
});

describe('health', () => {
  it('LIVE / STALE / OFFLINE thresholds', () => {
    expect(sourceStatus('adsb', 1000, 1100)).toBe('LIVE');
    expect(sourceStatus('adsb', 1000, 1000 + 600)).toBe('STALE');
    expect(sourceStatus('adsb', 1000, 1000 + 3600)).toBe('OFFLINE');
    expect(sourceStatus('adsb', null, 0)).toBe('OFFLINE');
  });
  it('report covers all sources and db status', () => {
    const r = healthReport({ metar: { lastOkAt: 100, lastError: null, lastErrorAt: null } }, 200, 'quota');
    expect(r.db).toBe('quota');
    expect(r.sources.metar.status).toBe('LIVE');
    expect(r.sources.adsb.status).toBe('OFFLINE');
  });
});
