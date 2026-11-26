import { describe, expect, it } from 'vitest';
import { normalizeOpenSky } from '../../src/normalize/opensky';
import { fixture } from '../helpers';

describe('normalizeOpenSky (real CYYT response)', () => {
  const raw = fixture<{ time: number }>('opensky-cyyt.json');
  const list = normalizeOpenSky(raw, raw.time);

  it('converts units and fields', () => {
    expect(list).toHaveLength(2);
    const baw = list.find((a) => a.callsign === 'BAW9SW')!;
    expect(baw.hex).toBe('406591');
    expect(baw.airline).toBe('BAW');
    expect(baw.altBaroFt).toBe(35000);                 // 10668 m
    expect(baw.gsKt).toBeCloseTo(572.4, 0);            // 294.47 m/s
    expect(baw.trackDeg).toBe(94.01);
    expect(baw.onGround).toBe(false);
    expect(baw.distNm).toBeLessThan(60);
    const qtr = list.find((a) => a.callsign === 'QTR8102')!;
    expect(qtr.squawk).toBe('1306');
  });

  it('ground, emergency squawk, out-of-radius and empty responses', () => {
    const t = 1_795_682_135;
    const r = normalizeOpenSky({ time: t, states: [
      ['abc123', 'ACA694  ', 'Canada', t, t, -52.75, 47.62, null, true, 3, 280, null, null, null, '7700', false, 0],
      ['def456', 'FAR1    ', 'Canada', t, t, -50.0, 49.5, 9000, false, 200, 90, 0, null, 9100, null, false, 0],
    ] }, t);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ onGround: true, altBaroFt: null, altFt: 461, alert: { kind: 'EMERGENCY' } });
    expect(normalizeOpenSky({ time: t, states: null }, t)).toEqual([]);
  });
});
