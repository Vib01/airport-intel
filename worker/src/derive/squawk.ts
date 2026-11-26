// Pure. Neutral wording, no speculation.
import { SQUAWK } from '../config';
import type { SquawkAlert } from '../types';

export function classifySquawk(code: string | null | undefined): SquawkAlert {
  switch (code) {
    case SQUAWK.emergency: return { kind: 'EMERGENCY', label: 'Emergency (7700)' };
    case SQUAWK.radioFail: return { kind: 'RADIO_FAIL', label: 'Radio failure (7600)' };
    case SQUAWK.special: return { kind: 'SPECIAL_7500', label: 'Special code 7500' };
    default: return null;
  }
}
