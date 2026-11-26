// One cron (* * * * *), minute-based branching. Jobs are staggered so each invocation
// makes at most ~2 upstream fetches (plus ADS-B fallbacks when a source is down).
import { ingestAdsb } from '../ingest/adsb';
import { ingestRoutes } from '../ingest/routes';
import { ingestForecast, ingestMetar, ingestPirep, ingestSigmet, ingestTaf } from '../ingest/weather';
import { getState, runBatch, stateStmt } from '../store/d1';
import { unixNow } from '../lib/time';
import { prune, rollupHours } from './stats';
import { jobsToRun } from './schedule';
import type { Env, HealthState } from '../types';

type Job = { name: string; due: (m: number, h: number) => boolean; run: (env: Env, now: number) => Promise<string | void> };

export const JOBS: Job[] = [
  { name: 'adsb', due: () => true, run: ingestAdsb },
  { name: 'routes', due: () => true, run: ingestRoutes },   // only fetches callsigns not yet cached
  { name: 'metar', due: (m) => m % 5 === 0, run: ingestMetar },
  { name: 'taf', due: (m) => m % 10 === 1, run: ingestTaf },
  { name: 'pirep', due: (m) => m % 10 === 2, run: ingestPirep },
  { name: 'sigmet', due: (m) => m % 10 === 3, run: ingestSigmet },
  { name: 'forecast', due: (m) => m === 7, run: ingestForecast },
  // Spec says minute 59; minute 4 of the next hour also catches late ARR/LOW events (detected after
  // lostAfterSec). Both run, the rollup is an idempotent upsert of the previous + current hour.
  { name: 'stats', due: (m) => m === 59 || m === 4, run: rollupHours },
  { name: 'prune', due: (m, h) => h === 7 && m === 30, run: prune },
];

export async function dispatch(t: Date, env: Env): Promise<HealthState> {
  const now = unixNow(t);
  const m = t.getUTCMinutes(), h = t.getUTCHours();

  const hs = await getState(env.DB, ['health']);
  const health: HealthState = (hs.ok && (hs.value.health?.value as HealthState)) || {};
  const plan = new Map(jobsToRun(JOBS, m, h, now, health).map((p) => [p.name, p.why]));

  // run(): catches errors, records {lastOkAt|lastError} into health; never rethrows.
  for (const job of JOBS) {
    if (!plan.has(job.name)) continue;
    const started = Date.now();
    const prev = health[job.name] ?? { lastOkAt: null, lastError: null, lastErrorAt: null };
    try {
      const used = await job.run(env, now);
      health[job.name] = { ...prev, lastOkAt: now, sourceUsed: typeof used === 'string' ? used : prev.sourceUsed ?? null };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 300);
      health[job.name] = { ...prev, lastError: msg, lastErrorAt: now };
      console.error(JSON.stringify({ job: job.name, error: msg }));
    }
    console.log(JSON.stringify({ job: job.name, why: plan.get(job.name), ms: Date.now() - started }));
  }

  const w = await runBatch(env.DB, [stateStmt(env.DB, 'health', health, now)]);
  if (!w.ok) console.error(JSON.stringify({ job: 'health', error: w.error, db: w.db }));
  return health;
}
