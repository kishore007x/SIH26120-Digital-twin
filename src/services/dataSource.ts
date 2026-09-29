// Data-source boundary.
//
// The UI reads field / well / cycle data only through `FieldDataSource`.
// The MVP uses `LocalDemoDataSource` (structured local demonstration data).
// Future implementations can target SCADA / historian (e.g. OPC-UA gateway),
// TimescaleDB / InfluxDB, or a REST/GraphQL API while keeping the same shape.

import { WELLS, getWell, FIELD_REFERENCE } from '../data/wells';
import { W17_CSS_CYCLES, cycleForWell } from '../data/cssCycles';
import { HISTORICAL_VALIDATION } from '../data/history';
import type { CSSCycle, ValidationRecord, Well } from '../types';

export interface FieldDataSource {
  readonly mode: 'DEMONSTRATION' | 'LIVE';
  readonly label: string;
  listWells(): Well[];
  getWell(id: string): Well | undefined;
  getCycleHistory(wellId: string): CSSCycle[];
  getValidationHistory(wellId: string): ValidationRecord[];
  fieldReference(): { total: number; producing: number; notProducing: number };
}

export const LocalDemoDataSource: FieldDataSource = {
  mode: 'DEMONSTRATION',
  label: 'Local demonstration dataset',
  listWells: () => WELLS,
  getWell: (id) => getWell(id),
  getCycleHistory: (wellId) => {
    if (wellId === 'W-17') return W17_CSS_CYCLES;
    const w = getWell(wellId);
    return w ? [cycleForWell(w.cssCycle, wellId)] : [];
  },
  getValidationHistory: () => HISTORICAL_VALIDATION,
  fieldReference: () => FIELD_REFERENCE,
};

/** Single swap point for the active data source. */
export const dataSource: FieldDataSource = LocalDemoDataSource;
