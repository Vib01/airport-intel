// Pure. Source health → LIVE / STALE / OFFLINE.
import { HEALTH } from '../config';
import type { DbStatus, HealthReport, HealthState, SourceStatus } from '../types';

export function sourceStatus(source: string, lastOkAt: number | null, now: number): SourceStatus {
  const t = HEALTH[source] ?? { staleSec: 600, offlineSec: 3600 };
  if (lastOkAt == null) return 'OFFLINE';
  const age = now - lastOkAt;
  return age <= t.staleSec ? 'LIVE' : age <= t.offlineSec ? 'STALE' : 'OFFLINE';
}

export function healthReport(h: HealthState | null | undefined, now: number, db: DbStatus): HealthReport {
  const sources: HealthReport['sources'] = {};
  for (const k of Object.keys(HEALTH)) {
    const s = h?.[k] ?? { lastOkAt: null, lastError: null, lastErrorAt: null };
    sources[k] = { ...s, status: sourceStatus(k, s.lastOkAt, now) };
  }
  return { now, db, sources };
}
