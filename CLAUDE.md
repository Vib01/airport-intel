# CLAUDE.md — airport-intel

Read ARCHITECTURE.md before any change. It is the source of truth. If a request conflicts
with it, stop and say so instead of improvising.

## Non-negotiables
- **$0 to run.** Never add a paid API, a paid plan, or anything needing a credit card.
  Free-tier keyed APIs are allowed only behind a feature flag, with a quota guard, and with
  the key stored as a Worker secret. If a feature can't be done free, say so.
- **Browsers never call rate-limited upstream APIs.** Only the Worker does. The allowed exceptions are
  embedded board widgets, OSM tiles and ECCC WMS radar tiles.
- **Workers Free limits:** 10 ms CPU/invocation, 50 subrequests, 100k requests/day.
  Never use KV for anything written more than ~30×/day (1k writes/day cap). D1 for state.
- **Embedded widgets:** paste the provider's code unchanged and keep the credit link visible.
  Never read, scrape or restyle iframe contents.
- **Aviation safety:** every view renders `components/disclaimer.js`. Never present derived
  values (runway in use, flight category, movements) as official. Never guess runway headings,
  elevation or reference point. They must come from an official source and be filled in by a human.
- **Secrets and personal data:** never hard-code emails, keys or tokens. Read them from Worker
  vars/secrets (`CONTACT_EMAIL`, `AERODATABOX_KEY`).

## Code rules
- Small single-purpose modules, laid out as in ARCHITECTURE.md §4.1 and §5.
- `normalize/*` and `derive/*` are **pure**: no fetch, no D1, no `Date.now()` (pass `now`).
  Every change needs a vitest case using a committed fixture from `test/fixtures/`.
- All thresholds live in `worker/src/config.ts`. No magic numbers elsewhere.
- Every upstream fetch goes through `lib/http.ts` (8 s timeout, User-Agent built from `CONTACT_EMAIL`).
- API handlers never return 5xx for upstream/DB failures. They return the last good payload plus `health`.
- Worker: TypeScript, zero runtime npm dependencies. Dev deps: wrangler, vitest, typescript.
- Web: vanilla ES modules, no build step, no frameworks. Vendor libs are pinned in `web/vendor/`
  with their LICENSE files: Leaflet (BSD-2) and SunCalc (BSD-2). Charts are hand-rolled SVG.
- Units: store SI/aviation canonical values (kt, ft, hPa, m). Convert only at render time in `lib/units.js`.
- Times: store unix seconds UTC. Render in `America/St_Johns` (UTC−3:30 / −2:30 DST).

## Commands
```
cd worker
npm test                                         # vitest
npx wrangler dev --test-scheduled                # local; trigger cron: curl "localhost:8787/__scheduled?cron=*+*+*+*+*"
npx wrangler d1 migrations apply airport-intel --local
npx wrangler deploy
npx wrangler tail                                # live logs
```
```
cd web && python -m http.server 8080             # set API_BASE in js/config.js to the local worker
```

## Definition of done (every block)
1. `npm test` passes; new pure functions have fixture tests.
2. A local cron run succeeds and the relevant `/v1/*` route returns JSON that matches `types.ts`.
3. The UI panel renders in both normal and STALE states (simulate by killing the source).
4. Note the change in free-tier usage (writes/day, requests/day, CPU) in the commit message.
5. Attribution and disclaimer still visible.
