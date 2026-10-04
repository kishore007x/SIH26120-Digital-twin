import { Link } from 'react-router-dom';
import { BellRing, CalendarClock, Container, ListChecks, SignalHigh } from 'lucide-react';
import { useFleet } from '../../hooks/useFleet';
import { useAllAlarms } from '../../pages/AlarmsPage';
import { FLEET_CONFIG } from '../../services/fleetEngine';
import { Panel } from '../common/ui';

/** Management-by-exception summary for the whole field. */
export function ExceptionsPanel() {
  const fleet = useFleet();
  const alarms = useAllAlarms().filter((a) => a.state !== 'SHELVED');
  const p1 = alarms.filter((a) => a.priority === 'P1').length;
  const p2 = alarms.filter((a) => a.priority === 'P2').length;
  const tanksHigh = fleet.ops.filter((o) => o.tank && o.tank.levelPct >= FLEET_CONFIG.tankHighPct).length;
  const tanks24 = fleet.ops.filter((o) => o.tank && (o.tank.hoursToHigh ?? 99) < 24).length;
  const due = fleet.ops.filter((o) => o.cycle.status === 'DUE' || o.cycle.status === 'OVERDUE').length;
  const dq = fleet.ops.reduce((a, o) => a + o.sensors.filter((s) => s.status !== 'OK' && s.status !== 'N/A').length, 0);
  const rows = [
    { to: '/alarms', icon: BellRing, label: 'Active alarms', value: `${p1} P1 · ${p2} P2`, tone: p1 ? 'text-crit' : p2 ? 'text-warn' : 'text-ok' },
    { to: '/tanks', icon: Container, label: 'Tanks high / full < 24 h', value: `${tanksHigh} / ${tanks24}`, tone: tanksHigh ? 'text-warn' : 'text-ok' },
    { to: '/css-planner', icon: CalendarClock, label: 'Re-steam due / overdue', value: `${due} wells`, tone: due ? 'text-warn' : 'text-ok' },
    { to: '/data-quality', icon: SignalHigh, label: 'Sensor issues', value: `${dq}`, tone: dq ? 'text-warn' : 'text-ok' },
  ];
  return (
    <Panel title="Exceptions today" icon={<ListChecks size={13} />} className="shrink-0">
      <ul className="divide-y divide-[#f3eadf]">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.to}>
              <Link to={r.to} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#faf1e6]">
                <Icon size={15} className="text-steel-500" />
                <span className="text-[12px] text-ink-2">{r.label}</span>
                <span className={`num ml-auto text-[13px] font-semibold ${r.tone}`}>{r.value}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
