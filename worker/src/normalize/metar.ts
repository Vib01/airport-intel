// Pure: aviationweather.gov METAR JSON → Metar (units normalized: kt, SM, hPa, ft).
import { altimToHpa, parseVisSm } from '../lib/units';
import type { CloudLayer, Metar } from '../types';

type RawCloud = { cover?: string; base?: number | null };
export type RawMetar = {
  rawOb?: string; metarType?: string; obsTime?: number; temp?: number | null; dewp?: number | null;
  wdir?: number | string | null; wspd?: number | null; wgst?: number | null; visib?: number | string | null;
  altim?: number | null; clouds?: RawCloud[] | null; vertVis?: number | null; wxString?: string | null;
};

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function normalizeClouds(clouds: RawCloud[] | null | undefined, vertVis?: number | null): {
  clouds: CloudLayer[]; vertVisFt: number | null; cavok: boolean;
} {
  const out: CloudLayer[] = [];
  let vv: number | null = n(vertVis);   // feet
  let cavok = false;
  for (const c of clouds ?? []) {
    const cover = String(c?.cover ?? '').toUpperCase();
    if (!cover) continue;
    if (cover === 'CAVOK') { cavok = true; continue; }
    if (cover === 'OVX' || cover === 'VV') { vv = n(c.base); continue; }   // AWC encodes VV as OVX
    out.push({ cover, baseFt: n(c.base) });
  }
  return { clouds: out, vertVisFt: vv, cavok };
}

/** Wind direction: number = TRUE degrees; "VRB" = variable. Calm (0 kt) → dir null. */
export function normalizeWind(wdir: unknown, wspd: unknown, wgst: unknown) {
  const windKt = n(wspd);
  const variable = typeof wdir === 'string' && wdir.toUpperCase().startsWith('VRB');
  let windDirDeg = variable ? null : n(typeof wdir === 'string' ? Number(wdir) : wdir);
  if (windKt === 0) windDirDeg = null;
  return { windDirDeg, windVariable: variable, windKt, gustKt: n(wgst) };
}

export function normalizeMetar(r: RawMetar): Metar | null {
  if (!r || !r.rawOb || n(r.obsTime) == null) return null;
  const raw = r.rawOb.trim();
  const { clouds, vertVisFt, cavok } = normalizeClouds(r.clouds, r.vertVis);
  const vis = parseVisSm(r.visib);
  return {
    raw,
    type: r.metarType === 'SPECI' || raw.startsWith('SPECI') ? 'SPECI' : 'METAR',
    obsTime: r.obsTime!,
    tempC: n(r.temp),
    dewpC: n(r.dewp),
    ...normalizeWind(r.wdir, r.wspd, r.wgst),
    visSm: vis.visSm,
    visPlus: vis.visPlus,
    altimHpa: altimToHpa(r.altim),
    clouds,
    vertVisFt,
    wx: r.wxString?.trim() || null,
    cavok: cavok || /\bCAVOK\b/.test(raw),
  };
}

/** Newest first, deduplicated by obsTime. */
export function normalizeMetarList(list: unknown): Metar[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<number>();
  const out: Metar[] = [];
  for (const r of list) {
    const m = normalizeMetar(r as RawMetar);
    if (!m || seen.has(m.obsTime)) continue;
    seen.add(m.obsTime);
    out.push(m);
  }
  return out.sort((a, b) => b.obsTime - a.obsTime);
}
