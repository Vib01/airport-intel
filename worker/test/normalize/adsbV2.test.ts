import { describe, expect, it } from 'vitest';
import { airlineFromCallsign, normalizeAdsbV2, responseTime } from '../../src/normalize/adsbV2';
import { fixture } from '../helpers';

describe('normalizeAdsbV2', () => {
  it('parses a real adsb.lol response (ac[], now in ms)', () => {
    const raw = fixture<{ now: number }>('adsblol-cyyt-60nm.json');
    const list = normalizeAdsbV2(raw, 0);
    expect(list).toHaveLength(2);
    const pvl = list.find((a) => a.hex === 'c028f0')!;
    expect(pvl.callsign).toBe('PVL7678');
    expect(pvl.airline).toBe('PVL');
    expect(pvl.reg).toBe('C-FPNB');
    expect(pvl.altFt).toBe(10500);         // geometric preferred
    expect(pvl.vsFpm).toBe(-1216);
    expect(pvl.distNm).toBeGreaterThan(20);
    expect(pvl.distNm).toBeLessThan(30);
    expect(list[0].distNm).toBeLessThanOrEqual(list[1].distNm);   // sorted by distance
    expect(responseTime(raw, 0)).toBe(Math.floor(raw.now / 1000));
  });

  it('parses a real adsb.fi response (aircraft[] key)', () => {
    const list = normalizeAdsbV2(fixture('adsbfi-cyyt-60nm.json'), 0);
    expect(list.length).toBeGreaterThan(0);
    expect(list.find((a) => a.hex === 'c05af1')?.desc).toMatch(/King Air/);
  });

  it('hides PIA/LADD aircraft, keeps military, drops TIS-B ~ addresses, handles ground', () => {
    const raw = { now: 1_700_000_000, ac: [
      { hex: 'aaaaaa', lat: 47.6, lon: -52.7, alt_baro: 3000, dbFlags: 4 },
      { hex: 'bbbbbb', lat: 47.6, lon: -52.7, alt_baro: 3000, dbFlags: 8 },
      { hex: 'cccccc', lat: 47.6, lon: -52.7, alt_baro: 3000, dbFlags: 1 },
      { hex: '~dddddd', lat: 47.6, lon: -52.7, alt_baro: 3000 },
      { hex: 'eeeeee', lat: 47.62, lon: -52.75, alt_baro: 'ground', squawk: '7700' },
      { hex: 'ffffff', alt_baro: 3000 },
    ] };
    const list = normalizeAdsbV2(raw, 0);
    expect(list.map((a) => a.hex).sort()).toEqual(['cccccc', 'eeeeee']);
    const g = list.find((a) => a.hex === 'eeeeee')!;
    expect(g.onGround).toBe(true);
    expect(g.altBaroFt).toBeNull();
    expect(g.alert?.kind).toBe('EMERGENCY');
    expect(g.ts).toBe(1_700_000_000);
  });

  it('airline only from airline-style callsigns', () => {
    expect(airlineFromCallsign('ACA694')).toBe('ACA');
    expect(airlineFromCallsign('CGILK')).toBeNull();
    expect(airlineFromCallsign('N123AB')).toBeNull();
    expect(airlineFromCallsign(null)).toBeNull();
  });
});
