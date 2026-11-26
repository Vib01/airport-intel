// Pure: adsb.lol standing-data route JSON → route codes + airport refs.
import type { AirportRef } from '../types';

type RawAirport = { icao?: string; iata?: string; name?: string; location?: string };
type RawRoute = { callsign?: string; airport_codes?: string; _airports?: RawAirport[] };

/** Route lookup key/path for a callsign, e.g. "ACA694" → "AC/ACA694". null if not lookup-able. */
export function routePath(callsign: string | null): string | null {
  if (!callsign) return null;
  const cs = callsign.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,8}$/.test(cs) || !/[A-Z]/.test(cs.slice(0, 2)) || !/\d/.test(cs)) return null;
  return `${cs.slice(0, 2)}/${cs}`;
}

export function normalizeRoute(raw: unknown): { codes: string[]; airports: AirportRef[] } | null {
  const r = raw as RawRoute;
  if (!r || typeof r.airport_codes !== 'string') return null;
  const codes = r.airport_codes.split('-').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z0-9]{3,4}$/.test(c));
  if (codes.length < 2) return null;
  const airports: AirportRef[] = (r._airports ?? [])
    .filter((a) => typeof a?.icao === 'string')
    .map((a) => ({ icao: a.icao!.toUpperCase(), iata: a.iata || null, name: a.name || null, location: a.location || null }));
  return { codes, airports };
}
