import { NavLink } from 'react-router-dom';
import { Activity, Box, CheckCircle2, Flame, GitBranch, Gauge, History, Map, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useTwin } from '../../store/twinStore';
import { HealthBadge, RiskBadge } from '../common/ui';
import { f0 } from '../../lib/format';

export const NAV = [
  { key: 'field', label: 'Field Command Center', path: () => '/field', icon: Map },
  { key: 'twin', label: 'Well Digital Twin', path: (w: string) => `/well/${w}`, icon: Box },
  { key: 'ops', label: 'Live Operations', path: (w: string) => `/well/${w}/operations`, icon: Activity },
  { key: 'thermal', label: 'Thermal / CSS', path: (w: string) => `/well/${w}/thermal`, icon: Flame },
  { key: 'srp', label: 'SRP Intelligence', path: (w: string) => `/well/${w}/srp`, icon: Gauge },
  { key: 'causal', label: 'Causal Analysis', path: (w: string) => `/well/${w}/causal`, icon: GitBranch },
  { key: 'opt', label: 'Optimization', path: (w: string) => `/well/${w}/optimization`, icon: SlidersHorizontal },
  { key: 'safety', label: 'Safety', path: (w: string) => `/well/${w}/safety`, icon: ShieldCheck },
  { key: 'outcome', label: 'Outcome', path: (w: string) => `/well/${w}/outcome`, icon: CheckCircle2 },
  { key: 'history', label: 'History / Model Trust', path: (w: string) => `/well/${w}/history`, icon: History },
];

export function Sidebar() {
  const wellId = useTwin((s) => s.wellId);
  const risk = useTwin((s) => s.computed.risk);
  const health = useTwin((s) => s.computed.health);
  const oil = useTwin((s) => s.computed.sample.oil);
  const spm = useTwin((s) => s.spm);
  const status = useTwin((s) => s.scenario.status);
  const hasRec = useTwin((s) => !!s.recommendation);
  const hasOutcome = useTwin((s) => !!s.outcome);

  return (
    <nav className="flex w-[212px] shrink-0 flex-col border-r border-navy-950 bg-navy-950 text-steel-200">
      <div className="px-3 pt-3 pb-1 text-[9.5px] font-semibold tracking-[0.16em] text-steel-400">NAVIGATION</div>
      <ul className="flex-1 overflow-y-auto px-1.5">
        {NAV.map((n, i) => {
          const Icon = n.icon;
          const flag = (n.key === 'safety' && status === 'AWAITING') || (n.key === 'opt' && hasRec && status !== 'COMPLETE') || (n.key === 'outcome' && hasOutcome);
          return (
            <li key={n.key}>
              {i === 1 && <div className="mx-2 mt-2 mb-1 border-t border-navy-800 pt-2 text-[9.5px] font-semibold tracking-[0.16em] text-steel-400">WELL {wellId}</div>}
              <NavLink
                to={n.path(wellId)}
                end
                className={({ isActive }) =>
                  `group my-[1px] flex items-center gap-2.5 rounded-[3px] px-2.5 py-[7px] text-[12px] font-medium tracking-wide transition-colors ${
                    isActive ? 'bg-ind-600 text-white' : 'text-steel-200 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <Icon size={15} strokeWidth={1.8} className="shrink-0 opacity-90" />
                <span className="truncate uppercase">{n.label}</span>
                {flag && <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${n.key === 'safety' ? 'pulse bg-[#f0b84a]' : 'bg-[#8fd19e]'}`} />}
              </NavLink>
            </li>
          );
        })}
      </ul>
      <div className="m-2 rounded-[3px] border border-navy-800 bg-navy-900 p-2.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="font-semibold tracking-wider text-white">{wellId}</span>
          <RiskBadge risk={risk} />
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-y-1 text-steel-300">
          <span>Oil</span>
          <span className="num text-right text-white">{f0(oil)} BOPD</span>
          <span>SPM</span>
          <span className="num text-right text-white">{spm.toFixed(1)}</span>
          <span>Health</span>
          <span className="text-right">
            <HealthBadge health={health} />
          </span>
        </div>
      </div>
      <div className="px-3 pb-2 text-[9.5px] leading-snug text-steel-400">
        Prototype · supervised automation, safety-gated. Operator can intervene or roll back. Simulated setpoints only.
      </div>
    </nav>
  );
}
