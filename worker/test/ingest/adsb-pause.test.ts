// A source that answers 429 (daily quota used) is paused until the next 00:00 UTC and not retried.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAdsb, nextUtcMidnight } from '../../src/ingest/adsb';
import type { Env } from '../../src/types';

const NOW = Date.parse('2026-11-26T08:20:00Z') / 1000;
const env = {} as Env;

afterEach(() => vi.unstubAllGlobals());

describe('ADS-B daily-limit pause', () => {
  it('next reset is 00:00 UTC (20:30 NST)', () => {
    expect(nextUtcMidnight(NOW)).toBe(Date.parse('2026-11-27T00:00:00Z') / 1000);
  });

  it('429 pauses adsb.lol for 30 min; while paused it is not requested at all', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(new URL(u).host);
      return new Response('', { status: new URL(u).host === 'api.adsb.lol' ? 429 : 403 });
    });
    const paused: Record<string, number> = {};
    await expect(fetchAdsb(env, NOW, paused)).rejects.toThrow(/429/);
    expect(paused['adsb.lol']).toBe(NOW + 30 * 60);
    expect(calls).toContain('api.adsb.lol');

    calls.length = 0;
    await expect(fetchAdsb(env, NOW + 180, paused)).rejects.toThrow(/paused/);
    expect(calls).not.toContain('api.adsb.lol');

    calls.length = 0;
    vi.stubGlobal('fetch', async (u: string) => { calls.push(new URL(u).host); return Response.json({ ac: [], now: NOW * 1000 }); });
    const r = await fetchAdsb(env, NOW + 30 * 60 + 1, paused);              // after the back-off
    expect(r.source).toBe('adsb.lol');
  });
});
