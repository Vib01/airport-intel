import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Aircraft } from '../src/types';
import type { RunwayConfig } from '../src/config';

const here = dirname(fileURLToPath(import.meta.url));
export const fixture = <T = unknown>(name: string): T => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8')) as T;

/** Synthetic aircraft for detector tests (positions are relative to CYYT ARP). */
export function ac(p: Partial<Aircraft> & { hex: string; ts: number }): Aircraft {
  return {
    callsign: 'ACA123', reg: 'C-TEST', type: 'A320', desc: null, airline: 'ACA',
    lat: 47.62, lon: -52.75, onGround: false, altBaroFt: 1000, altGeomFt: 1000, altFt: 1000,
    gsKt: 140, trackDeg: 290, vsFpm: 0, squawk: '1234', alert: null, category: 'A3',
    distNm: 3, bearingDeg: 90, seenPosSec: 0,
    ...p,
  };
}

/** Runways with no headings, for the "not configured" code paths. */
export const NULL_RUNWAYS: RunwayConfig[] = [
  { id: '10', trueHdg: null, lengthFt: null }, { id: '28', trueHdg: null, lengthFt: null },
];

// TEST-ONLY runway headings. Not real CYYT values — config.ts holds the official ones (Block 6).
export const TEST_RUNWAYS: RunwayConfig[] = [
  { id: '11', trueHdg: 110, lengthFt: null }, { id: '29', trueHdg: 290, lengthFt: null },
  { id: '16', trueHdg: 160, lengthFt: null }, { id: '34', trueHdg: 340, lengthFt: null },
];
