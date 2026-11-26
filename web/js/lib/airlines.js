// ICAO airline designator → name, from OpenFlights airlines.dat (ODbL), bundled as data/airlines.json.
let map = null;
let loading = null;

export function loadAirlines() {
  if (map) return Promise.resolve(map);
  loading ??= fetch(new URL('../../data/airlines.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((m) => (map = m));
  return loading;
}

export const airlineName = (icao) => (icao && map?.[icao]?.n) || null;
export const airlineIata = (icao) => (icao && map?.[icao]?.i) || null;
