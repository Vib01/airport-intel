import { CORS_ORIGINS } from '../config';

export function allowedOrigin(origin: string | null, extra: string | undefined): string | null {
  if (!origin) return null;
  if (CORS_ORIGINS.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  const more = (extra ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return more.includes(origin) ? origin : null;
}

export function withCors(res: Response, origin: string | null): Response {
  const out = new Response(res.body, res);
  if (origin) {
    out.headers.set('Access-Control-Allow-Origin', origin);
    out.headers.set('Vary', 'Origin');
  }
  return out;
}

export function preflight(origin: string | null): Response {
  const h = new Headers({ 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' });
  if (origin) { h.set('Access-Control-Allow-Origin', origin); h.set('Vary', 'Origin'); }
  return new Response(null, { status: 204, headers: h });
}
