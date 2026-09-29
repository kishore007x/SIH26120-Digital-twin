import type { OutcomeRecord } from '../../store/twinStore';

function Row({ k, unit, pred, obs, band, err, dec = 1 }: { k: string; unit: string; pred: number; obs: number; band?: [number, number]; err: number; dec?: number }) {
  const inBand = band ? obs >= band[0] && obs <= band[1] : true;
  return (
    <tr>
      <td className="font-medium">{k}</td>
      <td className="num text-right">
        {pred.toFixed(dec)} {unit}
      </td>
      <td className="num text-right font-semibold">
        {obs.toFixed(dec)} {unit}
      </td>
      <td className="num text-right">{band ? `${band[0].toFixed(dec)}–${band[1].toFixed(dec)}` : '—'}</td>
      <td className={`num text-right font-semibold ${err < 5 ? 'text-ok' : err < 10 ? 'text-warn' : 'text-crit'}`}>{err.toFixed(1)}%</td>
      <td className="text-[11px]">{inBand ? <span className="text-ok">within band</span> : <span className="text-warn">outside band</span>}</td>
    </tr>
  );
}

export function PredictionValidation({ o }: { o: OutcomeRecord }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Quantity (+24 h)</th>
          <th className="text-right">Predicted</th>
          <th className="text-right">Simulated observed</th>
          <th className="text-right">Band</th>
          <th className="text-right">Error</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <Row k="Rod load" unit="%" pred={o.predictedAfter.rodLoad} obs={o.observedAfter.rodLoad} band={[o.predictedAfter.lower, o.predictedAfter.upper]} err={o.errors.rodLoad} />
        <Row k="Temperature" unit="°C" pred={o.predictedAfter.temperature} obs={o.observedAfter.temperature} err={o.errors.temperature} />
        <Row k="Viscosity" unit="cP" pred={o.predictedAfter.viscosity} obs={o.observedAfter.viscosity} err={o.errors.viscosity} dec={0} />
      </tbody>
    </table>
  );
}
