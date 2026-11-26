import { AIRPORT, API_LIMITS } from '../../config';
import { dailyFromHourly, mergeCounts, todaySummary, topN } from '../../derive/stats';
import { localDayStart } from '../../lib/time';
import { loadHourly, loadMovements, loadState, worstDb } from '../data';
import { health, intParam, nowSec } from './common';
import type { Env, StatsResponse } from '../../types';

export async function stats(env: Env, url: URL): Promise<StatsResponse> {
  const now = nowSec();
  const days = intParam(url, 'days', 7, 1, API_LIMITS.statsMaxDays);
  const today0 = localDayStart(now, AIRPORT.tz);
  const since = today0 - days * 86400;
  const [hr, mv, st] = await Promise.all([loadHourly(env.DB, since), loadMovements(env.DB, today0), loadState(env.DB, ['health'])]);

  const today = todaySummary(mv.value, today0, now);
  const past = hr.value.filter((r) => r.hour_ts < today0);
  const dayList = dailyFromHourly(past, AIRPORT.tz, (ts) => localDayStart(ts, AIRPORT.tz));
  const avg = dayList.length ? Math.round((dayList.reduce((s, d) => s + d.total, 0) / dayList.length) * 10) / 10 : null;

  return {
    now,
    today,
    hourly: hr.value.map((r) => ({ hourTs: r.hour_ts, arr: r.arr, dep: r.dep, maxAircraft: r.max_aircraft_seen })),
    days: [...dayList, { day: 'today', dayStart: today0, arr: today.arr, dep: today.dep, total: today.total }],
    avgDaily: avg,
    topAirlines: topN(mergeCounts(hr.value.map((r) => r.by_airline)), 8),
    topTypes: topN(mergeCounts(hr.value.map((r) => r.by_type)), 8),
    runwayShare: topN(mergeCounts(hr.value.map((r) => r.by_runway)), 8),
    health: health(st.value, now, worstDb(hr.db, mv.db, st.db)),
  };
}
