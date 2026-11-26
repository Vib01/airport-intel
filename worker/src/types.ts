// Shared response types. Mirrored as JSDoc typedefs in web/js/types.js.
// Canonical units: kt, ft, hPa, m, statute miles for visibility, unix seconds UTC.

export type Env = {
  DB: D1Database;
  CONTACT_EMAIL?: string;
  FEATURE_SCHEDULE?: string;
  EXTRA_ORIGINS?: string;
  AERODATABOX_KEY?: string;
};

export type TrailPoint = [lat: number, lon: number, altFt: number | null, ts: number];

export type SquawkAlert = { kind: 'EMERGENCY' | 'RADIO_FAIL' | 'SPECIAL_7500'; label: string } | null;

export type Aircraft = {
  hex: string;
  callsign: string | null;
  reg: string | null;
  type: string | null;
  desc: string | null;
  airline: string | null;        // ICAO 3-letter prefix from callsign, if it looks like one
  lat: number;
  lon: number;
  onGround: boolean;
  altBaroFt: number | null;      // pressure altitude (null on ground)
  altGeomFt: number | null;
  altFt: number | null;          // best altitude estimate (geom preferred)
  gsKt: number | null;
  trackDeg: number | null;
  vsFpm: number | null;
  squawk: string | null;
  alert: SquawkAlert;
  category: string | null;
  distNm: number;                // from airport reference point
  bearingDeg: number;            // from airport reference point
  seenPosSec: number | null;
  ts: number;                    // position time (unix s)
  trail?: TrailPoint[];
};

export type MovementKind = 'ARR' | 'DEP';
export type Confidence = 'HIGH' | 'LOW';

export type MovementEvent = {
  kind: MovementKind;
  hex: string;
  callsign: string | null;
  reg: string | null;
  type: string | null;
  airline: string | null;
  runway: string | null;
  ts: number;
  confidence: Confidence;
};

export type Movement = MovementEvent & { id: number };

export type TrackSample = {
  ts: number;
  lat: number; lon: number;
  onGround: boolean;
  aglFt: number | null;
  vsFpm: number | null;
  trackDeg: number | null;
  distNm: number;
};

export type Track = {
  hex: string;
  callsign: string | null; reg: string | null; type: string | null; airline: string | null;
  firstSeen: number;
  last: TrackSample;
  lastAirborne: TrackSample | null;   // most recent airborne sample (for runway on landing)
  trail: TrailPoint[];
};

export type FinalObs = { hex: string; rwy: string; ts: number };

export type TrackState = {
  v: 1;
  updatedAt: number;
  tracks: Record<string, Track>;
  recent: Record<string, number>;    // `${hex}:${kind}` → event ts (dedupe)
  finals: FinalObs[];                 // runway alignment observations, last 20 min
  hourMax: { hourTs: number; max: number }[];   // last ~3 hours, for stats rollup
};

export type RunwayInUse = {
  runway: string | null;
  count: number;
  lastSeenAt: number | null;
  reason?: 'NO_RECENT_TRAFFIC' | 'RUNWAY_CONFIG_MISSING';
};

export type AirportRef = { icao: string; iata: string | null; name: string | null; location: string | null };
export type RouteEntry = { codes: string[]; ts: number } | { miss: true; ts: number };
/** state['routes']: compact cache. */
export type RouteCache = { v: 1; routes: Record<string, RouteEntry>; airports: Record<string, AirportRef> };

export type FlightStatus = 'EN_ROUTE' | 'APPROACHING' | 'ON_FINAL' | 'LANDED' | 'AT_GATE' | 'TAXIING' | 'DEPARTED'
  | 'ON_GROUND' | 'CLIMBING' | 'DESCENDING' | 'LEVEL';   // last four: local traffic without a YYT route
export type FlightRow = {
  callsign: string; hex: string | null; airline: string | null; type: string | null; reg: string | null;
  other: AirportRef | null;           // origin for arrivals, destination for departures
  status: FlightStatus;
  statusTs: number | null;            // landed / departed time (detected) when known
  etaTs: number | null;               // naive estimate: distance / ground speed
  distNm: number | null; altFt: number | null; gsKt: number | null;
  tracked: boolean;                   // currently in ADS-B coverage
};
export type FlightBoard = {
  arrivals: FlightRow[]; departures: FlightRow[];
  local: FlightRow[];                 // near the airport, low, no YYT route (helicopters, GA, unknown)
  overflights: number;                // tracked aircraft that are neither of the above
  routeSource: string;
};

export type CloudLayer = { cover: string; baseFt: number | null };

