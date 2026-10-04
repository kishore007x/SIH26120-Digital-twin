import { useTwin } from '../../store/twinStore';
import type { HealthLevel, RiskLevel, Well } from '../../types';

export interface WellDisplay {
  production: number;
  temperature: number;
  viscosity: number;
  spm: number;
  rodLoad: number;
  health: HealthLevel;
  risk: RiskLevel;
  live: boolean;
}

/** The twin-selected well shows live simulated values; others show their steady-state snapshot. */
export function useWellDisplays(wells: Well[]): Record<string, WellDisplay> {
  const wellId = useTwin((s) => s.wellId);
  const c = useTwin((s) => s.computed);
  const spm = useTwin((s) => s.spm);
  const out: Record<string, WellDisplay> = {};
  for (const w of wells) {
    if (w.id === wellId && (w.status === 'PRODUCING' || w.status === 'AT_RISK')) {
      out[w.id] = {
        production: c.sample.oil,
        temperature: c.sample.temperature,
        viscosity: c.sample.viscosity,
        spm,
        rodLoad: c.sample.rodLoad,
        health: c.health,
        risk: c.risk,
        live: true,
      };
    } else {
      out[w.id] = { production: w.production, temperature: w.temperature, viscosity: w.viscosity, spm: w.spm, rodLoad: w.rodLoad, health: w.health, risk: w.risk, live: false };
    }
  }
  return out;
}
