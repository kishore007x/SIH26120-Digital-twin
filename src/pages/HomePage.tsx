import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Bot, Brain, CheckCircle2, Eye, FlaskConical, GitBranch, Megaphone, PlayCircle, Search, ShieldCheck, Sparkles, Undo2 } from 'lucide-react';
import { useTwin } from '../store/twinStore';
import { useUiPrefs } from '../store/uiPrefs';
import { dataSource } from '../services/dataSource';
import { useFleet } from '../hooks/useFleet';
import { useAllAlarms } from './AlarmsPage';
import { useWellDisplays } from '../components/field/useLiveWell';
import { FIELD_NAV, INFO_NAV, WELL_NAV } from '../lib/navConfig';
import { LOW_CONFIDENCE_TEST_WELL } from '../data/wells';
import { f0, fmtDateTime } from '../lib/format';

/** Photographic hero background — Thar Desert, Rajasthan (CC BY 2.0; see /img/CREDITS.md). */
function HeroPhoto() {
  return (
    <>
      <img src="/img/thar-dunes.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: 'center 62%' }} />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(43,14,9,0.82)_0%,rgba(90,33,18,0.55)_45%,rgba(168,64,26,0.15)_100%)]" />
      <span className="absolute right-3 bottom-2 rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/85">
        Thar Desert, Rajasthan — illustrative photo, not the Baghewala field · S. Balasubramani, CC BY 2.0
      </span>
    </>
  );
}

const FLOW = [
  { icon: Eye, t: 'Observe', d: 'Live temperature, load, speed and tank data from every well' },
  { icon: Brain, t: 'Diagnose', d: 'Physics + ML: cooling → viscosity → rod load; pump-card diagnosis' },
  { icon: Sparkles, t: 'Recommend', d: 'Safest pump speed that protects rods and keeps oil flowing' },
  { icon: ShieldCheck, t: 'Safety gate', d: '10 checks incl. Goodman rod fatigue and worst case' },
  { icon: Bot, t: 'Act', d: 'Auto-execute when safe and confident; otherwise the officer decides' },
  { icon: Undo2, t: 'Learn', d: 'Compare predicted vs observed, one-click rollback, model trust' },
];

