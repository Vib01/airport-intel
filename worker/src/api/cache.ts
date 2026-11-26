// Edge cache (Cache API) + an in-isolate micro cache. The Cache API is a no-op on *.workers.dev,
// so the in-memory layer is what keeps D1 reads low there.
const mem = new Map<string, { exp: number; body: string }>();

export function json(body: unknown, maxAgeSec: number, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAgeSec}`,
    },
  });
}

export async function cached(
  req: Request, ctx: ExecutionContext, maxAgeSec: number, produce: () => Promise<unknown>,
): Promise<Response> {
  const url = new URL(req.url);
  const key = `${url.pathname}?${[...url.searchParams].sort().map(([k, v]) => `${k}=${v}`).join('&')}`;
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && hit.exp > now) return json(hit.body, maxAgeSec);

  const cacheKey = new Request(`https://cache.airport-intel${key}`);
  let edge: Cache | null = null;
  try { edge = (caches as unknown as { default: Cache }).default; } catch { edge = null; }
  if (edge) {
    const r = await edge.match(cacheKey).catch(() => undefined);
    if (r) return r;
  }

  const body = JSON.stringify(await produce());
  mem.set(key, { exp: now + maxAgeSec * 1000, body });
  if (mem.size > 200) mem.delete(mem.keys().next().value!);
  const res = json(body, maxAgeSec);
  if (edge) ctx.waitUntil(edge.put(cacheKey, res.clone()).catch(() => undefined));
  return res;
}
