import { WX } from '../config';

export const inHgToHpa = (inHg: number) => inHg * WX.inHgToHpa;

/** Altimeter values below 40 are inches of mercury; otherwise hectopascals. */
export function altimToHpa(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v < 40 ? Math.round(inHgToHpa(v) * 10) / 10 : v;
}

/** AWC visibility: number (SM) or strings like "10+", "6+", "1/2". */
export function parseVisSm(v: unknown): { visSm: number | null; visPlus: boolean } {
  if (v == null || v === '') return { visSm: null, visPlus: false };
  if (typeof v === 'number') return { visSm: v, visPlus: false };
  const s = String(v).trim();
  const plus = s.endsWith('+');
  const body = plus ? s.slice(0, -1) : s.startsWith('P') ? s.slice(1) : s;
  let n: number | null = null;
  const m = body.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) n = +m[1] + +m[2] / +m[3];
  else if (/^\d+\/\d+$/.test(body)) { const [a, b] = body.split('/'); n = +a / +b; }
  else if (Number.isFinite(parseFloat(body))) n = parseFloat(body);
  return { visSm: n, visPlus: plus || s.startsWith('P') };
}
