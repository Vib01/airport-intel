# airport-intel — live dashboard for St. John's International (CYYT / YYT)

A free ($0 to run) live airport dashboard: scheduled arrivals and departures, live aircraft map,
detected landings and takeoffs, plain-language weather, METAR/TAF, runway wind, PIREPs and SIGMETs.

- **Dashboard:** `https://thevibs.com/airport-intel/`
- **Public display (1920×1080 monitor/TV):** `https://thevibs.com/airport-intel/tv.html`

> **Situational awareness only.** Not an official source and not for flight planning or operational
> decisions. Use NAV CANADA official products and your dispatcher/ATC.

## How it works

```
Cloudflare Worker (free)                    GitHub Pages (free)
  cron every minute → fetch ADS-B,            web/  — static HTML/JS, no build step
  METAR/TAF, PIREPs, SIGMETs, forecast,        polls the Worker's /v1/* JSON every 15–60 s
  routes → derive → D1 database               embeds the Avionio YYT arrivals/departures widget
  /v1/* JSON API (edge-cached)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design and [CLAUDE.md](CLAUDE.md) for the rules.

## Deploy

### 1. Backend (Cloudflare Worker + D1)

```sh
cd worker
npm install
npx wrangler login                               # once, opens the browser
npx wrangler d1 create airport-intel             # copy the database_id into wrangler.toml
npx wrangler d1 migrations apply airport-intel --remote
npx wrangler secret put CONTACT_EMAIL            # sent in the upstream User-Agent
npx wrangler deploy                              # prints https://airport-intel.<you>.workers.dev
```

The cron starts by itself. Within a minute or two every source shows LIVE at `/v1/health`.

### 2. Website (GitHub Pages)

1. Set `API_BASE` in `web/js/config.js` to the Worker URL from step 1.
2. Push to `main`. In the repo: **Settings → Pages → Source: GitHub Actions**.
   `.github/workflows/pages.yml` publishes `web/`.
3. Because the user site uses the `thevibs.com` custom domain, the project is served at
   `https://thevibs.com/airport-intel/`.

Optional CI deploys of the Worker: add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

### 3. Public monitor

Open the display page full screen and keep the screen awake:

```sh
chrome --kiosk https://thevibs.com/airport-intel/tv.html
```

It needs no interaction: data refreshes every 15 s, the flight boards every 5 min, and the page
reloads every 6 h.

## Local development

```sh
cd worker && npm install
npx wrangler d1 migrations apply airport-intel --local
npm run dev          # Worker on http://localhost:8787
npm run dev:cron     # second terminal: fires the cron every minute (wrangler dev doesn't)
npm test             # vitest
cd ../web && python -m http.server 8080          # http://localhost:8080
```

## Free-tier budget

| Resource | Limit (Workers Free) | Use |
|---|---|---|
| Requests | 100,000/day | ~1,440 cron + ~5,760 per always-open screen + visitors |
| D1 rows written | 100,000/day | ~6,000 |
| CPU | 10 ms/invocation | ADS-B parse 1–3 ms, SIGMET filter < 1 ms |

Each always-open screen polls every 15 s (~5,800 requests/day), so roughly 12–15 screens can run
all day within the free limit, with room for visitors.

## Data and credits

Aircraft: adsb.lol (ODbL) / adsb.fi · Routes: adsb.lol standing data (unverified) ·
Weather: aviationweather.gov, Open-Meteo (CC BY 4.0) · Radar: ECCC MSC GeoMet (OGL-Canada) ·
Map: © OpenStreetMap contributors · Scheduled flights: Avionio · Airline names: OpenFlights (ODbL) ·
Runways: OurAirports (verify against the Canada Flight Supplement).
Details and terms: [docs/third-party-terms.md](docs/third-party-terms.md).

Code: MIT — see [LICENSE](LICENSE).
