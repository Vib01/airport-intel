// Pure: aviationweather.gov international SIGMET JSON → GeoJSON filtered to a bbox.
// The global feed is ~130 KB; the bbox test runs before any allocation so CPU stays low.
import { WX } from '../config';
import type { SigmetCollection, SigmetFeature } from '../types';

type Pt = { lat?: number; lon?: number };
type Raw = {
  firId?: string; firName?: string; hazard?: string; qualifier?: string | null; base?: number | null; top?: number | null;
  validTimeFrom?: number; validTimeTo?: number; rawSigmet?: string; geom?: string; coords?: Pt[] | Pt[][];
};
type Box = typeof WX.sigmetBox;

const inBox = (p: Pt, b: Box) => p.lat! >= b.minLat && p.lat! <= b.maxLat && p.lon! >= b.minLon && p.lon! <= b.maxLon;

function ringTouches(ring: Pt[], b: Box): boolean {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of ring) {
    if (typeof p?.lat !== 'number' || typeof p?.lon !== 'number') continue;
    if (inBox(p, b)) return true;
    if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon; if (p.lon > maxLon) maxLon = p.lon;
  }
  // polygon bbox overlaps our box (covers the case where a large polygon contains the airport)
  return minLat <= b.maxLat && maxLat >= b.minLat && minLon <= b.maxLon && maxLon >= b.minLon;
}

const toRing = (ring: Pt[]) => {
  const r = ring.filter((p) => typeof p?.lat === 'number' && typeof p?.lon === 'number').map((p) => [p.lon!, p.lat!]);
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]);
  return r;
};

export function filterSigmets(list: unknown, now: number, box: Box = WX.sigmetBox): SigmetCollection {
  const features: SigmetFeature[] = [];
  if (!Array.isArray(list)) return { type: 'FeatureCollection', features };
  for (const s of list as Raw[]) {
    const c = s?.coords;
    if (!Array.isArray(c) || c.length === 0) continue;
    if ((s.validTimeTo ?? Infinity) < now) continue;
    const rings: Pt[][] = Array.isArray(c[0]) ? (c as Pt[][]) : [c as Pt[]];
    if (!rings.some((r) => ringTouches(r, box))) continue;
    const polys = rings.map(toRing).filter((r) => r.length >= 4);
    if (!polys.length) continue;
    features.push({
      type: 'Feature',
      geometry: polys.length === 1 ? { type: 'Polygon', coordinates: [polys[0]] } : { type: 'MultiPolygon', coordinates: polys.map((p) => [p]) },
      properties: {
        fir: s.firName ?? s.firId ?? '', hazard: s.hazard ?? '', qualifier: s.qualifier ?? null,
        baseFt: s.base ?? null, topFt: s.top ?? null,
        validFrom: s.validTimeFrom ?? 0, validTo: s.validTimeTo ?? 0, raw: s.rawSigmet ?? '',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
