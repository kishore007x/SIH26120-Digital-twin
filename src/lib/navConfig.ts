import {
  Activity,
  BellRing,
  BookOpen,
  Box,
  CalendarClock,
  CheckCircle2,
  Container,
  FileText,
  Flame,
  GitBranch,
  Gauge,
  History,
  Home,
  KeyRound,
  Map,
  Network,
  ShieldCheck,
  SignalHigh,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  short?: string;
  hi?: string; // Hindi label (shown as secondary text)
  desc: string;
  path: (wellId: string) => string;
  icon: LucideIcon;
}

export const HOME_NAV: NavItem = { key: 'home', label: 'Home', hi: 'मुख्य पृष्ठ', desc: 'Portal home, quick links and notices', path: () => '/home', icon: Home };

/** Live operations dashboard — its own top-level screen, follows the selected well. */
export const OPS_NAV: NavItem = { key: 'ops', label: 'Live Operations', hi: 'लाइव संचालन', desc: 'Dashboard of real-time trends: production, temperature, load, SPM', path: () => '/operations', icon: Activity };

export const FIELD_NAV: NavItem[] = [
  { key: 'field', label: 'Field Command Center', hi: 'क्षेत्र नियंत्रण केंद्र', desc: '3D top view of all 52 wells, exceptions today', path: () => '/field', icon: Map },
  { key: 'alarms', label: 'Alarms & Events', hi: 'अलार्म', desc: 'Prioritised P1–P3 alarms, acknowledge and shelve', path: () => '/alarms', icon: BellRing },
  { key: 'css', label: 'CSS Cycle Planner', hi: 'भाप चक्र योजना', desc: 'Re-steam dates and mobile steam generator schedule', path: () => '/css-planner', icon: CalendarClock },
  { key: 'tanks', label: 'Tanks & Evacuation', hi: 'टैंक व निकासी', desc: 'Well-site tank levels and bowser dispatch plan', path: () => '/tanks', icon: Container },
  { key: 'dq', label: 'Data Quality', hi: 'डेटा गुणवत्ता', desc: 'Sensor health matrix and data score per well', path: () => '/data-quality', icon: SignalHigh },
  { key: 'gov', label: 'Automation & Governance', hi: 'स्वचालन व शासन', desc: 'Roles, automation policy, MOC log, comms test', path: () => '/governance', icon: KeyRound },
  { key: 'arch', label: 'System Architecture', hi: 'प्रणाली संरचना', desc: 'Wellsite → edge → platform → twin → people', path: () => '/architecture', icon: Network },
];

/** Per-well pages, in the order of the decision workflow. */
export const WELL_NAV: NavItem[] = [
  { key: 'twin', label: 'Well Digital Twin', short: 'Twin', desc: '3D pumping unit from CAD, live kinematics', path: (w) => `/well/${w}`, icon: Box },
  { key: 'thermal', label: 'Thermal / CSS', short: 'Thermal', desc: 'Cooling curve, viscosity, CSS cycle', path: (w) => `/well/${w}/thermal`, icon: Flame },
  { key: 'srp', label: 'SRP Intelligence', short: 'SRP', desc: 'Dynacards, Goodman rod check, energy', path: (w) => `/well/${w}/srp`, icon: Gauge },
  { key: 'causal', label: 'Causal Analysis', short: 'Causal', desc: 'Why the risk is rising, decision authority', path: (w) => `/well/${w}/causal`, icon: GitBranch },
  { key: 'opt', label: 'Optimization', short: 'Optimize', desc: 'Recommended pump speed and trade-offs', path: (w) => `/well/${w}/optimization`, icon: SlidersHorizontal },
  { key: 'safety', label: 'Safety', desc: 'Safety gate, approve / modify / reject, RPC link', path: (w) => `/well/${w}/safety`, icon: ShieldCheck },
  { key: 'outcome', label: 'Outcome', desc: 'Predicted vs observed after the change', path: (w) => `/well/${w}/outcome`, icon: CheckCircle2 },
  { key: 'history', label: 'History / Model Trust', short: 'History', desc: 'Past recommendations and model accuracy', path: (w) => `/well/${w}/history`, icon: History },
];

export const INFO_NAV: NavItem[] = [
  { key: 'report', label: 'Shift Report', hi: 'पाली रिपोर्ट', desc: 'Printable field shift report with provenance labels', path: () => '/report', icon: FileText },
  { key: 'help', label: 'Help & User Guide', hi: 'सहायता', desc: 'How to navigate, glossary, shortcuts, accessibility', path: () => '/help', icon: BookOpen },
];

export const ALL_NAV = [HOME_NAV, OPS_NAV, ...FIELD_NAV, ...INFO_NAV];

/** Breadcrumb trail for a pathname. */
export function crumbsFor(pathname: string): { label: string; to?: string }[] {
  const home = { label: 'Home', to: '/home' };
  if (pathname === '/home' || pathname === '/') return [{ label: 'Home' }];
  const m = pathname.match(/^\/well\/([^/]+)\/?([^/]*)/);
  if (m) {
    const [, w, sub] = m;
    const page = WELL_NAV.find((n) => n.path(w) === pathname) ?? WELL_NAV.find((n) => n.path(w).endsWith('/' + sub));
    return [home, { label: 'Well analysis', to: '/field' }, { label: w, to: `/well/${w}` }, ...(page && page.key !== 'twin' ? [{ label: page.label }] : [{ label: 'Digital Twin' }])];
  }
  if (pathname === OPS_NAV.path('')) return [home, { label: OPS_NAV.label }];
  const f = FIELD_NAV.find((n) => n.path('') === pathname);
  if (f) return [home, { label: 'Field operations', to: '/field' }, { label: f.label }];
  const i = INFO_NAV.find((n) => n.path('') === pathname);
  if (i) return [home, { label: i.label }];
  return [home];
}
