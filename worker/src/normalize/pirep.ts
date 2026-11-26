// Pure: aviationweather.gov PIREP/AIREP JSON → Pirep[] within radius/age of the airport.
import { AIRPORT, WX } from '../config';
import { bearingDeg, distanceNm, round } from '../lib/geo';
import type { Pirep } from '../types';

type Raw = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function layer(int: unknown, type: unknown, bas: unknown, top: unknown, extra?: unknown): string | null {
  const i = s(int);
  if (!i) return null;
  const parts = [i, s(type), s(extra)].filter(Boolean).join(' ');
  const b = n(bas), t = n(top);
  const range = b != null || t != null ? ` ${b != null ? `FL${String(b).padStart(3, '0')}` : '?'}–${t != null ? `FL${String(t).padStart(3, '0')}` : '?'}` : '';
  return parts + range;
}

export function normalizePireps(list: unknown, now: number, ap = AIRPORT, radiusNm = WX.pirepRadiusNm, maxAgeH = WX.pirepMaxAgeHours): Pirep[] {
  if (!Array.isArray(list)) return [];
  const out: Pirep[] = [];
  for (const r of list as Raw[]) {
    const lat = n(r.lat), lon = n(r.lon), obs = n(r.obsTime);
    if (lat == null || lon == null || obs == null) continue;
    if (now - obs > maxAgeH * 3600) continue;
    const d = distanceNm(ap.lat, ap.lon, lat, lon);
    if (d > radiusNm) continue;
    const fl = n(r.fltLvl);
    const turb = [layer(r.tbInt1, r.tbType1, r.tbBas1, r.tbTop1, r.tbFreq1), layer(r.tbInt2, r.tbType2, r.tbBas2, r.tbTop2, r.tbFreq2)].filter(Boolean).join('; ');
    const ice = [layer(r.icgInt1, r.icgType1, r.icgBas1, r.icgTop1), layer(r.icgInt2, r.icgType2, r.icgBas2, r.icgTop2)].filter(Boolean).join('; ');
    out.push({
      obsTime: obs, lat, lon, distNm: round(d), bearingDeg: Math.round(bearingDeg(ap.lat, ap.lon, lat, lon)),
      altFt: fl != null ? fl * 100 : null,
      acType: s(r.acType), type: s(r.pirepType) ?? 'PIREP',
      turbulence: turb || null, icing: ice || null, wx: s(r.wxString),
      tempC: n(r.temp), windDirDeg: n(r.wdir), windKt: n(r.wspd),
      raw: s(r.rawOb) ?? '',
    });
  }
  return out.sort((a, b) => b.obsTime - a.obsTime);
}
