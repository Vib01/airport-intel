// Pure. Everything derived from the METAR history.
import type { RunwayConfig } from '../config';
import { densityAltitude } from './densityAltitude';
import { flightCategory } from './flightCategory';
import { pressureTrend } from './pressureTrend';
import { runwayWinds } from './wind';
import type { Metar, WeatherDerived } from '../types';

export function deriveWeather(history: Metar[], now: number, runways: RunwayConfig[], elevFt: number): WeatherDerived | null {
  const m = history[0];
  if (!m) return null;
  return {
    category: flightCategory(m),
    categoryConvention: 'FAA',
    wind: runwayWinds(m, runways),
    da: densityAltitude(m.altimHpa, m.tempC, elevFt),
    trend: pressureTrend(history),
    ageMin: Math.max(0, Math.round((now - m.obsTime) / 60)),
  };
}
