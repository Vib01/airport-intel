import { describe, expect, it } from 'vitest';
import { normalizeMetar, normalizeMetarList } from '../../src/normalize/metar';
import { flightCategory } from '../../src/derive/flightCategory';
import { fixture } from '../helpers';

describe('normalizeMetar (real CYYT fixture)', () => {
  const hist = normalizeMetarList(fixture('metar-cyyt-3h.json'));

  it('orders newest first and keeps SPECI', () => {
    expect(hist.length).toBe(4);
    expect(hist[0].obsTime).toBeGreaterThan(hist[1].obsTime);
    expect(hist.some((m) => m.type === 'SPECI')).toBe(true);
  });

  it('decodes wind with gusts, vis, altimeter (hPa), cloud', () => {
    const m = hist[0];
    expect(m.raw).toContain('29013G21KT');
    expect(m.windDirDeg).toBe(290);
    expect(m.windKt).toBe(13);
    expect(m.gustKt).toBe(21);
    expect(m.visSm).toBe(15);
    expect(m.altimHpa).toBeCloseTo(1030.9, 1);
    expect(m.clouds).toEqual([{ cover: 'BKN', baseFt: 2600 }]);
    expect(flightCategory(m)).toBe('MVFR');   // BKN026 → ceiling 2600
  });
});

describe('normalizeMetar edge cases', () => {
  const base = { rawOb: 'METAR CYYT 010000Z', obsTime: 1000 };

  it('VRB wind → variable, no direction', () => {
    const m = normalizeMetar({ ...base, wdir: 'VRB', wspd: 3 })!;
    expect(m.windVariable).toBe(true);
    expect(m.windDirDeg).toBeNull();
    expect(m.windKt).toBe(3);
  });

  it('calm → 0 kt, no direction', () => {
    const m = normalizeMetar({ ...base, wdir: 0, wspd: 0 })!;
    expect(m.windKt).toBe(0);
    expect(m.windDirDeg).toBeNull();
  });

  it('vertical visibility (AWC "OVX") is a ceiling', () => {
    const m = normalizeMetar({ ...base, visib: 0.25, clouds: [{ cover: 'OVX', base: 100 }] })!;
    expect(m.vertVisFt).toBe(100);
    expect(m.clouds).toEqual([]);
    expect(flightCategory(m)).toBe('LIFR');
  });

  it('CAVOK and "6+" visibility', () => {
    const m = normalizeMetar({ ...base, rawOb: 'METAR XXXX 010000Z 27005KT CAVOK 10/05 Q1020', visib: '6+', clouds: [{ cover: 'CAVOK' }] })!;
    expect(m.cavok).toBe(true);
    expect(m.visSm).toBe(6);
    expect(m.visPlus).toBe(true);
    expect(flightCategory(m)).toBe('VFR');
  });

  it('altimeter in inHg is converted to hPa', () => {
    const m = normalizeMetar({ ...base, altim: 29.92 })!;
    expect(m.altimHpa).toBeCloseTo(1013.2, 1);
  });

  it('rejects records without raw text or time', () => {
    expect(normalizeMetar({ obsTime: 1 })).toBeNull();
    expect(normalizeMetar({ rawOb: 'X' })).toBeNull();
  });
});
