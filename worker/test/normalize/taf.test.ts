import { describe, expect, it } from 'vitest';
import { normalizeTaf } from '../../src/normalize/taf';
import { fixture } from '../helpers';

describe('normalizeTaf (real CYYT fixture)', () => {
  const taf = normalizeTaf(fixture('taf-cyyt.json'))!;

  it('keeps raw text and validity', () => {
    expect(taf.raw.startsWith('TAF CYYT')).toBe(true);
    expect(taf.validTo).toBeGreaterThan(taf.validFrom);
    expect(taf.issueTime).toBeGreaterThan(0);
  });

  it('labels change groups', () => {
    const kinds = taf.periods.map((p) => p.change);
    expect(kinds[0]).toBe('BASE');
    expect(kinds).toContain('TEMPO');
    expect(kinds).toContain('BECMG');
    expect(kinds).toContain('FM');
  });

  it('base period: 29020G30KT P6SM BKN030 → VFR', () => {
    const b = taf.periods[0];
    expect(b.windDirDeg).toBe(290);
    expect(b.windKt).toBe(20);
    expect(b.gustKt).toBe(30);
    expect(b.visPlus).toBe(true);
    expect(b.category).toBe('MVFR');     // BKN030 = 3000 ft → MVFR (≤ 3000)
  });

  it('TEMPO inherits missing wind from the governing period and is categorised', () => {
    const t = taf.periods[1];
    expect(t.change).toBe('TEMPO');
    expect(t.wx).toBe('-DZ -SN BR');
    expect(t.windKt).toBe(20);           // inherited from BASE
    expect(t.visSm).toBe(6);
    expect(t.category).toBe('MVFR');     // BKN020
  });

  it('prevailing periods are contiguous: each lasts until the next FM, the last until validTo', () => {
    const prev = taf.periods.filter((p) => p.change === 'BASE' || p.change === 'FM');
    for (let i = 0; i < prev.length - 1; i++) expect(prev[i].to).toBe(prev[i + 1].from);
    expect(prev[prev.length - 1].to).toBe(taf.validTo);
    expect(prev[0].from).toBe(taf.validFrom);
  });

  it('returns null for empty input', () => {
    expect(normalizeTaf([])).toBeNull();
    expect(normalizeTaf(null)).toBeNull();
  });
});
