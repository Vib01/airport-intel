// Pure: aviationweather.gov PIREP/AIREP JSON → Pirep[] within radius/age of the airport.
//  kind: 'UUA' urgent pilot report, 'UA' routine pilot report, 'AIREP' automated airline position report.
//  turbulence / icing: only actual reports — "NEG" (none) is kept separately in `negative`.
import { AIRPORT, WX } from '../config';
import { bearingDeg, distanceNm, round } from '../lib/geo';
import type { Pirep, PirepKind } from '../types';

type Raw = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
// "NEG", "NEGclr" (negative, clear of cloud), "NIL", "SMTH"… all mean none reported.
const isNeg = (v: string | null) => !!v && /^(NEG|NIL|NONE|SMTH|SMOOTH)/i.test(v);

export function pirepKind(r: Raw): PirepKind {
  const raw = s(r.rawOb) ?? '';
  const type = (s(r.pirepType) ?? '').toUpperCase();
  if (/\bUUA\b/.test(raw) || type.includes('URGENT')) return 'UUA';
  if (type === 'AIREP' || /^ARP\b/.test(raw)) return 'AIREP';
  return 'UA';
}

const fl = (v: number | null) => (v == null ? '?' : `FL${String(v).padStart(3, '0')}`);

function layer(int: unknown, type: unknown, bas: unknown, top: unknown, extra?: unknown): { text: string | null; neg: boolean } {
  const i = s(int);
  if (!i) return { text: null, neg: false };
  if (isNeg(i)) return { text: null, neg: true };
  const b = n(bas), t = n(top);
  const parts = [i, s(type), s(extra)].filter(Boolean).join(' ');
  return { text: parts + (b != null || t != null ? ` ${fl(b)}–${fl(t)}` : ''), neg: false };
}

/** Raw-text fallback for groups AWC did not decode, e.g. "/TB -CHP". */
function rawGroup(raw: string, tag: 'TB' | 'IC'): { text: string | null; neg: boolean } {
  const m = raw.match(new RegExp(`/${tag}\\s+([^/]+)`));
  const v = m?.[1]?.trim() ?? null;
  if (!v) return { text: null, neg: false };
  return isNeg(v.split(/\s+/)[0]) ? { text: null, neg: true } : { text: v, neg: false };
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
    const raw = s(r.rawOb) ?? '';

    const tb = [layer(r.tbInt1, r.tbType1, r.tbBas1, r.tbTop1, r.tbFreq1), layer(r.tbInt2, r.tbType2, r.tbBas2, r.tbTop2, r.tbFreq2)];
    const ic = [layer(r.icgInt1, r.icgType1, r.icgBas1, r.icgTop1), layer(r.icgInt2, r.icgType2, r.icgBas2, r.icgTop2)];
    let turb = tb.map((x) => x.text).filter(Boolean).join('; ') || null;
    let ice = ic.map((x) => x.text).filter(Boolean).join('; ') || null;
    let tbNeg = tb.some((x) => x.neg), icNeg = ic.some((x) => x.neg);
    if (!turb && !tbNeg) { const g = rawGroup(raw, 'TB'); turb = g.text; tbNeg = g.neg; }
    if (!ice && !icNeg) { const g = rawGroup(raw, 'IC'); ice = g.text; icNeg = g.neg; }
    const negative = [tbNeg && !turb ? 'TB NEG' : null, icNeg && !ice ? 'IC NEG' : null].filter(Boolean).join(', ') || null;

    const flv = n(r.fltLvl);
    out.push({
      obsTime: obs, lat, lon, distNm: round(d), bearingDeg: Math.round(bearingDeg(ap.lat, ap.lon, lat, lon)),
      altFt: flv != null ? flv * 100 : null,
      acType: s(r.acType), type: s(r.pirepType) ?? 'PIREP', kind: pirepKind(r),
      turbulence: turb, icing: ice, negative, wx: s(r.wxString),
      tempC: n(r.temp), windDirDeg: n(r.wdir), windKt: n(r.wspd),
      raw,
    });
  }
  return out.sort((a, b) => b.obsTime - a.obsTime);
}
