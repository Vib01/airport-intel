// Pure: Open-Meteo hourly (timeformat=unixtime, wind in kn) → ForecastHour[].
import type { ForecastHour } from '../types';

type Hourly = Record<string, (number | null)[]>;

export function normalizeForecast(raw: unknown, now: number, hours: number): ForecastHour[] {
  const h = (raw as { hourly?: Hourly })?.hourly;
  if (!h || !Array.isArray(h.time)) return [];
  const at = (k: string, i: number) => {
    const v = h[k]?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const out: ForecastHour[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i];
    if (typeof t !== 'number' || t < now - 3600) continue;
    out.push({
      t,
      tempC: at('temperature_2m', i),
      popPct: at('precipitation_probability', i),
      weatherCode: at('weather_code', i),
      windKt: at('wind_speed_10m', i),
      windDirDeg: at('wind_direction_10m', i),
      gustKt: at('wind_gusts_10m', i),
      visM: at('visibility', i),
      cloudPct: at('cloud_cover', i),
    });
    if (out.length >= hours) break;
  }
  return out;
}
