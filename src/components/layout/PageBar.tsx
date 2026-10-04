import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { useTwin } from '../../store/twinStore';
import { crumbsFor, WELL_NAV } from '../../lib/navConfig';
import { HealthBadge, RiskBadge } from '../common/ui';
import { WellSelect } from './MainNav';
import { f0 } from '../../lib/format';

/** Breadcrumb trail + (on well pages) the numbered decision-workflow stepper. */
export function PageBar() {
  const loc = useLocation();
  const wellId = useTwin((s) => s.wellId);
  const risk = useTwin((s) => s.computed.risk);
  const health = useTwin((s) => s.computed.health);
  const oil = useTwin((s) => s.computed.sample.oil);
  const spm = useTwin((s) => s.spm);
  const status = useTwin((s) => s.scenario.status);
  const hasRec = useTwin((s) => !!s.recommendation);
  const hasOutcome = useTwin((s) => !!s.outcome);
  const crumbs = crumbsFor(loc.pathname);
  const inWell = loc.pathname.startsWith('/well/');
  const idx = inWell ? WELL_NAV.findIndex((n) => n.path(wellId) === loc.pathname.replace(/\/$/, '')) : -1;
  const prev = idx > 0 ? WELL_NAV[idx - 1] : null;
  const next = idx >= 0 && idx < WELL_NAV.length - 1 ? WELL_NAV[idx + 1] : null;
  const stepperRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = stepperRef.current;
    const on = el?.querySelector<HTMLElement>('.step-on');
    if (!el || !on) return;
    const l = on.offsetLeft - el.offsetLeft;
    if (l < el.scrollLeft || l + on.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollTo({ left: l - 24, behavior: 'smooth' });
  }, [idx]);

  return (
    <div className="page-bar">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[12px]" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-ink-3" aria-hidden />}
              {c.to ? (
                <Link to={c.to} className="crumb-link">
                  {i === 0 && <Home size={12} className="mr-1 inline -translate-y-px" aria-hidden />}
                  {c.label}
                </Link>
              ) : (
                <span className="font-semibold text-navy-900" aria-current="page">
                  {i === 0 && <Home size={12} className="mr-1 inline -translate-y-px" aria-hidden />}
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
        {inWell && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[12px]">
            <WellSelect />
            <span className="glass-tag">
              Oil <b className="num">{f0(oil)}</b> BOPD
            </span>
            <span className="glass-tag">
              SPM <b className="num">{spm.toFixed(1)}</b>
            </span>
            <RiskBadge risk={risk} />
            <HealthBadge health={health} />
          </div>
        )}
      </div>
      {inWell && (
        <div className="flex items-center gap-1 px-3 pb-1.5">
          {prev ? (
            <Link to={prev.path(wellId)} className="step-arrow" aria-label={`Previous step: ${prev.label}`} title={`Previous: ${prev.label}`}>
              <ChevronLeft size={16} />
            </Link>
          ) : (
            <span className="step-arrow opacity-30" aria-hidden>
              <ChevronLeft size={16} />
            </span>
          )}
          <nav ref={stepperRef} className="stepper" aria-label={`Well ${wellId} workflow`}>
            {WELL_NAV.map((n, i) => {
              const flag = (n.key === 'safety' && status === 'AWAITING') || (n.key === 'opt' && hasRec && status !== 'COMPLETE') || (n.key === 'outcome' && hasOutcome);
              return (
                <NavLink key={n.key} to={n.path(wellId)} end className={({ isActive }) => `step ${isActive ? 'step-on' : i < idx ? 'step-done' : ''}`}>
                  <span className="step-n num">{i + 1}</span>
                  <span className="hidden whitespace-nowrap min-[1400px]:inline">{n.label}</span>
                  <span className="whitespace-nowrap min-[1400px]:hidden" title={n.label}>{n.short ?? n.label}</span>
                  {flag && <span className={`h-2 w-2 shrink-0 rounded-full ${n.key === 'safety' ? 'pulse bg-[#e8871e]' : 'bg-[#3f9d5a]'}`} aria-label="needs attention" />}
                </NavLink>
              );
            })}
          </nav>
          {next ? (
            <Link to={next.path(wellId)} className="step-arrow" aria-label={`Next step: ${next.label}`} title={`Next: ${next.label}`}>
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="step-arrow opacity-30" aria-hidden>
              <ChevronRight size={16} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
