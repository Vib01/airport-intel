// Canonical values arrive as kt, ft, hPa, SM, m. Convert only here, at render time.
import { storage } from './dom.js';

export const ktToKmh = (kt) => kt * 1.852;
export const smToKm = (sm) => sm * 1.609344;
export const ftToM = (ft) => ft * 0.3048;
export const hpaToInHg = (h) => h / 33.8639;
export const mToSm = (m) => m / 1609.344;

const r = (n, dp = 0) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** dp) / 10 ** dp);

/** Public-page unit mode: 'metric' (default) or 'aviation'. Persisted per viewer. */
let mode = storage.get('units', 'metric') === 'aviation' ? 'aviation' : 'metric';
const listeners = new Set();
export const unitMode = () => mode;
export function setUnitMode(m) { mode = m; storage.set('units', m); listeners.forEach((f) => f(m)); }
export const onUnitMode = (f) => { listeners.add(f); return () => listeners.delete(f); };

export const fmt = {
  wind(kt, m = mode) {
    if (kt == null) return '—';
    return m === 'aviation' ? `${r(kt)} kt` : `${r(ktToKmh(kt))} km/h`;
  },
  visSm(sm, plus = false, m = mode) {
    if (sm == null) return '—';
    if (m === 'aviation') return `${plus ? '≥ ' : ''}${r(sm, sm < 3 ? 2 : 0)} SM`;
    const km = smToKm(sm);
    return `${plus ? '≥ ' : ''}${km >= 10 ? r(km) : r(km, 1)} km`;
  },
  visM(meters, m = mode) {
    if (meters == null) return '—';
    if (m === 'aviation') { const sm = mToSm(meters); return `${r(sm, sm < 3 ? 1 : 0)} SM`; }
    return meters >= 10000 ? `${r(meters / 1000)} km` : `${r(meters / 1000, 1)} km`;
  },
  alt(ft, m = 'aviation') {
    if (ft == null) return '—';
    if (m === 'metric') return `${r(ftToM(ft)).toLocaleString()} m`;
    return `${r(ft).toLocaleString()} ft`;
  },
  flAlt(ft) {
    if (ft == null) return '—';
    return ft >= 18000 ? `FL${String(Math.round(ft / 100)).padStart(3, '0')}` : `${(Math.round(ft / 100) * 100).toLocaleString()} ft`;
  },
  temp: (c) => (c == null ? '—' : `${r(c)}°C`),
  hpa: (h) => (h == null ? '—' : `${r(h, 1)} hPa`),
  inHg: (h) => (h == null ? '—' : `${r(hpaToInHg(h), 2).toFixed(2)} inHg`),
  dir: (d) => (d == null ? '—' : `${String(Math.round(d) % 360).padStart(3, '0')}°`),
  pct: (p) => (p == null ? '—' : `${r(p)}%`),
  num: r,
};

const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
  'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
const COMPASS8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const compassAbbr = (deg) => (deg == null ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]);
export const compassWord = (deg, fine = false) =>
  deg == null ? null : fine ? COMPASS[Math.round(deg / 22.5) % 16] : COMPASS8[Math.round(deg / 45) % 8];
