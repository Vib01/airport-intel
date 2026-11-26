// Advance positions between 60 s updates using ground speed and track (great-circle approximation).
const NM_PER_DEG_LAT = 60;
const MAX_EXTRAPOLATE_S = 90;   // never project further than this past the last fix

/** @returns {[number, number]} lat, lon */
export function deadReckon(a, nowSec) {
  if (a.onGround || a.gsKt == null || a.trackDeg == null || a.gsKt < 30) return [a.lat, a.lon];
  const dt = Math.min(MAX_EXTRAPOLATE_S, Math.max(0, nowSec - a.ts));
  const distNm = (a.gsKt * dt) / 3600;
  const tr = (a.trackDeg * Math.PI) / 180;
  const dLat = (distNm * Math.cos(tr)) / NM_PER_DEG_LAT;
  const dLon = (distNm * Math.sin(tr)) / (NM_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180));
  return [a.lat + dLat, a.lon + dLon];
}

/** Destination point from (lat, lon) along bearing for nm. */
export function destination(lat, lon, bearingDeg, nm) {
  const R = 3440.065, d = nm / R, b = (bearingDeg * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
}
