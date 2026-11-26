import { describe, expect, it } from 'vitest';
import { normalizePireps } from '../../src/normalize/pirep';
import { windsAloft } from '../../src/derive/windsAloft';
import { filterSigmets } from '../../src/normalize/sigmet';
import { normalizeForecast } from '../../src/normalize/forecast';
import { fixture } from '../helpers';

describe('normalizePireps (real fixture)', () => {
  const raw = fixture<{ obsTime: number }[]>('pirep-cyyt-150nm.json');
  const now = Math.max(...raw.map((r) => r.obsTime));

  it('keeps reports within 150 nm and 3 h, newest first', () => {
    const list = normalizePireps(raw, now);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.distNm <= 150)).toBe(true);
    expect(list.every((p) => now - p.obsTime <= 3 * 3600)).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].obsTime).toBeGreaterThanOrEqual(list[i].obsTime);
    expect(list[0].altFt! % 100).toBe(0);
  });

  it('drops everything when the reports are too old', () => {
    expect(normalizePireps(raw, now + 4 * 3600)).toHaveLength(0);
  });

  it('formats turbulence/icing layers', () => {
    const [p] = normalizePireps([{ lat: 47.7, lon: -52.8, obsTime: 100, fltLvl: 80, tbInt1: 'MOD', tbType1: 'CHOP', tbBas1: 60, tbTop1: 100, icgInt1: 'LGT', icgType1: 'RIME', rawOb: 'UA /OV YYT' }], 100);
    expect(p.turbulence).toBe('MOD CHOP FL060–FL100');
    expect(p.icing).toBe('LGT RIME');
  });
});

describe('PIREP kinds, NEG reports and winds-aloft summary (real mixed fixture)', () => {
  const raw = fixture<{ obsTime: number }[]>('pirep-mixed.json');
  const now = Math.max(...raw.map((r) => r.obsTime));
  // Wide radius: the fixture is a regional sample, not all near CYYT.
  const list = normalizePireps(raw, now, undefined, 5000, 6);
  const byRaw = (prefix: string) => list.find((p) => p.raw.startsWith(prefix))!;

  it('classifies UA vs AIREP from the report', () => {
    expect(byRaw('ELM UA').kind).toBe('UA');
    expect(byRaw('ARP UAL3').kind).toBe('AIREP');
    expect(list.filter((p) => p.kind === 'AIREP')).toHaveLength(4);
  });

  it('decoded turbulence is a hazard; "TB NEG / IC NEG" is not', () => {
    expect(byRaw('ELM UA').turbulence).toBe('LGT-MOD CHOP CONT');
    expect(byRaw('MGJ UA').turbulence).toBe('LGT-MOD CHOP FL220–FL240');
    const neg = byRaw('DPA UA');
    expect(neg.turbulence).toBeNull();
    expect(neg.icing).toBeNull();
    expect(neg.negative).toBe('TB NEG, IC NEG');
  });

  it('falls back to the raw /TB group when AWC did not decode it ("/TB -CHP")', () => {
    expect(byRaw('ORD UA').turbulence).toBe('-CHP');
    expect(byRaw('RFD UA').turbulence).toBeNull();
  });

  it('UUA detection', () => {
    const [u] = normalizePireps([{ lat: 47.7, lon: -52.8, obsTime: 100, rawOb: 'YYT UUA /OV YYT/TM 0100/FL050/TP DH8D/TB SEV', pirepType: 'PIREP' }], 100);
    expect(u.kind).toBe('UUA');
    expect(u.turbulence).toBe('SEV');
  });

  it('winds-aloft summary collapses routine AIREPs only', () => {
    const w = windsAloft(list)!;
    expect(w.count).toBe(4);
    expect(w.minAltFt).toBe(33000);
    expect(w.maxAltFt).toBe(45000);
    expect(w.minKt).toBe(87);
    expect(w.maxKt).toBe(154);
    expect(w.avgDirDeg).toBeGreaterThanOrEqual(280);
    expect(w.avgDirDeg).toBeLessThanOrEqual(290);
    expect(windsAloft(list.filter((p) => p.kind === 'UA'))).toBeNull();
  });

  it('direction is a vector average (350° and 010° → 000°)', () => {
    const mk = (dir: number) => ({ kind: 'AIREP', turbulence: null, icing: null, windDirDeg: dir, windKt: 100, altFt: 35000, tempC: -50, obsTime: 1 }) as never;
    expect(windsAloft([mk(350), mk(10)])!.avgDirDeg).toBe(0);
  });
});

describe('filterSigmets', () => {
  const raw = fixture<unknown[]>('isigmet-global.json');

  it('filters the ~130 KB global feed quickly (CPU budget)', () => {
    const now = 1795645000;
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) filterSigmets(raw, now);
    const ms = (performance.now() - t0) / 20;
    console.log(`SIGMET filter: ${ms.toFixed(2)} ms per run over ${raw.length} SIGMETs (parse excluded)`);
    expect(ms).toBeLessThan(5);
  });

  it('nothing in the fixture is near CYYT; a synthetic Gander SIGMET is kept', () => {
    expect(filterSigmets(raw, 0).features).toHaveLength(0);
    const ganders = [{ firId: 'CZQX', firName: 'CZQX GANDER', hazard: 'TURB', qualifier: 'SEV', base: 20000, top: 38000,
      validTimeFrom: 0, validTimeTo: 9e9, rawSigmet: 'X', geom: 'AREA',
      coords: [{ lat: 48, lon: -55 }, { lat: 48, lon: -50 }, { lat: 46, lon: -50 }, { lat: 46, lon: -55 }] }];
    const fc = filterSigmets(ganders, 100);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.type).toBe('Polygon');
    const ring = fc.features[0].geometry.coordinates[0] as number[][];
    expect(ring[0]).toEqual(ring[ring.length - 1]);          // closed ring
    expect(ring[0]).toEqual([-55, 48]);                      // [lon, lat]
  });

  it('drops expired SIGMETs and handles multi-area geometry', () => {
    const s = { validTimeTo: 50, coords: [{ lat: 47, lon: -52 }, { lat: 48, lon: -52 }, { lat: 48, lon: -51 }] };
    expect(filterSigmets([s], 100).features).toHaveLength(0);
    const multi = { validTimeTo: 999, geom: 'AREAS', coords: [
      [{ lat: 47, lon: -52 }, { lat: 48, lon: -52 }, { lat: 48, lon: -51 }],
      [{ lat: 45, lon: -50 }, { lat: 46, lon: -50 }, { lat: 46, lon: -49 }]] };
    expect(filterSigmets([multi], 100).features[0].geometry.type).toBe('MultiPolygon');
  });
});

describe('normalizeForecast (real Open-Meteo fixture)', () => {
  it('maps hourly arrays with knots and unix times', () => {
    const raw = fixture<{ hourly: { time: number[] } }>('openmeteo-cyyt.json');
    const now = raw.hourly.time[0];
    const fc = normalizeForecast(raw, now, 24);
    expect(fc).toHaveLength(24);
    expect(fc[0].t).toBe(now);
    expect(typeof fc[0].windKt).toBe('number');
    expect(typeof fc[0].tempC).toBe('number');
  });
});
