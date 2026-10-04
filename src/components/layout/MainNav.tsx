import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, ChevronDown, Menu, X } from 'lucide-react';
import { useTwin } from '../../store/twinStore';
import { useAllAlarms } from '../../pages/AlarmsPage';
import { FIELD_NAV, HOME_NAV, INFO_NAV, OPS_NAV, WELL_NAV, type NavItem } from '../../lib/navConfig';

const COMMAND_NAV = FIELD_NAV.find((n) => n.key === 'field')!;
import { dataSource } from '../../services/dataSource';

type MenuKey = 'field' | 'well' | 'info' | null;

function MenuLink({ item, wellId, n }: { item: NavItem; wellId: string; n?: number }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.path(wellId)} end className={({ isActive }) => `mega-link ${isActive ? 'mega-link-on' : ''}`}>
      <span className="mega-ico">{n ? <span className="num text-[11px] font-bold">{n}</span> : <Icon size={16} strokeWidth={1.9} />}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">
          {item.label}
          {item.hi && (
            <span className="font-hi ml-1.5 text-[11px] font-normal text-ink-3" lang="hi">
              {item.hi}
            </span>
          )}
        </span>
        <span className="block text-[11.5px] leading-snug text-ink-3">{item.desc}</span>
      </span>
    </NavLink>
  );
}

