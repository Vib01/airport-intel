// Pure. Movement rollups (hourly rows, today summary, multi-day aggregates).
import { localDayKey, hourStart } from '../lib/time';
import type { Movement, MovementEvent, StatsDay, StatsHourlyRow, StatsToday } from '../types';

type M = Pick<MovementEvent, 'kind' | 'ts' | 'airline' | 'type' | 'runway'>;

const bump = (o: Record<string, number>, k: string | null | undefined) => { if (k) o[k] = (o[k] ?? 0) + 1; };

export function topN(counts: Record<string, number>, n = 5): { key: string; count: number }[] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([key, count]) => ({ key, count }));
}

export function mergeCounts(list: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of list) for (const [k, v] of Object.entries(o)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Roll movements in [hourTs, hourTs+3600) into one stats_hourly row. */
export function rollupHourRow(hourTs: number, movements: M[], maxAircraftSeen: number): StatsHourlyRow {
  const row: StatsHourlyRow = { hour_ts: hourTs, arr: 0, dep: 0, by_airline: {}, by_type: {}, by_runway: {}, max_aircraft_seen: maxAircraftSeen };
  for (const m of movements) {
    if (m.ts < hourTs || m.ts >= hourTs + 3600) continue;
    if (m.kind === 'ARR') row.arr++; else row.dep++;
    bump(row.by_airline, m.airline);
    bump(row.by_type, m.type);
    bump(row.by_runway, m.runway);
  }
  return row;
}

/** Today summary from raw movements since local midnight. */
export function todaySummary(movements: M[], dayStart: number, now: number): StatsToday {
  const byHourMap = new Map<number, { arr: number; dep: number }>();
  const airlines: Record<string, number> = {};
  let arr = 0, dep = 0;
  for (const m of movements) {
    if (m.ts < dayStart || m.ts > now) continue;
    const h = hourStart(m.ts);
    const b = byHourMap.get(h) ?? { arr: 0, dep: 0 };
    if (m.kind === 'ARR') { arr++; b.arr++; } else { dep++; b.dep++; }
    byHourMap.set(h, b);
    bump(airlines, m.airline);
  }
  const byHour: StatsToday['byHour'] = [];
  for (let h = hourStart(dayStart); h <= now; h += 3600) {
    const b = byHourMap.get(h) ?? { arr: 0, dep: 0 };
    byHour.push({ hourTs: h, ...b });
  }
  let busiest: StatsToday['busiestHour'] = null;
  for (const b of byHour) {
    const c = b.arr + b.dep;
    if (c > 0 && (!busiest || c > busiest.count)) busiest = { hourTs: b.hourTs, count: c };
  }
  return { dayStart, arr, dep, total: arr + dep, busiestHour: busiest, topAirlines: topN(airlines), byHour };
}

/** Group hourly rows into local days (tz). */
export function dailyFromHourly(rows: Pick<StatsHourlyRow, 'hour_ts' | 'arr' | 'dep'>[], tz: string, dayStartOf: (ts: number) => number): StatsDay[] {
  const m = new Map<string, StatsDay>();
  for (const r of rows) {
    const day = localDayKey(r.hour_ts, tz);
    const d = m.get(day) ?? { day, dayStart: dayStartOf(r.hour_ts), arr: 0, dep: 0, total: 0 };
    d.arr += r.arr; d.dep += r.dep; d.total += r.arr + r.dep;
    m.set(day, d);
  }
  return [...m.values()].sort((a, b) => a.dayStart - b.dayStart);
}

export type { Movement };
