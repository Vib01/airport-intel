import { HTTP } from '../config';

export function userAgent(contactEmail: string | undefined): string {
  const contact = (contactEmail ?? '').trim();
  return contact ? `${HTTP.userAgentBase}; contact: ${contact})` : `${HTTP.userAgentBase})`;
}

export class HttpError extends Error {
  constructor(message: string, readonly status: number | null) { super(message); }
}

/** Every upstream fetch goes through here: timeout + User-Agent. Throws HttpError on failure. */
export async function fetchJson<T = unknown>(url: string, contactEmail: string | undefined): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HTTP.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': userAgent(contactEmail), Accept: 'application/json' },
    });
    if (!res.ok) throw new HttpError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
    const text = await res.text();
    if (!text.trim()) return [] as unknown as T;   // AWC answers 204/empty when nothing matches
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = (e as Error)?.name === 'AbortError' ? `timeout after ${HTTP.timeoutMs} ms` : String((e as Error)?.message ?? e);
    throw new HttpError(`${msg} (${new URL(url).host})`, null);
  } finally {
    clearTimeout(timer);
  }
}
