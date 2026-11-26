# Third-party data and widget terms

Re-check each entry before launch and every 6 months. Record the date you checked.

| Provider | Used for | Terms link | Key rules | Last checked |
|---|---|---|---|---|
| adsb.lol | Aircraft positions (primary) | https://api.adsb.lol/docs | ODbL; attribution; no key today (may require feeding later) | |
| adsb.fi | Aircraft fallback 1 | https://github.com/adsbfi/opendata | Personal non-commercial; attribution + link; 1 req/s | |
| airplanes.live | Aircraft fallback 2 | https://airplanes.live/api-guide | Non-commercial; 1 req/s; no SLA | |
| aviationweather.gov | METAR, TAF, PIREP, SIGMET | https://aviationweather.gov/data/api/ | Public, no key; be polite on rate | |
| Open-Meteo | Forecast | https://open-meteo.com/en/terms | Free non-commercial; attribution | |
| ECCC MSC GeoMet | Radar overlay | https://eccc-msc.github.io/open-data/licence/readme_en/ | Open Government Licence – Canada; attribution | |
| OpenStreetMap | Basemap tiles | https://operations.osmfoundation.org/policies/tiles/ | Attribution; low volume; valid User-Agent/Referer | |
| OpenFlights | Airline names | https://openflights.org/data | ODbL | |
| Airportia | Board widget (default) | https://www.airportia.com/widgets/ | Code unchanged; keep credit link; businesses contact first | |
| Avionio | Board widget (**in use**: YYT arrivals + departures, `web/embeds/avionio-*.html`) | https://www.avionio.com/en/widgets | "Free, without restrictions"; code pasted unchanged from the builder; keep credit links | 2026-11-25 |
| adsb.lol standing data | Callsign → route (origin/destination), cached in the Worker | https://vrs-standing-data.adsb.lol | Static community data, no key; label routes "unverified"; lookups bounded (≤ 8/min, 24 h cache) | 2026-11-25 |
| OurAirports | CYYT runway headings/lengths (owner-approved until CFS verification) | https://ourairports.com/data/ | Public domain | 2026-11-25 |
| PlaneTrack.ai | Board widget (option) | https://planetrack.ai/terms.html | Free; keep PlaneTrack link visible; Airport Module is paid (don't use) | |
| AeroDataBox | Schedules (optional) | https://aerodatabox.com | Free tier quota; no card; key as secret | |
| Leaflet | Map library | https://github.com/Leaflet/Leaflet/blob/main/LICENSE | BSD-2 | |
| SunCalc | Sun times | https://github.com/mourner/suncalc/blob/master/LICENSE | BSD-2 | |
