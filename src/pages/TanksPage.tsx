import { Link } from 'react-router-dom';
import { Container, Truck } from 'lucide-react';
import { useFleet } from '../hooks/useFleet';
import { useTwin } from '../store/twinStore';
import { FLEET_CONFIG } from '../services/fleetEngine';
import { Badge, Bar, Note, PageTitle, Panel, Prov, Stat, StatStrip } from '../components/common/ui';
import { fmtDateTime } from '../lib/format';

const levelColor = (p: number) => (p >= FLEET_CONFIG.tankHighHighPct ? '#b3261e' : p >= FLEET_CONFIG.tankHighPct ? '#c98a12' : '#2d64a8');

export default function TanksPage() {
  const fleet = useFleet();
  const now = useTwin((s) => s.simTime);
  const tanks = fleet.ops.filter((o) => o.tank).sort((a, b) => (a.tank!.hoursToHigh ?? 1e9) - (b.tank!.hoursToHigh ?? 1e9));
  const inv = tanks.reduce((a, o) => a + o.tank!.levelBbl, 0);
  const prod = tanks.reduce((a, o) => a + o.tank!.fillBblPerDay, 0);
  const high = tanks.filter((o) => o.tank!.levelPct >= FLEET_CONFIG.tankHighPct).length;
  const hh = tanks.filter((o) => o.tank!.levelPct >= FLEET_CONFIG.tankHighHighPct).length;
  const within24 = tanks.filter((o) => o.tank!.nextPickup && o.tank!.nextPickup - now < 24 * 3_600_000);
  const bowsers = Array.from({ length: FLEET_CONFIG.bowsers }, (_, i) => `BWR-${String(i + 1).padStart(2, '0')}`);

  return (
    <div className="p-4">
      <PageTitle
        title="Well-site tanks & crude evacuation"
        sub={
          <>
            Crude is stored in tanks at each well location and moved out by tanker (bowser). The tank level is also the field's production measurement · <Prov kind="SIMULATED" />
          </>
        }
      />
      <StatStrip cols={6}>
        <Stat label="Tank inventory" value={inv.toFixed(0)} unit="bbl" sub={`${tanks.length} well sites × ${FLEET_CONFIG.tankCapacityBbl} bbl`} />
        <Stat label="Fill rate (field)" value={prod.toFixed(0)} unit="bbl/d" />
        <Stat label="Tanks HIGH (≥ 85 %)" value={high} tone={high ? 'warn' : 'ok'} />
        <Stat label="Tanks HIGH-HIGH (≥ 95 %)" value={hh} tone={hh ? 'crit' : 'ok'} />
        <Stat label="Pickups next 24 h" value={within24.length} sub={`${FLEET_CONFIG.bowsers} bowsers × ${FLEET_CONFIG.bowserCapacityBbl} bbl`} />
        <Stat label="Bowser loads / day" value={(prod / FLEET_CONFIG.bowserCapacityBbl).toFixed(1)} sub="to keep inventory flat" />
      </StatStrip>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Tanks by time to HIGH level" icon={<Container size={13} />}>
          <div className="max-h-[560px] overflow-auto">
            <table className="tbl">
              <thead className="sticky top-0">
                <tr>
                  <th>Well</th>
                  <th className="w-[180px]">Level</th>
                  <th className="text-right">bbl</th>
                  <th className="text-right">Fill bbl/d</th>
                  <th className="text-right">To HIGH</th>
                  <th className="text-right">To FULL</th>
                  <th>Next pickup</th>
                  <th>Bowser</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((o) => {
                  const t = o.tank!;
                  const faulty = o.sensors.find((s) => s.key === 'tankLevel' && s.status !== 'OK');
                  return (
                    <tr key={o.id}>
                      <td className="num font-semibold">
                        <Link to={`/well/${o.id}`} className="text-ind-600 hover:underline">
                          {o.id}
                        </Link>
                        {faulty && (
                          <Badge tone="warn" className="ml-1">
                            {faulty.status}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Bar value={t.levelPct} color={levelColor(t.levelPct)} marks={[{ at: FLEET_CONFIG.tankHighPct, color: '#c98a12' }, { at: FLEET_CONFIG.tankHighHighPct, color: '#b3261e' }]} />
                          </div>
                          <span className="num w-9 text-right text-[11.5px] font-semibold">{t.levelPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="num text-right">{t.levelBbl.toFixed(0)}</td>
                      <td className="num text-right">{t.fillBblPerDay.toFixed(0)}</td>
                      <td className="num text-right">{t.hoursToHigh ? `${t.hoursToHigh.toFixed(0)} h` : <span className="font-semibold text-warn">now</span>}</td>
                      <td className="num text-right">{t.hoursToFull?.toFixed(0)} h</td>
                      <td className="num text-[11.5px]">{t.nextPickup ? fmtDateTime(t.nextPickup) : '—'}</td>
                      <td className="num text-[11.5px]">{t.bowser ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title="Bowser dispatch plan" icon={<Truck size={13} />}>
            <div className="divide-y divide-[#f3eadf]">
              {bowsers.map((b) => {
                const trips = tanks.filter((o) => o.tank!.bowser === b).sort((x, y) => x.tank!.nextPickup! - y.tank!.nextPickup!);
                return (
                  <div key={b} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="num font-semibold text-navy-900">{b}</span>
                      <span className="text-[11px] text-ink-3">{trips.length} pickups planned</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {trips.map((o) => (
                        <span key={o.id} className="num rounded-[2px] border border-line bg-[#faf3ea] px-1.5 py-[1px] text-[10.5px]" title={fmtDateTime(o.tank!.nextPickup!)}>
                          {o.id} · {fmtDateTime(o.tank!.nextPickup!).split(', ')[1] ?? ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Note>
            The dispatch plan sends the most urgent tanks first and spreads trips across the tanker fleet (~3.5 h per load, haul and unload at the camp). In production, tank gauging would give the measured production for each well, which would be used to recalibrate the twin's production estimate from pump displacement.
          </Note>
          <Note tone="warn">
            <b>Why this matters:</b> if a tank fills up, the well has to stop pumping, so production is lost even though the pump is healthy. The twin predicts time-to-full for every well, so trucks are sent before that happens.
          </Note>
        </div>
      </div>
    </div>
  );
}
