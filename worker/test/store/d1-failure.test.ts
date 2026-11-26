// Simulated D1 failure: API serves last-good payload + health.db, never throws / 5xx.
import { describe, expect, it } from 'vitest';
import { classifyDbError, getState } from '../../src/store/d1';
import { loadState } from '../../src/api/data';
import { route } from '../../src/api/router';
import type { Env } from '../../src/types';

type Mode = 'ok' | 'error' | 'quota';

function fakeDb(rows: Record<string, unknown>, mode: { m: Mode }): D1Database {
  const fail = () => {
    if (mode.m === 'error') throw new Error('D1_ERROR: network connection lost');
    if (mode.m === 'quota') throw new Error('D1_ERROR: Exceeded daily row read limit');
  };
  const stmt = (sql: string) => ({
    bind: (..._args: unknown[]) => stmt(sql),
    all: async () => {
      fail();
      if (sql.includes('FROM state')) return { results: Object.entries(rows).map(([key, v]) => ({ key, value: JSON.stringify(v), updated_at: 1 })) };
      return { results: [] };
    },
  });
  return { prepare: stmt, batch: async () => { fail(); return []; } } as unknown as D1Database;
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

describe('D1 failure handling', () => {
  it('classifies quota vs generic errors', () => {
    expect(classifyDbError(new Error('Exceeded daily row read limit'))).toBe('quota');
    expect(classifyDbError(new Error('network connection lost'))).toBe('error');
  });

  it('getState returns a Result instead of throwing', async () => {
    const r = await getState(fakeDb({}, { m: 'error' }), ['live']);
    expect(r.ok).toBe(false);
  });

  it('loadState serves last-good after D1 starts failing', async () => {
    const mode = { m: 'ok' as Mode };
    const db = fakeDb({ health: { adsb: { lastOkAt: 5, lastError: null, lastErrorAt: null } } }, mode);
    const first = await loadState(db, ['health']);
    expect(first.db).toBe('ok');
    mode.m = 'quota';
    const second = await loadState(db, ['health']);
    expect(second.db).toBe('quota');
    expect(second.value.health?.value).toEqual({ adsb: { lastOkAt: 5, lastError: null, lastErrorAt: null } });
  });

  it('API answers 200 with health.db = "error" when D1 is down', async () => {
    const env = { DB: fakeDb({}, { m: 'error' }) } as Env;
    const res = await route(new Request('https://x/v1/weather?t=1', { headers: { Origin: 'https://thevibs.com' } }), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://thevibs.com');
    const body = await res.json() as { health: { db: string } };
    expect(body.health.db).toBe('error');
  });

  it('CORS: unknown origins get no allow header; localhost is allowed', async () => {
    const env = { DB: fakeDb({}, { m: 'ok' }) } as Env;
    const evil = await route(new Request('https://x/v1/health?a', { headers: { Origin: 'https://evil.example' } }), env, ctx);
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const local = await route(new Request('https://x/v1/health?b', { headers: { Origin: 'http://localhost:8080' } }), env, ctx);
    expect(local.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8080');
  });
});