export function WellSelect({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const wellId = useTwin((s) => s.wellId);
  const nav = useNavigate();
  const loc = useLocation();
  const wells = dataSource.listWells();
  const change = (id: string) => {
    // the operations dashboard stays put and just follows the newly selected well
    if (loc.pathname === OPS_NAV.path('')) return useTwin.getState().selectWell(id);
    const m = loc.pathname.match(/^\/well\/[^/]+(\/.*)?$/);
    nav(m ? `/well/${id}${m[1] ?? ''}` : `/well/${id}`);
  };
  return (
    <label className={`flex items-center gap-1.5 text-[12px] ${className}`}>
      <span className={`font-semibold ${dark ? 'text-[#f1dcc4]' : 'text-ink-2'}`}>Well</span>
      <select value={wellId} onChange={(e) => change(e.target.value)} className={`well-select ${dark ? 'well-select-dark' : ''}`} aria-label="Select well">
        {wells.map((w) => (
          <option key={w.id} value={w.id}>
            {w.id} · {w.status === 'AT_RISK' ? 'At risk' : w.status[0] + w.status.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MainNav() {
  const wellId = useTwin((s) => s.wellId);
  const loc = useLocation();
  const [open, setOpen] = useState<MenuKey>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const alarms = useAllAlarms();
  const unack = alarms.filter((a) => a.state === 'UNACK' && a.priority !== 'P3').length;
  const p1 = alarms.some((a) => a.state === 'UNACK' && a.priority === 'P1');

  // close menus on navigation, outside click and Escape
  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [loc.pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobile(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const inField = FIELD_NAV.some((n) => n.key !== 'field' && n.path('') === loc.pathname);
  const inWell = loc.pathname.startsWith('/well/');
  const inInfo = INFO_NAV.some((n) => n.path('') === loc.pathname);

  const Trigger = ({ k, label, active }: { k: Exclude<MenuKey, null>; label: string; active: boolean }) => (
    <button
      className={`nav-top ${active ? 'nav-top-on' : ''} ${open === k ? 'nav-top-open' : ''}`}
      aria-expanded={open === k}
      aria-haspopup="true"
      onClick={() => setOpen(open === k ? null : k)}
      onMouseEnter={() => setOpen(k)}
    >
      {label} <ChevronDown size={14} className={`transition-transform ${open === k ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <nav ref={ref} className="main-nav" aria-label="Main navigation" onMouseLeave={() => setOpen(null)}>
      <div className="mx-auto flex h-full max-w-[1920px] items-center gap-1 px-3">
        <button className="nav-top lg:hidden" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
          {mobile ? <X size={18} /> : <Menu size={18} />} Menu
        </button>
        <div className="hidden h-full items-center gap-1 lg:flex">
          <NavLink to="/field" className={({ isActive }) => `nav-top ${isActive ? 'nav-top-on' : ''}`} onMouseEnter={() => setOpen(null)}>
            <COMMAND_NAV.icon size={15} /> Command Center
          </NavLink>
          <NavLink to="/operations" className={({ isActive }) => `nav-top ${isActive ? 'nav-top-on' : ''}`} onMouseEnter={() => setOpen(null)}>
            <OPS_NAV.icon size={15} /> Live Operations
          </NavLink>
          <NavLink to="/home" className={({ isActive }) => `nav-top ${isActive ? 'nav-top-on' : ''}`} onMouseEnter={() => setOpen(null)}>
            <HOME_NAV.icon size={15} /> Home
          </NavLink>
          <Trigger k="field" label="Field Operations" active={inField} />
          <Trigger k="well" label={`Well Analysis · ${wellId}`} active={inWell} />
          <Trigger k="info" label="Reports & Help" active={inInfo} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/alarms" className={`nav-alarm ${p1 ? 'nav-alarm-p1' : ''}`} aria-label={`${unack} unacknowledged alarms`}>
            <BellRing size={15} className={p1 ? 'pulse' : ''} />
            <span className="hidden sm:inline">Alarms</span>
            <span className="num rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-navy-900">{unack}</span>
          </Link>
          <Link to="/well/W-17" className="nav-cta hidden md:inline-flex">
            Open W-17 twin
          </Link>
        </div>
      </div>

      {/* Desktop mega menus */}
      {open && (
        <div className="mega reveal hidden lg:block" role="menu">
          <div className="mx-auto max-w-[1280px] p-4">
            {open === 'field' && (
              <>
                <MegaHead title="Field operations" sub="Whole-field views — management by exception across all 52 wells" />
                <div className="grid grid-cols-3 gap-1.5">
                  {FIELD_NAV.map((n) => (
                    <MenuLink key={n.key} item={n} wellId={wellId} />
                  ))}
                </div>
              </>
            )}
            {open === 'well' && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <MegaHead title={`Well analysis — ${wellId}`} sub="Pages follow the decision workflow: observe → diagnose → recommend → verify safety → act → learn" />
                  <WellSelect className="mb-2 ml-auto" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {WELL_NAV.map((n, i) => (
                    <MenuLink key={n.key} item={n} wellId={wellId} n={i + 1} />
                  ))}
                </div>
              </>
            )}
            {open === 'info' && (
              <>
                <MegaHead title="Reports & help" sub="Printable reports, user guide and accessibility information" />
                <div className="grid grid-cols-3 gap-1.5">
                  {INFO_NAV.map((n) => (
                    <MenuLink key={n.key} item={n} wellId={wellId} />
                  ))}
                  <MenuLink item={FIELD_NAV.find((n) => n.key === 'arch')!} wellId={wellId} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {mobile && (
        <div className="mega reveal max-h-[75vh] overflow-y-auto lg:hidden">
          <div className="p-3">
            <MenuLink item={COMMAND_NAV} wellId={wellId} />
            <MenuLink item={OPS_NAV} wellId={wellId} />
            <MenuLink item={HOME_NAV} wellId={wellId} />
            <div className="mega-sec">Field operations</div>
            {FIELD_NAV.map((n) => (
              <MenuLink key={n.key} item={n} wellId={wellId} />
            ))}
            <div className="mega-sec flex items-center">
              Well analysis <WellSelect className="ml-auto" />
            </div>
            {WELL_NAV.map((n, i) => (
              <MenuLink key={n.key} item={n} wellId={wellId} n={i + 1} />
            ))}
            <div className="mega-sec">Reports & help</div>
            {INFO_NAV.map((n) => (
              <MenuLink key={n.key} item={n} wellId={wellId} />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

function MegaHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2 px-1">
      <div className="text-[14px] font-bold tracking-wide text-navy-900 uppercase">{title}</div>
      <div className="text-[12px] text-ink-3">{sub}</div>
    </div>
  );
}
