// Pure: aviationweather.gov TAF JSON → Taf with TafPeriod[].
// TEMPO/PROB/BECMG groups only list what changes; missing fields are filled from the
// governing BASE/FM period so each period's category reflects the full conditions.
import { flightCategory } from '../derive/flightCategory';
import { parseVisSm } from '../lib/units';
import { normalizeClouds, normalizeWind } from './metar';
import type { Taf, TafChange, TafPeriod } from '../types';

type RawFcst = {
  timeFrom?: number; timeTo?: number; timeBec?: number | null; fcstChange?: string | null; probability?: number | null;
  wdir?: number | string | null; wspd?: number | null; wgst?: number | null; visib?: number | string | null;
  vertVis?: number | null; wxString?: string | null; clouds?: { cover?: string; base?: number | null }[] | null;
};
type RawTaf = { rawTAF?: string; issueTime?: string; validTimeFrom?: number; validTimeTo?: number; fcsts?: RawFcst[] };

function changeOf(f: RawFcst, i: number): TafChange {
  const c = (f.fcstChange ?? '').toUpperCase();
  if (c === 'FM' || c === 'TEMPO' || c === 'BECMG') return c;
  if (c.startsWith('PROB') || (f.probability != null && f.probability > 0)) return 'PROB';
  return i === 0 ? 'BASE' : 'FM';
}

export function normalizeTaf(list: unknown): Taf | null {
  const arr = Array.isArray(list) ? (list as RawTaf[]) : [];
  const r = arr[0];
  if (!r?.rawTAF || !Array.isArray(r.fcsts)) return null;

  const periods: TafPeriod[] = [];
  let governing: TafPeriod | null = null;
  r.fcsts.forEach((f, i) => {
    const change = changeOf(f, i);
    const wind = normalizeWind(f.wdir, f.wspd, f.wgst);
    const vis = parseVisSm(f.visib);
    const cl = normalizeClouds(f.clouds, f.vertVis);
    const hasClouds = (f.clouds?.length ?? 0) > 0 || f.vertVis != null;
    const partial = change === 'TEMPO' || change === 'PROB' || change === 'BECMG';
    const g = partial ? governing : null;
    const p: TafPeriod = {
      from: f.timeFrom ?? 0,
      to: f.timeTo ?? 0,
      becomingAt: f.timeBec ?? null,
      change,
      probability: f.probability ?? null,
      windDirDeg: wind.windKt != null || wind.windVariable ? wind.windDirDeg : g?.windDirDeg ?? null,
      windVariable: wind.windKt != null ? wind.windVariable : g?.windVariable ?? false,
      windKt: wind.windKt ?? g?.windKt ?? null,
      gustKt: wind.windKt != null ? wind.gustKt : g?.gustKt ?? null,
      visSm: vis.visSm ?? g?.visSm ?? null,
      visPlus: vis.visSm != null ? vis.visPlus : g?.visPlus ?? false,
      wx: f.wxString?.trim() || null,
      clouds: hasClouds ? cl.clouds : g?.clouds ?? [],
      vertVisFt: hasClouds ? cl.vertVisFt : g?.vertVisFt ?? null,
      category: null,
    };
    p.category = flightCategory({ clouds: p.clouds, vertVisFt: p.vertVisFt, visSm: p.visSm, cavok: cl.cavok });
    periods.push(p);
    if (change === 'BASE' || change === 'FM') governing = p;
  });

  // A prevailing (BASE/FM) period lasts until the next FM group or the end of validity.
  // AWC ends the BASE at validTo and splits FM periods at BECMG groups; normalize both.
  const validTo = r.validTimeTo ?? 0;
  const prevailing = periods.filter((p) => p.change === 'BASE' || p.change === 'FM').sort((a, b) => a.from - b.from);
  prevailing.forEach((p, i) => { p.to = prevailing[i + 1]?.from ?? (validTo || p.to); });

  return {
    raw: r.rawTAF.trim(),
    issueTime: r.issueTime ? Math.floor(Date.parse(r.issueTime) / 1000) : 0,
    validFrom: r.validTimeFrom ?? 0,
    validTo: r.validTimeTo ?? 0,
    periods,
  };
}
