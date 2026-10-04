import { Link } from 'react-router-dom';
import { RadioTower } from 'lucide-react';
import { useTwin } from '../../store/twinStore';
import { Badge, Panel } from '../common/ui';
import { fmtDateTime } from '../../lib/format';

/** Status of the supervisory link to the wellsite rod pump controller. */
export function EdgeLinkCard() {
  const edge = useTwin((s) => s.edge);
  const wellId = useTwin((s) => s.wellId);
  return (
    <Panel title={`Wellsite RPC · ${wellId}`} icon={<RadioTower size={13} />} right={<Badge tone={edge.commsOnline ? 'ok' : 'crit'}>{edge.commsOnline ? 'LINK OK' : 'COMMS LOST'}</Badge>}>
      <div className="space-y-1.5 p-3 text-[11.5px]">
        <div className="flex justify-between">
          <span className="text-ink-2">Controller mode</span>
          <b className={edge.rpcMode === 'SUPERVISED' ? 'text-ok' : 'text-crit'}>{edge.rpcMode === 'SUPERVISED' ? 'SUPERVISED' : 'LOCAL POC (fail-safe)'}</b>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink-2">Active setpoint</span>
          <span className="num text-right">{edge.lastSetpoint ? `SPM ≤ ${edge.lastSetpoint.spmMax} · fillage ${edge.lastSetpoint.fillageTarget[0]}–${edge.lastSetpoint.fillageTarget[1]} %` : 'reference (no change issued)'}</span>
        </div>
        {edge.lastSetpoint && (
          <div className="flex justify-between">
            <span className="text-ink-2">Acknowledged</span>
            <span className="num">
              {fmtDateTime(edge.lastSetpoint.at)} · {(edge.lastSetpoint.ackMs / 1000).toFixed(1)} s
            </span>
          </div>
        )}
        <div className="border-t border-line pt-1.5 text-[10.5px] leading-snug text-ink-3">
          Approved actions become <b>bounded setpoints</b> for the wellsite controller. The RPC keeps stroke-by-stroke control. <Link to="/governance" className="text-ind-600 underline">Test comms loss</Link>
        </div>
      </div>
    </Panel>
  );
}
