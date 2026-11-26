import { describe, expect, it } from 'vitest';
import { jobsToRun } from '../../src/jobs/schedule';
import { JOBS } from '../../src/jobs/dispatch';
import { CATCHUP, HEALTH } from '../../src/config';
import type { HealthState } from '../../src/types';

const NOW = 1_795_650_000;
const ok = (ago: number) => ({ lastOkAt: NOW - ago, lastError: null, lastErrorAt: null });
const healthy = (): HealthState => Object.fromEntries(JOBS.map((j) => [j.name, ok(30)]));

describe('jobsToRun', () => {
  it('healthy state: only slot-due jobs run; ADS-B every 3 min, routes the minute after', () => {
    expect(jobsToRun(JOBS, 0, 12, NOW, healthy())).toEqual([{ name: 'adsb', why: 'due' }, { name: 'metar', why: 'due' }]);
    expect(jobsToRun(JOBS, 7, 12, NOW, healthy()).map((j) => j.name)).toEqual(['routes', 'forecast']);
    // 480 ADS-B polls a day: inside adsb.lol's 500/day limit.
    expect(Array.from({ length: 1440 }, (_, i) => i % 60).filter((m) => JOBS[0].due(m, 0, m)).length).toBe(480);
  });

  it('stats rollup runs at LOCAL minute 59 and 4 (NST: UTC :29 and :34), not UTC :59', () => {
    const names = (m: number, lm: number) => jobsToRun(JOBS, m, 3, NOW, healthy(), lm).map((j) => j.name);
    expect(names(29, 59)).toContain('stats');
    expect(names(34, 4)).toContain('stats');
    expect(names(59, 29)).not.toContain('stats');
  });

  it('fresh deploy: never-run jobs catch up, bounded per tick', () => {
    const r = jobsToRun(JOBS, 11, 12, NOW, {});
    expect(r.filter((j) => j.why === 'catchup')).toHaveLength(CATCHUP.maxPerTick);
    expect(r[0]).toEqual({ name: 'adsb', why: 'catchup' });          // minute 11 is not an ADS-B slot
    expect(r.find((j) => j.name === 'taf')?.why).toBe('due');           // minute 11 is TAF's slot
  });

  it('stale job catches up; one that just failed waits retryAfterSec', () => {
    const h = healthy();
    h.forecast = ok(HEALTH.forecast.staleSec + 60);
    expect(jobsToRun(JOBS, 11, 12, NOW, h).find((j) => j.name === 'forecast')?.why).toBe('catchup');
    h.forecast = { ...h.forecast, lastError: 'timeout', lastErrorAt: NOW - 60 };
    expect(jobsToRun(JOBS, 11, 12, NOW, h).find((j) => j.name === 'forecast')).toBeUndefined();
    h.forecast = { ...h.forecast, lastErrorAt: NOW - CATCHUP.retryAfterSec - 1 };
    expect(jobsToRun(JOBS, 11, 12, NOW, h).find((j) => j.name === 'forecast')?.why).toBe('catchup');
  });
});
