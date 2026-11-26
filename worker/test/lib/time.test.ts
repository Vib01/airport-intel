// Local-time bucketing for America/St_Johns (NST UTC−3:30, NDT UTC−2:30).
// 2026 transitions (2nd Sunday of March / 1st Sunday of November, at 02:00 local):
//   2026-03-08 02:00 NST (05:30Z) → 03:00 NDT   (23-hour day)
//   2026-11-01 02:00 NDT (04:30Z) → 01:00 NST   (25-hour day)
import { describe, expect, it } from 'vitest';
import { localDayKey, localDayStart, localHourStart, tzOffsetSec } from '../../src/lib/time';

const TZ = 'America/St_Johns';
const Z = (iso: string) => Date.parse(iso) / 1000;

describe('required case', () => {
  it('at 2026-11-26T01:42Z, "today" starts at 2026-11-25T03:30Z', () => {
    expect(localDayStart(Z('2026-11-26T01:42:00Z'), TZ)).toBe(Z('2026-11-25T03:30:00Z'));
    expect(localDayKey(Z('2026-11-26T01:42:00Z'), TZ)).toBe('2026-11-25');
  });
});

describe('NST (UTC−3:30)', () => {
  const t = Z('2026-11-26T01:42:00Z');                         // 22:12 NST, 25 Nov
  it('offset', () => expect(tzOffsetSec(t, TZ)).toBe(-12600));
  it('local hour starts at :30 UTC', () => {
    expect(localHourStart(t, TZ)).toBe(Z('2026-11-26T01:30:00Z'));                      // 22:00 NST
    expect(localHourStart(Z('2026-11-26T01:29:59Z'), TZ)).toBe(Z('2026-11-26T00:30:00Z')); // 21:59:59 → 21:00
    expect(localHourStart(Z('2026-11-26T01:30:00Z'), TZ)).toBe(Z('2026-11-26T01:30:00Z')); // exactly on the hour
  });
  it('local midnight boundary', () => {
    expect(localDayStart(Z('2026-11-26T03:29:59Z'), TZ)).toBe(Z('2026-11-25T03:30:00Z'));  // 23:59:59 on the 25th
    expect(localDayStart(Z('2026-11-26T03:30:00Z'), TZ)).toBe(Z('2026-11-26T03:30:00Z'));  // 00:00 on the 26th
  });
});

describe('NDT (UTC−2:30)', () => {
  const t = Z('2026-07-15T12:10:00Z');                         // 09:40 NDT
  it('offset', () => expect(tzOffsetSec(t, TZ)).toBe(-9000));
  it('hour and day', () => {
    expect(localHourStart(t, TZ)).toBe(Z('2026-07-15T11:30:00Z'));                      // 09:00 NDT
    expect(localDayStart(t, TZ)).toBe(Z('2026-07-15T02:30:00Z'));                        // 00:00 NDT
    expect(localDayKey(Z('2026-07-16T02:29:00Z'), TZ)).toBe('2026-07-15');               // 23:59 NDT
  });
});

describe('spring forward: 2026-03-08 (23-hour day)', () => {
  it('offsets either side of 05:30Z', () => {
    expect(tzOffsetSec(Z('2026-03-08T05:29:00Z'), TZ)).toBe(-12600);
    expect(tzOffsetSec(Z('2026-03-08T05:30:00Z'), TZ)).toBe(-9000);
  });
  it('day starts at NST midnight; next day starts 23 h later at NDT midnight', () => {
    expect(localDayStart(Z('2026-03-08T20:00:00Z'), TZ)).toBe(Z('2026-03-08T03:30:00Z'));
    expect(localDayStart(Z('2026-03-09T12:00:00Z'), TZ)).toBe(Z('2026-03-09T02:30:00Z'));
    expect(Z('2026-03-09T02:30:00Z') - Z('2026-03-08T03:30:00Z')).toBe(23 * 3600);
  });
  it('hours: 01:xx NST then 03:xx NDT (02:xx does not exist)', () => {
    expect(localHourStart(Z('2026-03-08T05:15:00Z'), TZ)).toBe(Z('2026-03-08T04:30:00Z')); // 01:45 NST → 01:00
    expect(localHourStart(Z('2026-03-08T05:45:00Z'), TZ)).toBe(Z('2026-03-08T05:30:00Z')); // 03:15 NDT → 03:00
  });
});

describe('fall back: 2026-11-01 (25-hour day)', () => {
  it('offsets either side of 04:30Z', () => {
    expect(tzOffsetSec(Z('2026-11-01T04:29:00Z'), TZ)).toBe(-9000);
    expect(tzOffsetSec(Z('2026-11-01T04:30:00Z'), TZ)).toBe(-12600);
  });
  it('day starts at NDT midnight; next day starts 25 h later at NST midnight', () => {
    expect(localDayStart(Z('2026-11-01T20:00:00Z'), TZ)).toBe(Z('2026-11-01T02:30:00Z'));
    expect(localDayStart(Z('2026-11-02T12:00:00Z'), TZ)).toBe(Z('2026-11-02T03:30:00Z'));
    expect(Z('2026-11-02T03:30:00Z') - Z('2026-11-01T02:30:00Z')).toBe(25 * 3600);
    expect(localDayKey(Z('2026-11-02T03:00:00Z'), TZ)).toBe('2026-11-01');               // 23:30 NST
  });
  it('the repeated 01:00 hour gives two distinct buckets', () => {
    expect(localHourStart(Z('2026-11-01T04:15:00Z'), TZ)).toBe(Z('2026-11-01T03:30:00Z')); // first 01:45 (NDT)
    expect(localHourStart(Z('2026-11-01T04:45:00Z'), TZ)).toBe(Z('2026-11-01T04:30:00Z')); // second 01:15 (NST)
  });
});