export type Metar = {
  raw: string;
  type: 'METAR' | 'SPECI';
  obsTime: number;
  tempC: number | null;
  dewpC: number | null;
  windDirDeg: number | null;     // TRUE; null when variable or calm
  windVariable: boolean;
  windKt: number | null;
  gustKt: number | null;
  visSm: number | null;
  visPlus: boolean;              // "10+" style
  altimHpa: number | null;
  clouds: CloudLayer[];
  vertVisFt: number | null;
  wx: string | null;
  cavok: boolean;
};

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export type RunwayWind =
  | { rwy: string; ok: true; headwindKt: number; crosswindKt: number; side: 'L' | 'R' | null;
      gustHeadwindKt: number | null; gustCrosswindKt: number | null }
  | { rwy: string; ok: false; reason: 'CALM' | 'VARIABLE' | 'NO_WIND' | 'RUNWAY_CONFIG_MISSING' };

export type DensityAltitude = { pressureAltFt: number; densityAltFt: number; isaTempC: number } | null;

export type PressureTrend = { deltaHpa: number; trend: 'RISING' | 'FALLING' | 'STEADY'; spanHours: number } | null;

export type TafChange = 'BASE' | 'FM' | 'TEMPO' | 'BECMG' | 'PROB';

export type TafPeriod = {
  from: number; to: number; becomingAt: number | null;
  change: TafChange; probability: number | null;
  windDirDeg: number | null; windVariable: boolean; windKt: number | null; gustKt: number | null;
  visSm: number | null; visPlus: boolean;
  wx: string | null; clouds: CloudLayer[]; vertVisFt: number | null;
  category: FlightCategory | null;
};

export type Taf = { raw: string; issueTime: number; validFrom: number; validTo: number; periods: TafPeriod[] };

export type ForecastHour = {
  t: number; tempC: number | null; popPct: number | null; weatherCode: number | null;
  windKt: number | null; windDirDeg: number | null; gustKt: number | null; visM: number | null; cloudPct: number | null;
};

export type PirepKind = 'UUA' | 'UA' | 'AIREP';
export type Pirep = {
  obsTime: number; lat: number; lon: number; distNm: number; bearingDeg: number;
  altFt: number | null; acType: string | null; type: string; kind: PirepKind;
  turbulence: string | null; icing: string | null;   // actual reports only
  negative: string | null;                           // e.g. "TB NEG, IC NEG" (pilot reported none)
  wx: string | null;
  tempC: number | null; windDirDeg: number | null; windKt: number | null;
  raw: string;
};

export type SigmetFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
  properties: {
    fir: string; hazard: string; qualifier: string | null;
    baseFt: number | null; topFt: number | null; validFrom: number; validTo: number; raw: string;
  };
};
export type SigmetCollection = { type: 'FeatureCollection'; features: SigmetFeature[] };

export type WeatherDerived = {
  category: FlightCategory | null;
  categoryConvention: 'FAA';
  wind: RunwayWind[];
  da: DensityAltitude;
  trend: PressureTrend;
  ageMin: number | null;
};

export type SourceHealth = { lastOkAt: number | null; lastError: string | null; lastErrorAt: number | null; sourceUsed?: string | null };
export type HealthState = Record<string, SourceHealth>;
export type SourceStatus = 'LIVE' | 'STALE' | 'OFFLINE';
export type DbStatus = 'ok' | 'error' | 'quota';
export type HealthReport = {
  now: number;
  db: DbStatus;
  sources: Record<string, SourceHealth & { status: SourceStatus }>;
};

export type StatsToday = {
  dayStart: number;
  arr: number; dep: number; total: number;
  busiestHour: { hourTs: number; count: number } | null;
  topAirlines: { key: string; count: number }[];
  byHour: { hourTs: number; arr: number; dep: number }[];
};

export type StatsHourlyRow = {
  hour_ts: number; arr: number; dep: number;
  by_airline: Record<string, number>; by_type: Record<string, number>; by_runway: Record<string, number>;
  max_aircraft_seen: number;
};

export type StatsDay = { day: string; dayStart: number; arr: number; dep: number; total: number };

export type StatsResponse = {
  now: number;
  today: StatsToday;
  hourly: { hourTs: number; arr: number; dep: number; maxAircraft: number }[];
  days: StatsDay[];
  avgDaily: number | null;
  topAirlines: { key: string; count: number }[];
  topTypes: { key: string; count: number }[];
  runwayShare: { key: string; count: number }[];
  health: HealthReport;
};

export type LiveState = { generatedAt: number; source: string | null; aircraft: Aircraft[]; runway: RunwayInUse };

export type WeatherResponse = {
  now: number;
  metar: { raw: string; decoded: Metar } | null;
  derived: WeatherDerived | null;
  taf: { raw: string; periods: TafPeriod[]; issueTime: number; validFrom: number; validTo: number } | null;
  forecast: ForecastHour[];
  health: HealthReport;
};
