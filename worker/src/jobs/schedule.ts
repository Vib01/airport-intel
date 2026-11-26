// Pure scheduling decision. A job runs when its minute slot is due, or as a catch-up when it has
// never succeeded or has gone STALE — so a fresh deploy (or a recovered outage) fills every panel
// within a minute or two instead of waiting up to an hour for the slot.
import { CATCHUP, HEALTH } from '../config';
import type { HealthState } from '../types';

/** m, h: UTC minute/hour of the tick; lm: LOCAL minute (airport time zone). */
export type JobSlot = { name: string; due: (m: number, h: number, lm: number) => boolean };

export function jobsToRun(jobs: JobSlot[], m: number, h: number, now: number, health: HealthState, lm: number = m): { name: string; why: 'due' | 'catchup' }[] {
  const out: { name: string; why: 'due' | 'catchup' }[] = [];
  let catchups = 0;
  for (const j of jobs) {
    if (j.due(m, h, lm)) { out.push({ name: j.name, why: 'due' }); continue; }
    const s = health[j.name];
    const staleSec = HEALTH[j.name]?.staleSec ?? Infinity;
    const neverOk = !s?.lastOkAt;
    const stale = !!s?.lastOkAt && now - s.lastOkAt > staleSec;
    const recentlyFailed = !!s?.lastErrorAt && now - s.lastErrorAt < CATCHUP.retryAfterSec && (s.lastErrorAt ?? 0) > (s.lastOkAt ?? 0);
    if ((neverOk || stale) && !recentlyFailed && catchups < CATCHUP.maxPerTick) {
      out.push({ name: j.name, why: 'catchup' });
      catchups++;
    }
  }
  return out;
}
