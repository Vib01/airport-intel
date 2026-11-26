// Runway headings must come from the Canada Flight Supplement and be filled in by a human (Block 6).
// While they are null this shows as a TODO (so CI stays green) and the API reports RUNWAY_CONFIG_MISSING.
import { describe, expect, it } from 'vitest';
import { RUNWAYS, AIRPORT } from '../src/config';

const missing = RUNWAYS.filter((r) => r.trueHdg == null).map((r) => r.id);

describe('RUNWAYS config', () => {
  if (missing.length) {
    it.todo(`fill official TRUE headings for runways ${missing.join(', ')} from the Canada Flight Supplement`);
  } else {
    it('reciprocal runways differ by ~180° true', () => {
      const byId = Object.fromEntries(RUNWAYS.map((r) => [r.id, r.trueHdg!]));
      for (const [a, b] of [['10', '28'], ['16', '34']]) {
        const d = Math.abs(((byId[a] - byId[b]) % 360 + 360) % 360 - 180);
        expect(d).toBeLessThan(2);
      }
    });
  }

  it('runway designators roughly match true heading + local magnetic variation (~17°W)', () => {
    for (const r of RUNWAYS) {
      const mag = (r.trueHdg! + 17 + 360) % 360;
      const fromId = Number(r.id) * 10;
      expect(Math.abs(((mag - fromId + 540) % 360) - 180)).toBeLessThan(10);
    }
  });

  it('airport reference point is CYYT', () => {
    expect(AIRPORT.icao).toBe('CYYT');
    expect(Math.abs(AIRPORT.lat - 47.62)).toBeLessThan(0.05);
    expect(Math.abs(AIRPORT.lon + 52.75)).toBeLessThan(0.05);
  });
});
