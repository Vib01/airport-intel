// Synthetic minute-by-minute sequences per detector rule. Replace/extend with recorded
// session-*.json fixtures once the deployed worker has logged a busy period (BUILD_PROMPTS Block 3).
import { describe, expect, it } from 'vitest';
import { detectMovements, emptyTrackState } from '../../src/derive/movements';
import { appendTrail } from '../../src/derive/trails';
import { mergeFinals, observeFinals, runwayInUse, matchRunway } from '../../src/derive/runwayInUse';
import { DETECT } from '../../src/config';
import { ac, NULL_RUNWAYS, TEST_RUNWAYS } from '../helpers';
import type { Aircraft, MovementEvent, TrackState } from '../../src/types';

const T0 = 1_795_600_000;
const ELEV = 461;

/** Feed snapshots (one per minute) through the detector; returns all events + final state. */
function run(snapshots: Aircraft[][], start = T0, runways = TEST_RUNWAYS) {
  let state: TrackState = emptyTrackState(start);
  const events: MovementEvent[] = [];
  snapshots.forEach((snap, i) => {
    const r = detectMovements(state, snap, start + i * 60, runways);
    state = r.state;
    events.push(...r.events);
  });
  return { state, events };
}

const air = (i: number, p: Partial<Aircraft> = {}) => ac({ hex: 'c0ffee', ts: T0 + i * 60, ...p });
const gnd = (i: number, p: Partial<Aircraft> = {}) =>
  ac({ hex: 'c0ffee', ts: T0 + i * 60, onGround: true, altBaroFt: null, altFt: ELEV, vsFpm: 0, gsKt: 10, distNm: 0.5, ...p });

describe('detectMovements', () => {
  it('ARR/HIGH: airborne inside terminal area, then ground', () => {
    const { events } = run([
      [air(0, { distNm: 6, altFt: 2200, vsFpm: -700, trackDeg: 292 })],
      [air(1, { distNm: 3, altFt: 1300, vsFpm: -700, trackDeg: 289 })],
      [gnd(2)],
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'ARR', confidence: 'HIGH', hex: 'c0ffee', runway: '29', callsign: 'ACA123', airline: 'ACA' });
    expect(events[0].ts).toBe(T0 + 120);
  });

  it('ARR/HIGH not emitted when the airborne sample was outside the terminal area', () => {
    const { events } = run([[air(0, { distNm: 20, altFt: 5000 })], [gnd(1)]]);
    expect(events).toHaveLength(0);
  });

  it('DEP/HIGH: ground → airborne inside terminal area', () => {
    const { events } = run([[gnd(0)], [gnd(1)], [air(2, { distNm: 2, altFt: 1400, vsFpm: 1800, trackDeg: 112 })]]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'DEP', confidence: 'HIGH', runway: '11' });
  });

  it('DEP/LOW: first seen low and climbing inside terminal area', () => {
    const { events } = run([[air(0, { distNm: 3, altFt: 1600, vsFpm: 1500, trackDeg: 160 })]]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'DEP', confidence: 'LOW', runway: '16' });
  });

  it('DEP/LOW not emitted for a first sighting that is high, level, or outside', () => {
    expect(run([[air(0, { distNm: 3, altFt: 5000, vsFpm: 1500 })]]).events).toHaveLength(0);
    expect(run([[air(0, { distNm: 3, altFt: 1600, vsFpm: 0 })]]).events).toHaveLength(0);
    expect(run([[air(0, { distNm: 15, altFt: 1600, vsFpm: 1500 })]]).events).toHaveLength(0);
  });

  it('ARR/LOW: low, descending, inside terminal area, then lost for lostAfterSec', () => {
    const lostMinutes = Math.ceil(DETECT.lostAfterSec / 60);
    const snaps: Aircraft[][] = [
      [air(0, { distNm: 7, altFt: 2600, vsFpm: -800, trackDeg: 340 })],
      [air(1, { distNm: 4, altFt: 1500, vsFpm: -700, trackDeg: 341 })],
    ];
    for (let i = 0; i < lostMinutes; i++) snaps.push([]);
    const { events, state } = run(snaps);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'ARR', confidence: 'LOW', runway: '34' });
    expect(events[0].ts).toBe(T0 + 60);                // time of last sighting
    expect(state.tracks.c0ffee).toBeUndefined();      // dropped after loss
  });

  it('track loss shorter than lostAfterSec keeps the track and emits nothing', () => {
    const { events, state } = run([[air(0, { distNm: 4, altFt: 1500, vsFpm: -700 })], []]);
    expect(events).toHaveLength(0);
    expect(state.tracks.c0ffee).toBeDefined();
  });

  it('lost while climbing or high is not an arrival', () => {
    const snaps: Aircraft[][] = [[air(0, { distNm: 4, altFt: 1500, vsFpm: 900 })], [], [], [], []];
    expect(run(snaps).events.filter((e) => e.kind === 'ARR')).toHaveLength(0);
  });

  it('dedupes (hex, kind) within dedupeSec, e.g. a ground bounce', () => {
    const { events } = run([
      [air(0, { distNm: 3, altFt: 900, vsFpm: -600 })],
      [gnd(1)],
      [air(2, { distNm: 1, altFt: 600, vsFpm: 100 })],
      [gnd(3)],
    ]);
    expect(events.filter((e) => e.kind === 'ARR')).toHaveLength(1);
  });

  it('runway is null when headings are not configured (no guessing)', () => {
    const { events } = run([[air(0, { distNm: 3, altFt: 1600, vsFpm: 1500, trackDeg: 290 })]], T0, NULL_RUNWAYS);
    expect(events[0].runway).toBeNull();
  });

  it('records per-hour max aircraft count', () => {
    const snap = [air(0, { hex: 'aaaaaa', distNm: 30 }), air(0, { hex: 'bbbbbb', distNm: 40 })];
    const { state } = run([snap, [snap[0]]]);
    expect(state.hourMax.at(-1)?.max).toBe(2);
  });
});

