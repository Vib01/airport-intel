// Pure. PA = elev + (1013.25 − QNH) × 27 ; ISA = 15 − 2 × (PA/1000) ; DA = PA + 120 × (OAT − ISA)
import { WX } from '../config';
import type { DensityAltitude } from '../types';

export function densityAltitude(qnhHpa: number | null, oatC: number | null, elevFt: number): DensityAltitude {
  if (qnhHpa == null || oatC == null) return null;
  const pa = elevFt + (WX.stdPressureHpa - qnhHpa) * WX.ftPerHpa;
  const isa = WX.isaSeaLevelC - WX.isaLapseCPer1000ft * (pa / 1000);
  const da = pa + WX.daFtPerC * (oatC - isa);
  return { pressureAltFt: Math.round(pa), densityAltFt: Math.round(da), isaTempC: Math.round(isa * 10) / 10 };
}
