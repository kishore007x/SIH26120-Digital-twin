import { useMemo } from 'react';
import { useTwin } from '../store/twinStore';
import { dataSource } from '../services/dataSource';
import { computeFleet, type FieldAlarm } from '../services/fleetEngine';

/** Field-wide operational state, recomputed every 5 simulated minutes. */
export function useFleet() {
  const bucket = useTwin((s) => Math.floor(s.simTime / 300_000) * 300_000);
  const wells = dataSource.listWells();
  return useMemo(() => computeFleet(wells, bucket), [wells, bucket]);
}

/** Alarms raised by the live twin (selected well) — merged with fleet alarms. */
export function useLiveAlarms(): FieldAlarm[] {
  const wellId = useTwin((s) => s.wellId);
  const risk = useTwin((s) => s.computed.risk);
  const pred = useTwin((s) => s.computed.forecast.rodLoadCurrentSpm.value);
  const fill = useTwin((s) => s.computed.sample.pumpFillage);
  const escalation = useTwin((s) => s.escalation);
  const status = useTwin((s) => s.scenario.status);
  const comms = useTwin((s) => s.edge.commsOnline);
  const t = useTwin((s) => Math.floor(s.simTime / 60_000) * 60_000);
  return useMemo(() => {
    const out: FieldAlarm[] = [];
    if (risk === 'HIGH' || risk === 'CRITICAL')
      out.push({ id: `${wellId}-FCST`, wellId, priority: 'P2', category: 'PROCESS', message: `Predicted rod load ${pred.toFixed(0)}% at +24 h (thermal decline)`, raisedAt: t, action: 'Review causal analysis and recommendation' });
    if (fill < 82) out.push({ id: `${wellId}-POFF`, wellId, priority: 'P2', category: 'PROCESS', message: `Incipient pump-off — fillage ${fill.toFixed(0)}%`, raisedAt: t, action: 'Check dynacard; reduce speed' });
    if (status === 'AWAITING' && escalation)
      out.push({ id: `${wellId}-ESC`, wellId, priority: 'P1', category: 'AUTOMATION', message: 'Escalated action awaiting officer decision', raisedAt: t, action: escalation });
    if (!comms) out.push({ id: `${wellId}-COMMS`, wellId, priority: 'P1', category: 'AUTOMATION', message: 'Wellsite RPC communications lost — local pump-off control', raisedAt: t, action: 'Restore link; automation suspended' });
    return out;
  }, [wellId, risk, pred, fill, escalation, status, comms, t]);
}
