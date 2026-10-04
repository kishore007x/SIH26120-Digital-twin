import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useFleet } from '../hooks/useFleet';
import { dataSource } from '../services/dataSource';
import type { SensorState, SensorStatus } from '../services/fleetEngine';
import { Badge, Note, PageTitle, Panel, Prov, Stat, StatStrip } from '../components/common/ui';
import { fmtAgo } from '../lib/format';

const CHIP: Record<SensorStatus, string> = {
  OK: 'bg-ok-bg text-ok border-[#b9d5bf]',
  STALE: 'bg-warn-bg text-warn border-[#ebcf94]',
  DRIFT: 'bg-warn-bg text-warn border-[#ebcf94]',
  FLATLINE: 'bg-crit-bg text-crit border-[#e3aca7]',
  OFFLINE: 'bg-crit-bg text-crit border-[#e3aca7]',
  'N/A': 'bg-[#f1f2f3] text-ink-3 border-line',
};
const KEYS: SensorState['key'][] = ['loadCell', 'position', 'vfd', 'downholeTemp', 'tankLevel', 'rtu'];
const SHORT: Record<SensorState['key'], string> = { loadCell: 'Load cell', position: 'Position', vfd: 'VFD', downholeTemp: 'DH temp', tankLevel: 'Tank level', rtu: 'RTU / comms' };

export default function DataQualityPage() {
  const fleet = useFleet();
  const wells = dataSource.listWells();
  const all = fleet.ops.flatMap((o) => o.sensors.filter((s) => s.status !== 'N/A').map((s) => ({ ...s, wellId: o.id })));
  const ok = all.filter((s) => s.status === 'OK').length;
  const issues = all.filter((s) => s.status !== 'OK');
  const producing = fleet.ops.filter((o) => {
    const w = wells.find((x) => x.id === o.id)!;
    return w.status === 'PRODUCING' || w.status === 'AT_RISK';
  });
  const avgDq = producing.reduce((a, o) => a + o.dataQuality, 0) / Math.max(1, producing.length);

  return (
    <div className="p-4">
      <PageTitle
        title="Data quality & sensor health"
        sub={
          <>
            Models and automation are only as good as their inputs. Every sensor is checked for stale, flatlined, drifting or offline signals, and each fault lowers model confidence for that well · <Prov kind="SIMULATED" />
          </>
        }
      />
      <StatStrip cols={5}>
        <Stat label="Sensors healthy" value={`${((ok / Math.max(1, all.length)) * 100).toFixed(1)}%`} tone="ok" sub={`${ok} of ${all.length}`} />
        <Stat label="Offline / flatline" value={issues.filter((s) => s.status === 'OFFLINE' || s.status === 'FLATLINE').length} tone="crit" />
        <Stat label="Stale / drift" value={issues.filter((s) => s.status === 'STALE' || s.status === 'DRIFT').length} tone="warn" />
        <Stat label="Avg data-quality score" value={avgDq.toFixed(0)} unit="/100" sub="producing wells" />
        <Stat label="Wells escalated for data" value={issues.filter((s) => s.key === 'downholeTemp').length} sub="confidence below automation threshold" />
      </StatStrip>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Sensor health matrix" icon={<Activity size={13} />}>
          <div className="max-h-[560px] overflow-auto">
            <table className="tbl">
              <thead className="sticky top-0">
                <tr>
                  <th>Well</th>
                  {KEYS.map((k) => (
                    <th key={k} className="text-center">
                      {SHORT[k]}
                    </th>
                  ))}
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {fleet.ops.map((o) => (
                  <tr key={o.id}>
                    <td className="num font-semibold">
                      <Link to={`/well/${o.id}`} className="text-ind-600 hover:underline">
                        {o.id}
                      </Link>
                    </td>
                    {KEYS.map((k) => {
                      const s = o.sensors.find((x) => x.key === k)!;
                      return (
                        <td key={k} className="text-center">
                          <span className={`inline-block min-w-[58px] rounded-[2px] border px-1 text-[9.5px] leading-[16px] font-semibold ${CHIP[s.status]}`} title={s.note ?? `${s.label}: ${s.status}${s.status !== 'N/A' ? `, last update ${fmtAgo(s.lastUpdateMin)} ago` : ''}`}>
                            {s.status}
                          </span>
                        </td>
                      );
                    })}
                    <td className={`num text-right font-semibold ${o.dataQuality < 70 ? 'text-crit' : o.dataQuality < 90 ? 'text-warn' : 'text-ok'}`}>{o.dataQuality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="flex flex-col gap-3">
          <Panel title="Open data issues">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Well</th>
                  <th>Sensor</th>
                  <th>Status</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((s) => (
                  <tr key={s.wellId + s.key}>
                    <td className="num font-semibold">{s.wellId}</td>
                    <td>
                      <div>{s.label}</div>
                      {s.note && <div className="text-[10.5px] text-ink-3">{s.note}</div>}
                    </td>
                    <td>
                      <Badge tone={s.status === 'OFFLINE' || s.status === 'FLATLINE' ? 'crit' : 'warn'}>{s.status}</Badge>
                    </td>
                    <td className="num text-[11px]">{fmtAgo(s.lastUpdateMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Note>
            <b>How data quality drives decisions:</b> when a key input fails, the twin lowers confidence for that well. W-19's downhole temperature gauge is offline, so its temperature is inferred from the surface flowline and confidence drops below the automation threshold. Its recommendations therefore go to the field officer instead of executing automatically (see the W-19 test case).
          </Note>
          <Note tone="warn">Checks run on every sample: range, rate of change, flatline (no change while the pump runs), staleness (time since last update), and calibration drift against reference readings.</Note>
        </div>
      </div>
    </div>
  );
}
