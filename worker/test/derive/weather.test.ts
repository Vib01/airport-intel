import { describe, expect, it } from 'vitest';
import { flightCategory, ceilingFt } from '../../src/derive/flightCategory';
import { densityAltitude } from '../../src/derive/densityAltitude';
import { pressureTrend } from '../../src/derive/pressureTrend';
import { runwayWinds } from '../../src/derive/wind';
import { classifySquawk } from '../../src/derive/squawk';
import { deriveWeather } from '../../src/derive/weather';
import { normalizeMetarList } from '../../src/normalize/metar';
import { RUNWAYS } from '../../src/config';
import { fixture, NULL_RUNWAYS, TEST_RUNWAYS } from '../helpers';

const L = (cover: string, baseFt: number) => ({ cover, baseFt });

describe('flightCategory (FAA)', () => {
  const cat = (clouds: { cover: string; baseFt: number }[], visSm: number | null, vv: number | null = null) =>
    flightCategory({ clouds, vertVisFt: vv, visSm });
  it('boundaries', () => {
    expect(cat([L('OVC', 499)], 10)).toBe('LIFR');
    expect(cat([L('OVC', 500)], 10)).toBe('IFR');
    expect(cat([L('OVC', 999)], 10)).toBe('IFR');
    expect(cat([L('OVC', 1000)], 10)).toBe('MVFR');
    expect(cat([L('BKN', 3000)], 10)).toBe('MVFR');
    expect(cat([L('BKN', 3100)], 10)).toBe('VFR');
    expect(cat([], 0.75)).toBe('LIFR');
    expect(cat([], 1)).toBe('IFR');
    expect(cat([], 2.5)).toBe('IFR');
    expect(cat([], 3)).toBe('MVFR');
    expect(cat([], 5)).toBe('MVFR');
    expect(cat([], 6)).toBe('VFR');
  });
  it('FEW/SCT are not ceilings; VV is', () => {
    expect(ceilingFt([L('FEW', 200), L('SCT', 400), L('BKN', 1200)], null)).toBe(1200);
    expect(cat([L('SCT', 300)], 10)).toBe('VFR');
    expect(cat([], 10, 300)).toBe('LIFR');
  });
  it('no data → null', () => expect(cat([], null)).toBeNull());
});

describe('runwayWinds', () => {
  const wind = (dir: number | null, kt: number | null, gust: number | null = null, vrb = false) =>
    ({ windDirDeg: dir, windKt: kt, gustKt: gust, windVariable: vrb });

  it('reports RUNWAY_CONFIG_MISSING while official headings are null', () => {
    const r = runwayWinds(wind(290, 13), NULL_RUNWAYS);
    expect(r.every((x) => !x.ok && x.reason === 'RUNWAY_CONFIG_MISSING')).toBe(true);
  });

  it('real CYYT fixture (29013G21KT) on configured runways: 28 has the best headwind', () => {
    const m = normalizeMetarList(fixture('metar-cyyt-3h.json'))[0];
    const r = runwayWinds(m, RUNWAYS);
    const byId = Object.fromEntries(r.map((x) => [x.rwy, x]));
    // 290° wind on runway 28 (266° true): θ = 24° → head 11.9 kt, cross 5.3 kt from the right
    expect(byId['28']).toMatchObject({ ok: true, headwindKt: 11.9, crosswindKt: 5.3, side: 'R', gustHeadwindKt: 19.2, gustCrosswindKt: 8.5 });
    expect(byId['10']).toMatchObject({ ok: true, headwindKt: -11.9 });
    // runway 34 (322°): θ = −32° → head 11.0, cross 6.9 from the left
    expect(byId['34']).toMatchObject({ ok: true, headwindKt: 11, crosswindKt: 6.9, side: 'L' });
  });

  it('straight headwind, tailwind and pure crosswind (test headings)', () => {
    const [r11, r29, r16, r34] = runwayWinds(wind(290, 20, 30), TEST_RUNWAYS);
    expect(r29).toMatchObject({ ok: true, headwindKt: 20, crosswindKt: 0, gustHeadwindKt: 30 });
    expect(r11).toMatchObject({ ok: true, headwindKt: -20, crosswindKt: 0 });
    // 290 wind on runway 16 (160°): θ = 130° → head = −12.9, cross = 15.3 from the right
    expect(r16).toMatchObject({ ok: true, headwindKt: -12.9, crosswindKt: 15.3, side: 'R' });
    expect(r34).toMatchObject({ ok: true, headwindKt: 12.9, crosswindKt: 15.3, side: 'L' });
  });

  it('calm / variable / missing', () => {
    expect(runwayWinds(wind(null, 0), TEST_RUNWAYS)[0]).toMatchObject({ ok: false, reason: 'CALM' });
    expect(runwayWinds(wind(null, 4, null, true), TEST_RUNWAYS)[0]).toMatchObject({ ok: false, reason: 'VARIABLE' });
    expect(runwayWinds(null, TEST_RUNWAYS)[0]).toMatchObject({ ok: false, reason: 'NO_WIND' });
  });
});

