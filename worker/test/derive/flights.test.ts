import { describe, expect, it } from 'vitest';
import { buildBoard, callsignsToLookup, legsAt, mergeRoutes } from '../../src/derive/flights';
import { normalizeRoute, routePath } from '../../src/normalize/route';
import { ac, fixture } from '../helpers';
import type { RouteCache } from '../../src/types';

const NOW = 1_795_650_000;
const aca = normalizeRoute(fixture('route-ACA694.json'))!;     // CYYZ-CYYT
const pvl = normalizeRoute(fixture('route-PVL927.json'))!;     // CYYT-CYYR

function cache(): RouteCache {
  return mergeRoutes(null, [
    { callsign: 'ACA694', codes: aca.codes, airports: aca.airports },
    { callsign: 'PVL927', codes: pvl.codes, airports: pvl.airports },
    { callsign: 'MUL1', codes: ['CYHZ', 'CYYT', 'CYQX'], airports: [] },
    { callsign: 'NOROUTE1', codes: null, airports: [] },
  ], NOW - 100, 600);
}

describe('route normalization', () => {
  it('parses real standing-data routes', () => {
    expect(aca.codes).toEqual(['CYYZ', 'CYYT']);
    expect(aca.airports.find((a) => a.icao === 'CYYZ')?.iata).toBe('YYZ');
    expect(pvl.codes).toEqual(['CYYT', 'CYYR']);
    expect(normalizeRoute({})).toBeNull();
  });
  it('lookup paths only for airline-like callsigns', () => {
    expect(routePath('ACA694')).toBe('AC/ACA694');
    expect(routePath('CGILK')).toBeNull();          // registration, no digits
    expect(routePath('12345')).toBeNull();
    expect(routePath(null)).toBeNull();
  });
  it('legsAt', () => {
    expect(legsAt(['CYYZ', 'CYYT'], 'CYYT')).toEqual({ from: 'CYYZ', to: null });
    expect(legsAt(['CYYT', 'CYYR'], 'CYYT')).toEqual({ from: null, to: 'CYYR' });
    expect(legsAt(['CYHZ', 'CYYT', 'CYQX'], 'CYYT')).toEqual({ from: 'CYHZ', to: 'CYQX' });
    expect(legsAt(['KJFK', 'EIDW'], 'CYYT')).toBeNull();
  });
});

describe('buildBoard', () => {
  it('inbound → arrivals with status + ETA; outbound → departures; overflights ignored', () => {
    const b = buildBoard([
      ac({ hex: 'a1', ts: NOW, callsign: 'ACA694', distNm: 20, altFt: 6000, gsKt: 240 }),
      ac({ hex: 'a2', ts: NOW, callsign: 'PVL927', distNm: 15, altFt: 9000, gsKt: 250, airline: 'PVL' }),
      ac({ hex: 'a3', ts: NOW, callsign: 'EIN104', distNm: 40, altFt: 37000 }),
    ], [], cache(), NOW);
    expect(b.arrivals).toHaveLength(1);
    expect(b.arrivals[0]).toMatchObject({ callsign: 'ACA694', status: 'APPROACHING', tracked: true });
    expect(b.arrivals[0].other?.iata).toBe('YYZ');
    expect(b.arrivals[0].etaTs).toBe(NOW + 300);                     // 20 nm at 240 kt = 5 min
    expect(b.departures).toHaveLength(1);
    expect(b.departures[0]).toMatchObject({ callsign: 'PVL927', status: 'DEPARTED' });
    expect(b.departures[0].other?.icao).toBe('CYYR');
  });

  it('statuses: on final, landed, at gate, taxiing', () => {
    const b = buildBoard([
      ac({ hex: 'a1', ts: NOW, callsign: 'ACA694', distNm: 3, altFt: 1400, gsKt: 140 }),
      ac({ hex: 'a2', ts: NOW, callsign: 'PVL927', distNm: 0.4, onGround: true, gsKt: 12 }),
    ], [], cache(), NOW);
    expect(b.arrivals[0].status).toBe('ON_FINAL');
    expect(b.departures[0].status).toBe('TAXIING');
    const landed = buildBoard([ac({ hex: 'a1', ts: NOW, callsign: 'ACA694', distNm: 0.5, onGround: true, gsKt: 0 })],
      [{ kind: 'ARR', callsign: 'ACA694', hex: 'a1', ts: NOW - 120, airline: 'ACA', type: 'A320', reg: null }], cache(), NOW);
    expect(landed.arrivals[0]).toMatchObject({ status: 'LANDED', statusTs: NOW - 120, etaTs: null });
  });

  it('multi-leg via YYT: arrival until a departure is detected after it', () => {
    const plane = ac({ hex: 'm1', ts: NOW, callsign: 'MUL1', distNm: 10, altFt: 4000, gsKt: 200 });
    expect(buildBoard([plane], [], cache(), NOW).arrivals[0].other?.icao).toBe('CYHZ');
    const mv = [
      { kind: 'ARR' as const, callsign: 'MUL1', hex: 'm1', ts: NOW - 3000, airline: null, type: null, reg: null },
      { kind: 'DEP' as const, callsign: 'MUL1', hex: 'm1', ts: NOW - 60, airline: null, type: null, reg: null },
    ];
    expect(buildBoard([plane], mv, cache(), NOW).departures[0].other?.icao).toBe('CYQX');
  });

  it('recent movements of untracked aircraft stay on the board for 3 h', () => {
    const mv = [
      { kind: 'ARR' as const, callsign: 'ACA694', hex: 'a1', ts: NOW - 1800, airline: 'ACA', type: 'A320', reg: null },
      { kind: 'DEP' as const, callsign: 'XYZ1', hex: 'x1', ts: NOW - 4 * 3600, airline: null, type: null, reg: null },
    ];
    const b = buildBoard([], mv, cache(), NOW);
    expect(b.arrivals).toEqual([expect.objectContaining({ callsign: 'ACA694', status: 'LANDED', tracked: false })]);
    expect(b.departures).toHaveLength(0);
  });
});

