// METAR (3 h history), TAF, PIREP, SIGMET and Open-Meteo forecast ingest.
// Each job is one upstream fetch + one D1 write; the payload stored is already normalized.
import { AIRPORT, AWC_BASE, OPEN_METEO_BASE, WX } from '../config';
import { fetchJson } from '../lib/http';
import { normalizeForecast } from '../normalize/forecast';
import { normalizeMetarList } from '../normalize/metar';
import { normalizePireps } from '../normalize/pirep';
import { filterSigmets } from '../normalize/sigmet';
import { normalizeTaf } from '../normalize/taf';
import { runBatch, stateStmt, type StateKey } from '../store/d1';
import type { Env } from '../types';

async function save(env: Env, key: StateKey, value: unknown, now: number) {
  const r = await runBatch(env.DB, [stateStmt(env.DB, key, value, now)]);
  if (!r.ok) throw new Error(`D1 write: ${r.error}`);
}

export async function ingestMetar(env: Env, now: number) {
  const raw = await fetchJson(`${AWC_BASE}/metar?ids=${AIRPORT.icao}&format=json&hours=${WX.metarHistoryHours}`, env.CONTACT_EMAIL);
  const hist = normalizeMetarList(raw);
  if (!hist.length) throw new Error('METAR: empty response');
  await save(env, 'metar_hist', hist, now);
}

export async function ingestTaf(env: Env, now: number) {
  const raw = await fetchJson(`${AWC_BASE}/taf?ids=${AIRPORT.icao}&format=json`, env.CONTACT_EMAIL);
  const taf = normalizeTaf(raw);
  if (!taf) throw new Error('TAF: empty response');
  await save(env, 'taf', taf, now);
}

export async function ingestPirep(env: Env, now: number) {
  const raw = await fetchJson(
    `${AWC_BASE}/pirep?id=${AIRPORT.icao}&distance=${WX.pirepRadiusNm}&age=${WX.pirepMaxAgeHours}&format=json`, env.CONTACT_EMAIL);
  await save(env, 'pirep', normalizePireps(raw, now), now);
}

export async function ingestSigmet(env: Env, now: number) {
  const raw = await fetchJson(`${AWC_BASE}/isigmet?format=json`, env.CONTACT_EMAIL);
  await save(env, 'sigmet', filterSigmets(raw, now), now);
}

export async function ingestForecast(env: Env, now: number) {
  const hourly = 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover';
  const url = `${OPEN_METEO_BASE}?latitude=${AIRPORT.lat}&longitude=${AIRPORT.lon}&hourly=${hourly}` +
    `&wind_speed_unit=kn&timeformat=unixtime&forecast_hours=${WX.forecastHours + 1}&timezone=${encodeURIComponent(AIRPORT.tz)}`;
  const raw = await fetchJson(url, env.CONTACT_EMAIL);
  const fc = normalizeForecast(raw, now, WX.forecastHours);
  if (!fc.length) throw new Error('forecast: empty response');
  await save(env, 'forecast', fc, now);
}
