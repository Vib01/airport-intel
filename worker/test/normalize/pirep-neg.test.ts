import { describe, expect, it } from 'vitest';
import { normalizePireps } from '../../src/normalize/pirep';
import { fixture } from '../helpers';

describe('AIREP "TB SMTH" decoded by AWC as tbInt1 "NEG" (real report, UAL19 2026-11-26)', () => {
  it('is not a hazard', () => {
    const raw = fixture<{ obsTime: number }[]>('pirep-airep-tb-smth.json');
    const [p] = normalizePireps(raw, raw[0].obsTime + 60);
    expect(p.kind).toBe('AIREP');
    expect(p.turbulence).toBeNull();
    expect(p.negative).toBe('TB NEG');
  });
});