describe('densityAltitude', () => {
  it('ISA day at sea level ≈ 0', () => {
    expect(densityAltitude(1013.25, 15, 0)).toEqual({ pressureAltFt: 0, densityAltFt: 0, isaTempC: 15 });
  });
  it('CYYT fixture: 1030.9 hPa, 0 °C, 461 ft', () => {
    const d = densityAltitude(1030.9, 0, 461)!;
    expect(d.pressureAltFt).toBe(Math.round(461 + (1013.25 - 1030.9) * 27));   // −16
    expect(d.densityAltFt).toBeLessThan(d.pressureAltFt);                     // cold → lower DA
  });
  it('missing inputs → null', () => expect(densityAltitude(null, 10, 0)).toBeNull());
});

describe('pressureTrend', () => {
  it('real fixture: 1028.9 → 1030.9 over 2 h = RISING', () => {
    const t = pressureTrend(normalizeMetarList(fixture('metar-cyyt-3h.json')))!;
    expect(t.deltaHpa).toBe(2);
    expect(t.trend).toBe('RISING');
    expect(t.spanHours).toBe(2);
  });
  it('steady / falling / insufficient', () => {
    expect(pressureTrend([{ obsTime: 0, altimHpa: 1010 }, { obsTime: 3600, altimHpa: 1010.5 }])!.trend).toBe('STEADY');
    expect(pressureTrend([{ obsTime: 0, altimHpa: 1010 }, { obsTime: 3600, altimHpa: 1008.9 }])!.trend).toBe('FALLING');
    expect(pressureTrend([{ obsTime: 0, altimHpa: 1010 }])).toBeNull();
  });
});

describe('squawk', () => {
  it('special codes only', () => {
    expect(classifySquawk('7700')?.kind).toBe('EMERGENCY');
    expect(classifySquawk('7600')?.kind).toBe('RADIO_FAIL');
    expect(classifySquawk('7500')).toEqual({ kind: 'SPECIAL_7500', label: 'Special code 7500' });
    expect(classifySquawk('1200')).toBeNull();
    expect(classifySquawk(null)).toBeNull();
  });
});

describe('deriveWeather', () => {
  it('combines the derived values and age', () => {
    const hist = normalizeMetarList(fixture('metar-cyyt-3h.json'));
    const d = deriveWeather(hist, hist[0].obsTime + 600, TEST_RUNWAYS, 461)!;
    expect(d.category).toBe('MVFR');
    expect(d.ageMin).toBe(10);
    expect(d.wind).toHaveLength(4);
    expect(d.trend?.trend).toBe('RISING');
    expect(deriveWeather([], 0, TEST_RUNWAYS, 0)).toBeNull();
  });
});
