# Build prompts — paste one per Claude Code session, in order

Run each block in a **fresh session** from the repo root. Commit after each block once
the Definition of Done in CLAUDE.md passes. Don't start the next block until the current one is deployed.

---

### Block 0: Repo scaffold (you, ~10 min, no Claude Code)
1. Create public GitHub repo `airport-intel`. Add `ARCHITECTURE.md`, `CLAUDE.md`, `BUILD_PROMPTS.md`, `docs/third-party-terms.md`, MIT `LICENSE`.
2. Free Cloudflare account (no card). `npm i -g wrangler && wrangler login`.
3. Look up CYYT runway **true** headings, lengths, ARP and elevation in the Canada Flight Supplement
   (NAV CANADA). Note them down. You will paste them in Block 6.

---

### Block 1: Worker skeleton + ADS-B ingest
```
Read ARCHITECTURE.md and CLAUDE.md. Build Block 1 only:
- worker/ with wrangler.toml (name airport-intel, one cron "* * * * *", vars CONTACT_EMAIL placeholder, FEATURE_SCHEDULE="false")
- src/index.ts, src/config.ts (AIRPORT, DETECT, PRIVACY, FEATURES exactly as spec; RUNWAYS with nulls)
- src/lib/http.ts, src/lib/geo.ts
- src/ingest/adsb.ts with fallback adsb.lol → adsb.fi → airplanes.live
- src/normalize/adsbV2.ts → Aircraft[] (types in src/types.ts), applying PRIVACY.hideDbFlags
- GET /v1/aircraft returning live data directly (no DB yet), CORS per spec
- vitest + one fixture recorded from a real adsb.lol response for CYYT, 60 nm
Do not build anything from later blocks.
```

### Block 2: D1 state, cron, health, edge cache
```
Build Block 2: migrations/0001_init.sql, src/store/d1.ts (Result-returning, never throws),
src/jobs/dispatch.ts with run() wrapper recording health, cron writes state['live'],
/v1/aircraft now reads D1 through api/cache.ts (15 s), add /v1/health.
Simulate a D1 failure in a test and confirm the API serves last-good + health.db.
```

### Block 3: Trails + movements detector (record data first!)
```
Before coding: I have recorded fixtures in test/fixtures/session-*.json (sequences of minute snapshots).
Build Block 3: derive/trails.ts and derive/movements.ts as pure functions per ARCHITECTURE §4.4,
state['tracks'] blob, movements table inserts, /v1/movements. Fixture-driven tests for each rule
(ARR HIGH/LOW, DEP HIGH/LOW, dedupe, track loss). Report detected movements per fixture.
```
> To record fixtures, deploy Block 2 and save `/v1/aircraft` every minute for 2–3 hours during a busy period:
> `while true; do curl -s $API/v1/aircraft > fixtures/session-$(date +%s).json; sleep 60; done`

### Block 4: METAR, TAF, forecast + weather derivations
```
Build Block 4: ingest/metar.ts (3 h history), ingest/taf.ts, ingest/forecast.ts,
normalize/metar.ts and normalize/taf.ts with unit normalization,
derive/flightCategory.ts, derive/densityAltitude.ts, derive/pressureTrend.ts,
derive/wind.ts (must return a clear error while RUNWAYS headings are null),
/v1/weather. Tests with real CYYT METAR/TAF fixtures, including gusts, VRB wind, calm, VV, CAVOK-style edge cases.
```

### Block 5: Pilot data — PIREP, SIGMET, runway in use
```
Build Block 5: ingest/pirep.ts, ingest/sigmet.ts (bbox filter early, measure CPU with a
large fixture and report ms), derive/runwayInUse.ts, derive/squawk.ts, /v1/pilot.
If SIGMET parse exceeds ~5 ms on the fixture, set cadence to 30 min and say so.
```

### Block 6: Runway config (you + Claude Code)
```
Fill RUNWAYS in src/config.ts with these official values: <paste from Canada Flight Supplement>.
Also confirm AIRPORT lat/lon/elevFt against them. Make derive/wind.test.ts pass with real
CYYT METAR fixtures. Show me a table of head/crosswind for each fixture so I can sanity-check it.
```

### Block 7: Stats rollups
```
Build Block 7: migrations/0002_stats.sql, derive/stats.ts, hourly rollup job, prune job,
/v1/stats?days=7 and the today summary inside /v1/dashboard. Tests from movement fixtures.
```

### Block 8: Web shell + public view
```
Build Block 8 in web/: index.html shell, router.js, state.js, api.js (timeout, last-good, staleness),
config.js, status-pill, disclaimer, attribution, board-embed (BOARD_PROVIDER switch, placeholder
comments where I paste builder code UNCHANGED), movements-table, weather-card (plain-language
sentence + 24 h strip), sun-times (vendored SunCalc). Public view per ARCHITECTURE §5.1.
Dark/light via prefers-color-scheme. No frameworks, no build step.
```
> After this block, generate the YYT widget code at airportia.com/widgets and paste it unchanged.

### Block 9: Map + flight track
```
Build Block 9: vendored Leaflet, components/aircraft-map.js (rotated icons, altitude colors,
labels, trails, range rings 5/10/25/50 nm, extended centerlines from RUNWAYS),
lib/deadReckon.js, components/aircraft-detail.js, #/map view, mini map on the public view.
Squawk highlights per derive/squawk semantics. Test with 40 aircraft for smoothness.
```

### Block 10: Pilot view + overlays
```
Build Block 10: #/pilot with metar-panel, taf-timeline, wind-runways diagram (SVG),
da-panel, runway-in-use, pirep-list, overlays.js (SIGMET polygons, PIREP markers,
ECCC GeoMet radar WMS behind FEATURES.radar). First run a GetCapabilities request and confirm the radar layer name.
Add NAV CANADA links for NOTAM/GFA. Aviation units throughout.
```

### Block 11: Stats view + TV view
```
Build Block 11: #/stats with hand-rolled SVG charts (by hour, ARR vs DEP, top airlines/types,
runway share). tv.html fixed 1920×1080 grid per ARCHITECTURE §5.1, 6-h reload, no interaction.
Screenshot tv.html at 1920×1080 and check nothing overflows.
```

### Block 12: CI/CD + docs
```
Build Block 12: .github/workflows/worker.yml and pages.yml per ARCHITECTURE §7, README with
setup steps, docs/third-party-terms.md completed with each provider's terms link and today's date,
attribution footer audit. Do not commit secrets.
```

### Block 13 (optional): Schedule matching
```
Build Block 13 behind FEATURE_SCHEDULE: migrations/0003_schedule.sql, ingest/schedule.ts
(AeroDataBox FIDS, quota guard ≤ 95%, adaptive interval), derive/match.ts
(deriveStatus: SCHEDULED/LATE/DEPARTED/LANDED/NOT_OBSERVED/CANCELLED), callsign override table.
Show delay columns in movements-table only when the flag is on.
```
