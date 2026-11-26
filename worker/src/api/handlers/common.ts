import { AIRPORT, RUNWAY_SOURCE, RUNWAYS } from '../../config';
import { healthReport } from '../../derive/health';
import { deriveWeather } from '../../derive/weather';
import type { StateKey, StateRow } from '../../store/d1';
import type { DbStatus, ForecastHour, HealthState, LiveState, Metar, Taf, WeatherResponse } from '../../types';

export type Rows = Partial<Record<StateKey, StateRow>>;

export const nowSec = () => Math.floor(Date.now() / 1000);

/** Airport + runway config, so the web app has one source of truth (centerlines, wind diagram). */
export const meta = () => ({
  icao: AIRPORT.icao, iata: AIRPORT.iata, name: AIRPORT.name, lat: AIRPORT.lat, lon: AIRPORT.lon,
  elevFt: AIRPORT.elevFt, tz: AIRPORT.tz, terminalNm: AIRPORT.terminalNm, finalNm: AIRPORT.finalNm,
  runways: RUNWAYS,
  runwaySource: RUNWAY_SOURCE,
});

export function health(rows: Rows, now: number, db: DbStatus) {
  return healthReport(rows.health?.value as HealthState | undefined, now, db);
}

export function live(rows: Rows): LiveState {
  return (rows.live?.value as LiveState | undefined) ?? {
    generatedAt: 0, source: null, aircraft: [], runway: { runway: null, count: 0, lastSeenAt: null, reason: 'NO_RECENT_TRAFFIC' },
  };
}

export function weather(rows: Rows, now: number, db: DbStatus): WeatherResponse {
  const hist = (rows.metar_hist?.value as Metar[] | undefined) ?? [];
  const taf = rows.taf?.value as Taf | undefined;
  return {
    now,
    metar: hist[0] ? { raw: hist[0].raw, decoded: hist[0] } : null,
    derived: deriveWeather(hist, now, RUNWAYS, AIRPORT.elevFt),
    taf: taf ? { raw: taf.raw, periods: taf.periods, issueTime: taf.issueTime, validFrom: taf.validFrom, validTo: taf.validTo } : null,
    forecast: ((rows.forecast?.value as ForecastHour[] | undefined) ?? []).filter((f) => f.t >= now - 3600),
    health: health(rows, now, db),
  };
}

export function intParam(url: URL, name: string, def: number, min: number, max: number): number {
  const v = parseInt(url.searchParams.get(name) ?? '', 10);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}