describe('local traffic and overflights', () => {
  it('helicopter near the airport with no route is local; high jets are overflights', () => {
    const b = buildBoard([
      ac({ hex: 'h1', ts: NOW, callsign: 'CHI62', airline: null, type: 'S92', distNm: 10, altFt: 1725, vsFpm: -500 }),
      ac({ hex: 'j1', ts: NOW, callsign: 'AFR343F', distNm: 7, altFt: 37000 }),
      ac({ hex: 'j2', ts: NOW, callsign: 'UAL30', distNm: 18, altFt: 35000 }),
      ac({ hex: 'g1', ts: NOW, callsign: null, reg: 'C-GABC', distNm: 0.3, onGround: true, gsKt: 0 }),
    ], [], cache(), NOW);
    expect(b.arrivals).toHaveLength(0);
    expect(b.local.map((r) => [r.callsign, r.status])).toEqual([['C-GABC', 'ON_GROUND'], ['CHI62', 'DESCENDING']]);
    expect(b.overflights).toBe(2);
  });

  it('a known non-YYT route flying low nearby is still listed as local (route data can be wrong)', () => {
    const b = buildBoard([ac({ hex: 'x', ts: NOW, callsign: 'EIN104', distNm: 6, altFt: 2500, vsFpm: 0 })],
      [], mergeRoutes(cache(), [{ callsign: 'EIN104', codes: ['KJFK', 'EIDW'], airports: [] }], NOW, 600), NOW);
    expect(b.local[0]).toMatchObject({ callsign: 'EIN104', status: 'LEVEL' });
  });

  it('tracked aircraft with a recent detected departure is listed once, under departures (not local)', () => {
    // Real case 2026-11-26 00:29Z: SPR815 (King Air, no route data) detected DEP/LOW, still climbing nearby.
    const spr = ac({ hex: 'c05af1', ts: NOW, callsign: 'SPR815', airline: null, type: 'B350', distNm: 1.7, altFt: 2350, vsFpm: 1200 });
    const mv = [{ kind: 'DEP' as const, callsign: 'SPR815', hex: 'c05af1', ts: NOW - 60, airline: null, type: 'B350', reg: 'C-GILK' }];
    const b = buildBoard([spr], mv, cache(), NOW);
    expect(b.departures).toEqual([expect.objectContaining({ callsign: 'SPR815', status: 'DEPARTED', tracked: true, statusTs: NOW - 60 })]);
    expect(b.local).toHaveLength(0);
  });

  it('local limits come from config (15 nm, 10,000 ft AGL)', () => {
    const far = buildBoard([ac({ hex: 'f', ts: NOW, callsign: 'GA1', distNm: 16, altFt: 3000 })], [], cache(), NOW);
    const high = buildBoard([ac({ hex: 'h', ts: NOW, callsign: 'GA2', distNm: 5, altFt: 12000 })], [], cache(), NOW);
    expect(far.local).toHaveLength(0);
    expect(high.local).toHaveLength(0);
    expect(far.overflights + high.overflights).toBe(2);
  });
});

describe('route cache', () => {
  it('lookups skip fresh entries and respect miss TTL and the per-tick cap', () => {
    const c = cache();
    const list = [
      ac({ hex: '1', ts: NOW, callsign: 'ACA694', distNm: 5 }),
      ac({ hex: '2', ts: NOW, callsign: 'NOROUTE1', distNm: 6 }),
      ac({ hex: '3', ts: NOW, callsign: 'NEW1', distNm: 7 }),
      ac({ hex: '4', ts: NOW, callsign: 'NEW2', distNm: 8 }),
    ];
    expect(callsignsToLookup(list, c, NOW, 8, 86400, 21600)).toEqual(['NEW1', 'NEW2']);
    expect(callsignsToLookup(list, c, NOW, 1, 86400, 21600)).toEqual(['NEW1']);
    expect(callsignsToLookup(list, c, NOW + 7 * 3600, 8, 86400, 21600)).toEqual(['NOROUTE1', 'NEW1', 'NEW2']);
  });
  it('trims to the newest entries', () => {
    const c = mergeRoutes(cache(), [{ callsign: 'Z1', codes: ['A', 'B'], airports: [] }], NOW, 2);
    expect(Object.keys(c.routes).sort()).toEqual(expect.arrayContaining(['Z1']));
    expect(Object.keys(c.routes)).toHaveLength(2);
  });
});
