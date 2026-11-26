// Pure. Uses up to 3 h of METARs: Δ ≥ +1 hPa RISING, ≤ −1 hPa FALLING, else STEADY.
import { WX } from '../config';
import type { Metar, PressureTrend } from '../types';

export function pressureTrend(metars: Pick<Metar, 'obsTime' | 'altimHpa'>[]): PressureTrend {
  const obs = metars.filter((m) => m.altimHpa != null).sort((a, b) => a.obsTime - b.obsTime);
  if (obs.length < 2) return null;
  const newest = obs[obs.length - 1];
  const windowStart = newest.obsTime - WX.metarHistoryHours * 3600;
  const oldest = obs.find((m) => m.obsTime >= windowStart)!;
  if (oldest === newest) return null;
  const delta = Math.round((newest.altimHpa! - oldest.altimHpa!) * 10) / 10;
  const trend = delta >= WX.pressureTrendHpa ? 'RISING' : delta <= -WX.pressureTrendHpa ? 'FALLING' : 'STEADY';
  return { deltaHpa: delta, trend, spanHours: Math.round(((newest.obsTime - oldest.obsTime) / 3600) * 10) / 10 };
}
