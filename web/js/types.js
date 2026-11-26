// JSDoc typedefs mirroring worker/src/types.ts. Documentation only — no runtime code.

/** @typedef {[number, number, number|null, number]} TrailPoint  lat, lon, altFt, ts */
/** @typedef {{kind:'EMERGENCY'|'RADIO_FAIL'|'SPECIAL_7500', label:string}|null} SquawkAlert */

/**
 * @typedef {Object} Aircraft
 * @property {string} hex
 * @property {string|null} callsign
 * @property {string|null} reg
 * @property {string|null} type
 * @property {string|null} desc
 * @property {string|null} airline     ICAO prefix
 * @property {number} lat
 * @property {number} lon
 * @property {boolean} onGround
 * @property {number|null} altBaroFt
 * @property {number|null} altGeomFt
 * @property {number|null} altFt
 * @property {number|null} gsKt
 * @property {number|null} trackDeg
 * @property {number|null} vsFpm
 * @property {string|null} squawk
 * @property {SquawkAlert} alert
 * @property {string|null} category
 * @property {number} distNm
 * @property {number} bearingDeg
 * @property {number|null} seenPosSec
 * @property {number} ts
 * @property {TrailPoint[]} [trail]
 */

/**
 * @typedef {Object} Movement
 * @property {number} id
 * @property {'ARR'|'DEP'} kind
 * @property {string} hex
 * @property {string|null} callsign
 * @property {string|null} reg
 * @property {string|null} type
 * @property {string|null} airline
 * @property {string|null} runway
 * @property {number} ts
 * @property {'HIGH'|'LOW'} confidence
 */

/** @typedef {{runway:string|null, count:number, lastSeenAt:number|null, reason?:'NO_RECENT_TRAFFIC'|'RUNWAY_CONFIG_MISSING'}} RunwayInUse */
/** @typedef {{cover:string, baseFt:number|null}} CloudLayer */

/**
 * @typedef {Object} Metar
 * @property {string} raw
 * @property {'METAR'|'SPECI'} type
 * @property {number} obsTime
 * @property {number|null} tempC
 * @property {number|null} dewpC
 * @property {number|null} windDirDeg  TRUE
 * @property {boolean} windVariable
 * @property {number|null} windKt
 * @property {number|null} gustKt
 * @property {number|null} visSm
 * @property {boolean} visPlus
 * @property {number|null} altimHpa
 * @property {CloudLayer[]} clouds
 * @property {number|null} vertVisFt
 * @property {string|null} wx
 * @property {boolean} cavok
 */

/** @typedef {'VFR'|'MVFR'|'IFR'|'LIFR'} FlightCategory */

/**
 * @typedef {{rwy:string, ok:true, headwindKt:number, crosswindKt:number, side:'L'|'R'|null, gustHeadwindKt:number|null, gustCrosswindKt:number|null}
 *   | {rwy:string, ok:false, reason:'CALM'|'VARIABLE'|'NO_WIND'|'RUNWAY_CONFIG_MISSING'}} RunwayWind
 */

/**
 * @typedef {Object} WeatherDerived
 * @property {FlightCategory|null} category
 * @property {'FAA'} categoryConvention
 * @property {RunwayWind[]} wind
 * @property {{pressureAltFt:number, densityAltFt:number, isaTempC:number}|null} da
 * @property {{deltaHpa:number, trend:'RISING'|'FALLING'|'STEADY', spanHours:number}|null} trend
 * @property {number|null} ageMin
 */

/**
 * @typedef {Object} TafPeriod
 * @property {number} from
 * @property {number} to
 * @property {number|null} becomingAt
 * @property {'BASE'|'FM'|'TEMPO'|'BECMG'|'PROB'} change
 * @property {number|null} probability
 * @property {number|null} windDirDeg
 * @property {boolean} windVariable
 * @property {number|null} windKt
 * @property {number|null} gustKt
 * @property {number|null} visSm
 * @property {boolean} visPlus
 * @property {string|null} wx
 * @property {CloudLayer[]} clouds
 * @property {number|null} vertVisFt
 * @property {FlightCategory|null} category
 */

/** @typedef {{t:number, tempC:number|null, popPct:number|null, weatherCode:number|null, windKt:number|null, windDirDeg:number|null, gustKt:number|null, visM:number|null, cloudPct:number|null}} ForecastHour */

/** @typedef {{obsTime:number, lat:number, lon:number, distNm:number, bearingDeg:number, altFt:number|null, acType:string|null, type:string, turbulence:string|null, icing:string|null, wx:string|null, tempC:number|null, windDirDeg:number|null, windKt:number|null, raw:string}} Pirep */

/** @typedef {{lastOkAt:number|null, lastError:string|null, lastErrorAt:number|null, sourceUsed?:string|null, status:'LIVE'|'STALE'|'OFFLINE'}} SourceHealth */
/** @typedef {{now:number, db:'ok'|'error'|'quota', sources:Record<string, SourceHealth>}} HealthReport */

/**
 * @typedef {Object} Meta
 * @property {string} icao
 * @property {string} iata
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {number} elevFt
 * @property {string} tz
 * @property {number} terminalNm
 * @property {number} finalNm
 * @property {{id:string, trueHdg:number|null, lengthFt:number|null}[]} runways
 */

/**
 * @typedef {Object} StatsToday
 * @property {number} dayStart
 * @property {number} arr
 * @property {number} dep
 * @property {number} total
 * @property {{hourTs:number, count:number}|null} busiestHour
 * @property {{key:string, count:number}[]} topAirlines
 * @property {{hourTs:number, arr:number, dep:number}[]} byHour
 */

/**
 * /v1/dashboard
 * @typedef {Object} Dashboard
 * @property {number} now
 * @property {Meta} meta
 * @property {Aircraft[]} aircraft
 * @property {number} aircraftGeneratedAt
 * @property {Movement[]} movements
 * @property {{metar:{raw:string, decoded:Metar}|null, derived:WeatherDerived|null, taf:{raw:string, periods:TafPeriod[], issueTime:number, validFrom:number, validTo:number}|null, forecast:ForecastHour[]}} weather
 * @property {RunwayInUse} runway
 * @property {{today: StatsToday}} stats
 * @property {HealthReport} health
 */

export {};
