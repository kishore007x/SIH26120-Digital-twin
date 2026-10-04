import type { Well } from '../../types';
import { STATUS_COLOR, STATUS_LABEL, f0, loadColor } from '../../lib/format';
import { HealthBadge, RiskBadge } from '../common/ui';
import type { WellDisplay } from './useLiveWell';

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr>
      <td className="text-ink-3">{k}</td>
      <td className="num text-right font-semibold">{v}</td>
    </tr>
  );
}

/** Hover card with a well's key values — shared by the schematic and 3D field maps. */
export function WellHoverCard({ well, d, note }: { well: Well; d: WellDisplay; note?: string }) {
  const producing = well.status === 'PRODUCING' || well.status === 'AT_RISK';
  return (
    <div className="w-[210px] rounded-[3px] border border-navy-700 bg-white text-[11.5px] shadow-lg">
      <div className="flex items-center justify-between bg-navy-900 px-2.5 py-1.5 text-white">
        <span className="font-semibold tracking-wider">{well.id}</span>
        <span className="flex items-center gap-1 text-[10px] text-steel-200">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[well.status] }} />
          {STATUS_LABEL[well.status].toUpperCase()}
        </span>
      </div>
      <div className="px-2.5 py-1.5">
        {producing ? (
          <table className="w-full">
            <tbody className="[&_td]:py-[2px]">
              <Row k="Production" v={`${f0(d.production)} BOPD`} />
              <Row k="Temperature" v={`${d.temperature.toFixed(1)} °C`} />
              <Row k="Viscosity" v={`${f0(d.viscosity)} cP`} />
              <Row k="SPM" v={d.spm.toFixed(1)} />
              <Row k="Rod load" v={<span style={{ color: loadColor(d.rodLoad) }}>{f0(d.rodLoad)} %</span>} />
              <tr>
                <td className="text-ink-3">Health / Risk</td>
                <td className="text-right">
                  <HealthBadge health={d.health} /> <RiskBadge risk={d.risk} />
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="py-1 text-ink-3">{note ?? (well.status === 'MAINTENANCE' ? 'Workover / pump maintenance in progress.' : 'Shut-in. No production.')}</div>
        )}
        <div className="mt-1 border-t border-line pt-1 text-[10px] text-ink-3">
          Pad {well.pad} · {well.cssCycle} · {d.live ? 'LIVE TWIN (simulated)' : 'demonstration snapshot'} · click to open
        </div>
      </div>
    </div>
  );
}