describe('trails', () => {
  it('trims to trailMinutes and trailMaxPts, skips duplicate positions', () => {
    let t: [number, number, number | null, number][] = [];
    for (let i = 0; i < 30; i++) t = appendTrail(t, [47 + i / 100, -52, 1000, T0 + i * 60], T0 + i * 60);
    expect(t.length).toBeLessThanOrEqual(DETECT.trailMaxPts);
    expect(t[0][3]).toBeGreaterThanOrEqual(T0 + 29 * 60 - DETECT.trailMinutes * 60);
    const same = appendTrail(t, [...t[t.length - 1]] as never, T0 + 29 * 60);
    expect(same.length).toBe(t.length);
  });
});

describe('runwayInUse', () => {
  const now = T0 + 3600;
  it('majority of unique aircraft aligned on final within 20 min', () => {
    const snap = [
      ac({ hex: 'a1', ts: now, distNm: 3, altFt: 1200, trackDeg: 288 }),
      ac({ hex: 'a2', ts: now, distNm: 4, altFt: 1300, trackDeg: 295 }),
      ac({ hex: 'a3', ts: now, distNm: 2, altFt: 900, trackDeg: 112 }),
      ac({ hex: 'a4', ts: now, distNm: 2, altFt: 5000, trackDeg: 112 }),  // too high
      ac({ hex: 'a5', ts: now, distNm: 9, altFt: 900, trackDeg: 112 }),   // too far
    ];
    const finals = mergeFinals([], observeFinals(snap, now, TEST_RUNWAYS), now);
    expect(finals).toHaveLength(3);
    expect(runwayInUse(finals, now, TEST_RUNWAYS)).toEqual({ runway: '29', count: 2, lastSeenAt: now });
  });

  it('old observations expire; no traffic → null with reason', () => {
    const finals = mergeFinals([{ hex: 'x', rwy: '29', ts: now - 21 * 60 }], [], now);
    expect(finals).toHaveLength(0);
    expect(runwayInUse(finals, now, TEST_RUNWAYS)).toMatchObject({ runway: null, reason: 'NO_RECENT_TRAFFIC' });
  });

  it('refuses to answer while official headings are missing', () => {
    expect(runwayInUse([{ hex: 'x', rwy: '29', ts: now }], now, NULL_RUNWAYS).reason).toBe('RUNWAY_CONFIG_MISSING');
  });

  it('alignment tolerance is ±runwayAlignDeg', () => {
    expect(matchRunway(290 + DETECT.runwayAlignDeg, TEST_RUNWAYS)).toBe('29');
    expect(matchRunway(290 + DETECT.runwayAlignDeg + 1, TEST_RUNWAYS)).toBeNull();
    expect(matchRunway(null, TEST_RUNWAYS)).toBeNull();
  });
});