export default function HomePage() {
  const nav = useNavigate();
  const wellId = useTwin((s) => s.wellId);
  const mode = useTwin((s) => s.controlMode);
  const events = useTwin((s) => s.events);
  const openPalette = useUiPrefs((s) => s.setPaletteOpen);
  const wells = dataSource.listWells();
  const ref = dataSource.fieldReference();
  const displays = useWellDisplays(wells);
  const fleet = useFleet();
  const alarms = useAllAlarms();
  const producing = wells.filter((w) => w.status === 'PRODUCING' || w.status === 'AT_RISK');
  const fieldOil = producing.reduce((a, w) => a + displays[w.id].production, 0);
  const atRisk = producing.filter((w) => w.status === 'AT_RISK' || displays[w.id].risk === 'HIGH' || displays[w.id].risk === 'CRITICAL').length;
  const unack = alarms.filter((a) => a.state === 'UNACK').length;
  const p1 = alarms.filter((a) => a.state === 'UNACK' && a.priority === 'P1').length;
  const resteam = fleet.ops.filter((o) => o.cycle.status === 'OVERDUE' || o.cycle.status === 'DUE').length;
  const tanksHigh = fleet.ops.filter((o) => o.tank && o.tank.levelPct >= 80).length;

  const notices = [
    ...alarms
      .filter((a) => a.state === 'UNACK' && a.priority !== 'P3')
      .slice(0, 4)
      .map((a) => ({ tone: a.priority === 'P1' ? 'crit' : 'warn', text: `${a.wellId}: ${a.message}`, to: '/alarms', time: a.raisedAt })),
    ...events
      .slice(-3)
      .reverse()
      .map((e) => ({ tone: e.level === 'warn' ? 'warn' : e.level === 'ok' ? 'ok' : 'info', text: `${wellId}: ${e.text}`, to: '/operations', time: e.time })),
    {
      tone: 'info',
      text: `Test case available: ${LOW_CONFIDENCE_TEST_WELL} has a failed downhole gauge — confidence below 85 %, so the field officer must decide.`,
      to: `/well/${LOW_CONFIDENCE_TEST_WELL}/causal`,
      time: 0,
    },
  ];

  const kpis = [
    { label: 'Producing wells', value: `${ref.producing}`, sub: `of ${ref.total} in field reference`, to: '/field' },
    { label: 'Field oil rate', value: f0(fieldOil), unit: 'BOPD', sub: 'demo wells, simulated', to: '/field' },
    { label: 'Wells at risk', value: `${atRisk}`, sub: 'predicted risk ≥ HIGH', to: '/field', tone: atRisk ? 'warn' : 'ok' },
    { label: 'Open alarms', value: `${unack}`, sub: p1 ? `${p1} critical (P1)` : 'no critical alarm', to: '/alarms', tone: p1 ? 'crit' : unack ? 'warn' : 'ok' },
    { label: 'Re-steam due', value: `${resteam}`, sub: 'overdue or ≤ 10 days', to: '/css-planner', tone: resteam ? 'warn' : 'ok' },
    { label: 'Tanks ≥ 80 %', value: `${tanksHigh}`, sub: 'need bowser pickup', to: '/tanks', tone: tanksHigh ? 'warn' : 'ok' },
  ] as const;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl shadow-[0_20px_50px_-20px_rgba(43,14,9,0.6)]">
        <HeroPhoto />
        <div className="relative grid gap-5 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="glass-dark rounded-2xl p-5 sm:p-6">
            <div className="font-hi text-[14px] text-[#f3c77a]" lang="hi">
              भारी तेल कुओं के लिए डिजिटल ट्विन — सुरक्षित, स्वचालित, पारदर्शी
            </div>
            <h1 className="mt-1 text-[26px] leading-tight font-bold text-white sm:text-[32px]">Heavy-oil well digital twin for the Baghewala field</h1>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[#f6ebdd]">
              Watch every CSS + sucker-rod-pump well, see <b>why</b> a pump is at risk as the reservoir cools, and apply a <b>safety-checked</b> pump-speed change automatically — with the field
              officer in control whenever the system is unsure.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/field" className="btn btn-primary btn-lg">
                Field Command Center <ArrowRight size={15} />
              </Link>
              <button className="btn btn-glass btn-lg" onClick={() => nav('/well/W-17?start=1')}>
                <PlayCircle size={15} /> Run demo on W-17
              </button>
              <button className="btn btn-glass btn-lg" onClick={() => nav(`/well/${LOW_CONFIDENCE_TEST_WELL}/causal?start=1`)}>
                <FlaskConical size={15} /> Low-confidence test ({LOW_CONFIDENCE_TEST_WELL})
              </button>
            </div>
            <button
              onClick={() => openPalette(true)}
              className="mt-4 flex w-full max-w-[520px] items-center gap-2 rounded-xl border border-white/25 bg-white/12 px-3 py-2.5 text-left text-[13px] text-[#f6ebdd] backdrop-blur hover:bg-white/20"
            >
              <Search size={16} /> Search any page or well…
              <kbd className="ml-auto rounded border border-white/30 px-1.5 text-[11px]">Ctrl K</kbd>
            </button>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.1em] text-navy-900 uppercase">
              <Megaphone size={15} className="text-[#c26a1a]" /> Notice board
              <span className="ml-auto rounded-full bg-navy-900 px-2 py-0.5 text-[10.5px] tracking-normal text-white">{mode === 'AUTO' ? 'AUTO · SUPERVISED' : 'ADVISORY'}</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {notices.slice(0, 6).map((n, i) => (
                <li key={i}>
                  <Link to={n.to} className="notice">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.tone === 'crit' ? 'pulse bg-crit' : n.tone === 'warn' ? 'bg-warn' : n.tone === 'ok' ? 'bg-ok' : 'bg-ind-500'}`} />
                    <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">{n.text}</span>
                    {n.time > 0 && <span className="num shrink-0 text-[10.5px] text-ink-3">{fmtDateTime(n.time)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/alarms" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-ind-600 hover:underline">
              <Bell size={13} /> All alarms & events <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section aria-label="Field at a glance" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="glass kpi-card">
            <span className="label">{k.label}</span>
            <span className={`num mt-1 text-[26px] leading-none font-bold ${'tone' in k && k.tone === 'crit' ? 'text-crit' : 'tone' in k && k.tone === 'warn' ? 'text-warn' : 'text-navy-900'}`}>
              {k.value}
              {'unit' in k && <span className="ml-1 text-[12px] font-semibold text-ink-3">{k.unit}</span>}
            </span>
            <span className="mt-1 text-[11.5px] text-ink-3">{k.sub}</span>
          </Link>
        ))}
      </section>

      {/* How it works */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <figure className="relative min-h-[220px] overflow-hidden rounded-2xl shadow-[0_18px_40px_-20px_rgba(43,14,9,0.6)]">
          <img src="/img/pumpjacks-sunset.jpg" alt="Sucker-rod pumping units silhouetted at sunset" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(43,14,9,0.85)] via-transparent to-transparent" />
          <figcaption className="absolute right-0 bottom-0 left-0 p-3 text-white">
            <div className="text-[14px] font-bold">Sucker-rod pumping — the lift behind CSS heavy oil</div>
            <div className="mt-0.5 text-[10.5px] text-white/80">Illustrative photo (Lost Hills, California) · A. Hückelheim, CC BY-SA 3.0</div>
          </figcaption>
        </figure>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <SectionHead title="How the twin decides" sub="Every recommendation goes through the same six steps — and every step has its own page." />
          <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {FLOW.map((f, i) => (
              <li key={f.t} className="flow-step">
                <span className="flex items-center gap-2">
                  <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-[12px] font-bold text-white">{i + 1}</span>
                  <f.icon size={17} className="text-[#c26a1a]" />
                  <b className="text-[13.5px] text-navy-900">{f.t}</b>
                </span>
                <span className="mt-1.5 block text-[12px] leading-snug text-ink-2">{f.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Services */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="glass rounded-2xl p-4 sm:p-5">
          <SectionHead title="Field operations" sub="Whole-field pages" hi="क्षेत्र संचालन" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...FIELD_NAV, ...INFO_NAV].map((n) => (
              <Tile key={n.key} to={n.path('')} icon={<n.icon size={19} />} title={n.label} desc={n.desc} />
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <SectionHead title={`Well analysis — ${wellId}`} sub="Per-well pages in workflow order" hi="कुआँ विश्लेषण" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WELL_NAV.map((n, i) => (
              <Tile key={n.key} to={n.path(wellId)} icon={<span className="num text-[14px] font-bold">{i + 1}</span>} title={n.label} desc={n.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* Safeguards */}
      <section className="glass rounded-2xl p-4 sm:p-5">
        <SectionHead title="Built-in safeguards" sub="What keeps automation safe and honest" />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: ShieldCheck, t: 'Safety gate before any change', d: 'Structure, gearbox, rod Goodman fatigue, pump-off and worst-case checks must all pass.' },
            { i: GitBranch, t: 'Confidence threshold', d: 'Below 85 % model confidence (e.g. a failed sensor) the action is escalated to the field officer.' },
            { i: Undo2, t: 'Hold, reject, rollback', d: 'An operator can stop the countdown, reject the action, or roll a change back at any time.' },
            { i: CheckCircle2, t: 'Clear data labels', d: 'Every value is tagged as simulated, predicted, configured or reference. No real field data is claimed.' },
          ].map((g) => (
            <div key={g.t} className="flow-step">
              <g.i size={18} className="text-ok" />
              <b className="mt-1 block text-[13px] text-navy-900">{g.t}</b>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{g.d}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, sub, hi }: { title: string; sub: string; hi?: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-bold tracking-wide text-navy-900 uppercase">
        {title}
        {hi && (
          <span className="font-hi ml-2 text-[12.5px] font-medium tracking-normal text-[#a8561a] normal-case" lang="hi">
            {hi}
          </span>
        )}
      </h2>
      <p className="text-[12.5px] text-ink-3">{sub}</p>
    </div>
  );
}

function Tile({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="tile">
      <span className="tile-ico">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-navy-900">{title}</span>
        <span className="block text-[12px] leading-snug text-ink-3">{desc}</span>
      </span>
      <ArrowRight size={15} className="tile-arrow ml-auto shrink-0" />
    </Link>
  );
}
