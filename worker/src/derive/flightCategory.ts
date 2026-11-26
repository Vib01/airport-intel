// Pure. US FAA convention (Canada does not publish one) — label it as such in the UI.
import { CATEGORY } from '../config';
import type { CloudLayer, FlightCategory } from '../types';

const CEILING_COVERS = new Set(['BKN', 'OVC']);

/** Ceiling = lowest BKN/OVC layer or vertical visibility. null = no ceiling. */
export function ceilingFt(clouds: CloudLayer[], vertVisFt: number | null): number | null {
  let c: number | null = vertVisFt;
  for (const l of clouds) {
    if (CEILING_COVERS.has(l.cover) && l.baseFt != null && (c == null || l.baseFt < c)) c = l.baseFt;
  }
  return c;
}

export function flightCategory(input: {
  clouds: CloudLayer[]; vertVisFt: number | null; visSm: number | null; cavok?: boolean;
}): FlightCategory | null {
  const ceil = ceilingFt(input.clouds, input.vertVisFt);
  const vis = input.cavok ? 6 : input.visSm;
  if (ceil == null && vis == null) return null;
  const c = ceil ?? Infinity, v = vis ?? Infinity;
  if (c < CATEGORY.lifrCeilFt || v < CATEGORY.lifrVisSm) return 'LIFR';
  if (c < CATEGORY.ifrCeilFt || v < CATEGORY.ifrVisSm) return 'IFR';
  if (c <= CATEGORY.mvfrCeilFt || v <= CATEGORY.mvfrVisSm) return 'MVFR';
  return 'VFR';
}
