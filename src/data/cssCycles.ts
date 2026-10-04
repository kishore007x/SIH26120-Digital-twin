// DEMONSTRATION DATA — CSS cycle history for the demonstration well (W-17).
import type { CSSCycle } from '../types';

export const W17_CSS_CYCLES: CSSCycle[] = [
  { cycleId: 'CSS-04', steamVolume: 150, injectionPressure: 33, soakTime: 72, productionRate: 51, sor: 1.9, thermalState: 'COLD', startDate: '2025-02-10', endDate: '2025-05-18' },
  { cycleId: 'CSS-05', steamVolume: 160, injectionPressure: 34, soakTime: 72, productionRate: 49, sor: 2.0, thermalState: 'COLD', startDate: '2025-05-24', endDate: '2025-09-02' },
  { cycleId: 'CSS-06', steamVolume: 165, injectionPressure: 34, soakTime: 96, productionRate: 47, sor: 2.2, thermalState: 'COLD', startDate: '2025-09-09', endDate: '2025-12-21' },
  { cycleId: 'CSS-07', steamVolume: 175, injectionPressure: 35, soakTime: 72, productionRate: 45, sor: 2.4, thermalState: 'COLD', startDate: '2026-01-02', endDate: '2026-05-30' },
  { cycleId: 'CSS-08', steamVolume: 180, injectionPressure: 35, soakTime: 72, productionRate: 42, sor: 2.5, thermalState: 'HOT PRODUCTION', startDate: '2026-06-12', endDate: null },
];

export const CURRENT_CYCLE = W17_CSS_CYCLES[W17_CSS_CYCLES.length - 1];

export function cycleForWell(cycleId: string, wellId: string): CSSCycle {
  if (wellId === 'W-17') return CURRENT_CYCLE;
  const num = Number(cycleId.replace('CSS-', '')) || 5;
  return {
    cycleId,
    steamVolume: 120 + num * 8,
    injectionPressure: 30 + (num % 5),
    soakTime: num % 2 ? 72 : 96,
    productionRate: 30 + num * 2,
    sor: 1.6 + num * 0.12,
    thermalState: 'HOT PRODUCTION',
    startDate: '2026-05-01',
    endDate: null,
  };
}
