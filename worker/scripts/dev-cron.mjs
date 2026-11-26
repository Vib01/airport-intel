// Local only: `wrangler dev` does not fire cron triggers by itself. This hits the test route
// once a minute (aligned to the minute, like the real "* * * * *" trigger) so local data stays live.
// Usage: npm run dev:cron   (with `npm run dev` running in another terminal)
const base = process.env.WORKER_URL ?? 'http://localhost:8787';
const url = `${base}/__scheduled?cron=*+*+*+*+*`;

async function fire() {
  try {
    const r = await fetch(url);
    console.log(new Date().toISOString().slice(11, 19), r.status, (await r.text()).trim());
  } catch (e) {
    console.log(new Date().toISOString().slice(11, 19), 'worker not reachable:', e.message);
  }
}

await fire();
setTimeout(function loop() { fire(); setTimeout(loop, 60_000 - (Date.now() % 60_000) + 500); }, 60_000 - (Date.now() % 60_000) + 500);
