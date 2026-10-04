import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Accessibility, BookOpen, Keyboard, Map, Route, ScrollText, Search } from 'lucide-react';
import { FIELD_NAV, WELL_NAV } from '../lib/navConfig';
import { useTwin } from '../store/twinStore';
import { LOW_CONFIDENCE_TEST_WELL } from '../data/wells';

const GLOSSARY: [string, string][] = [
  ['CSS', 'Cyclic steam stimulation — steam is injected into a well, it soaks, then the well produces while the reservoir slowly cools.'],
  ['SRP', 'Sucker-rod pump (“nodding donkey”) — a beam pumping unit that lifts oil with a string of steel rods.'],
  ['SPM', 'Strokes per minute — the pump speed the twin recommends changing.'],
  ['Viscosity (cP)', 'How thick the oil is. Heavy oil thickens quickly as it cools, which raises rod load.'],
  ['Rod load', 'Peak polished-rod load as a percentage of the unit rating. High load means risk of rod or gearbox failure.'],
  ['Dynacard / pump card', 'Load-versus-position plot for one stroke. Its shape shows pump problems such as pump-off or gas interference.'],
  ['Goodman check', 'API RP 11BR method to check rod fatigue from minimum and maximum rod stress.'],
  ['Pump fillage', 'How full the downhole pump barrel is on each stroke. Low fillage (pump-off) wastes energy and damages equipment.'],
  ['RPC / POC', 'Rod pump controller / pump-off controller at the wellsite. It runs locally if communications are lost.'],
  ['Confidence', 'How sure the model is. Below 85 % the action is not automated and goes to the field officer.'],
  ['MOC', 'Management of change — every change to automation policy is recorded with who, when and why.'],
  ['BOPD', 'Barrels of oil per day.'],
];

export default function HelpPage() {
  const wellId = useTwin((s) => s.wellId);
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loc.hash]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-[20px] font-bold tracking-wide text-navy-900 uppercase">Help & user guide</h1>
        <p className="text-[13px] text-ink-3">How to find your way around the portal, what the terms mean, and how the prototype handles accessibility and data.</p>
      </div>

      <nav className="glass flex flex-wrap gap-2 rounded-2xl p-3 text-[12.5px]" aria-label="On this page">
        {[
          ['start', 'Getting started'],
          ['navigate', 'Finding pages'],
          ['demo', 'Demo journeys'],
          ['glossary', 'Glossary'],
          ['shortcuts', 'Keyboard shortcuts'],
          ['accessibility', 'Accessibility'],
          ['disclaimer', 'Disclaimer'],
          ['credits', 'Image credits'],
        ].map(([id, t]) => (
          <a key={id} href={`#${id}`} className="glass-tag hover:bg-white">
            {t}
          </a>
        ))}
      </nav>

      <Card id="start" icon={<BookOpen size={18} />} title="Getting started">
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed">
          <li>
            Start at <Link to="/field" className="link">Field Command Center</Link> to see all wells from above. Wells needing attention are listed on the right.
          </li>
          <li>Click any well pin to open its <b>3D digital twin</b>. The numbered steps under the breadcrumb take you through that well’s analysis in order.</li>
          <li>
            Press <b>Start demo scenario</b> in the grey bar to watch the reservoir cool, the risk rise, and the twin recommend and apply a safe pump-speed change.
          </li>
          <li>
            Use <b>Hold</b>, <b>Reject</b> or <b>Rollback</b> at any time. In <b>Advisory</b> mode nothing is applied without an operator.
          </li>
        </ol>
      </Card>

      <Card id="navigate" icon={<Map size={18} />} title="Finding pages">
        <div className="grid grid-cols-1 gap-4 text-[13px] md:grid-cols-3">
          <div>
            <b className="text-navy-900">Top menu</b>
            <p className="mt-1 text-ink-2">Field Operations, Well Analysis and Reports & Help open a menu with every page and a one-line description.</p>
          </div>
          <div>
            <b className="text-navy-900">Breadcrumb & steps</b>
            <p className="mt-1 text-ink-2">The breadcrumb shows where you are. On well pages, steps 1–9 and the ‹ › arrows move through the workflow; the well selector switches well but keeps the page.</p>
          </div>
          <div>
            <b className="text-navy-900">
              Search <Search size={13} className="inline" />
            </b>
            <p className="mt-1 text-ink-2">Press Ctrl K (or /) anywhere and type a page or well name, e.g. “safety” or “W-19”.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="label mb-1">Field operations pages</div>
            <ul className="space-y-1 text-[12.5px]">
              {FIELD_NAV.map((n) => (
                <li key={n.key}>
                  <Link to={n.path('')} className="link font-semibold">
                    {n.label}
                  </Link>{' '}
                  — <span className="text-ink-2">{n.desc}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label mb-1">Well pages (workflow order)</div>
            <ol className="space-y-1 text-[12.5px]">
              {WELL_NAV.map((n, i) => (
                <li key={n.key}>
                  <span className="num text-ink-3">{i + 1}.</span>{' '}
                  <Link to={n.path(wellId)} className="link font-semibold">
                    {n.label}
                  </Link>{' '}
                  — <span className="text-ink-2">{n.desc}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      <Card id="demo" icon={<Route size={18} />} title="Demo journeys">
        <div className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-2">
          <div className="flow-step">
            <b className="text-navy-900">A. Safe action, fully automated (W-17)</b>
            <p className="mt-1 text-ink-2">Confidence 91 %, all safety checks pass. After an 8-second intervention window the twin sends the new speed limit to the wellsite controller. Outcome and History show predicted vs observed.</p>
            <Link to="/well/W-17?start=1" className="btn btn-primary mt-2">
              Run W-17 journey
            </Link>
          </div>
          <div className="flow-step">
            <b className="text-navy-900">B. Low confidence, officer decides ({LOW_CONFIDENCE_TEST_WELL})</b>
            <p className="mt-1 text-ink-2">The downhole gauge is offline, so confidence falls below 85 %. The action is escalated: on the Safety page the field officer can approve, modify or reject.</p>
            <Link to={`/well/${LOW_CONFIDENCE_TEST_WELL}/causal?start=1`} className="btn btn-primary mt-2">
              Run {LOW_CONFIDENCE_TEST_WELL} test case
            </Link>
          </div>
        </div>
      </Card>

      <Card id="glossary" icon={<ScrollText size={18} />} title="Glossary">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
          {GLOSSARY.map(([t, d]) => (
            <div key={t} className="rounded-lg border border-line/70 bg-white/50 px-3 py-2">
              <dt className="font-bold text-navy-900">{t}</dt>
              <dd className="text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card id="shortcuts" icon={<Keyboard size={18} />} title="Keyboard shortcuts">
        <table className="tbl max-w-[560px] text-[13px]">
          <tbody>
            {[
              ['Ctrl K  or  /', 'Open search'],
              ['↑ ↓  then  Enter', 'Choose a search result'],
              ['Esc', 'Close search or menus'],
              ['Tab', 'Move through links and buttons (focus is always visible)'],
              ['Skip to main content', 'First link on every page, for keyboard and screen-reader users'],
            ].map(([k, d]) => (
              <tr key={k}>
                <td className="w-[210px]">
                  <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[12px]">{k}</kbd>
                </td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card id="accessibility" icon={<Accessibility size={18} />} title="Accessibility statement">
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>Text size can be changed with A- / A / A+ / A++ in the top bar; the choice is remembered on this device.</li>
          <li>High-contrast mode removes transparency and blur and uses darker text and stronger borders.</li>
          <li>All pages work with the keyboard; menus close with Esc; the current page is marked for screen readers.</li>
          <li>Status is never shown by colour alone — badges also carry text (e.g. HIGH, P1, ONLINE).</li>
          <li>The layout adapts to tablets and phones; the top menu becomes a Menu button.</li>
        </ul>
      </Card>

      <Card id="disclaimer" icon={<ScrollText size={18} />} title="Disclaimer & data notice">
        <p className="text-[13px] leading-relaxed text-ink-2">
          This is a demonstration prototype. All well values are simulated from calibrated physics and machine-learning models; field counts are shown as reference values only. It is not an official system of any government body or operating company, uses no official logos or emblems, and has not been validated against field data. Setpoints are simulated and are never sent to real equipment.
        </p>
      </Card>
      <Card id="credits" icon={<ScrollText size={18} />} title="Image credits">
        <p className="mb-2 text-[13px] text-ink-2">Photographs are from Wikimedia Commons and used under their Creative Commons licences (resized only). None of them shows the Baghewala field; they illustrate the Thar Desert region and sucker-rod pumping units. Rajasthani border motifs are original drawings made for this prototype.</p>
        <ul className="space-y-1 text-[12.5px]">
          {CREDITS.map((c) => (
            <li key={c.src}>
              <a className="link" href={c.src} target="_blank" rel="noreferrer">
                {c.file}
              </a>{' '}
              — {c.author},{' '}
              <a className="link" href={c.lic} target="_blank" rel="noreferrer">
                {c.licence}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const CREDITS = [
  { file: 'Thar Desert dunes, Rajasthan (home page)', author: 'Sushmita Balasubramani', licence: 'CC BY 2.0', lic: 'https://creativecommons.org/licenses/by/2.0/', src: 'https://commons.wikimedia.org/wiki/File:Thar_desert_Rajasthan_India.jpg' },
  { file: 'Thar Desert dunes (footer)', author: 'Antoine Taveneaux', licence: 'CC BY-SA 3.0', lic: 'https://creativecommons.org/licenses/by-sa/3.0/', src: 'https://commons.wikimedia.org/wiki/File:Thar_Desert_06.jpg' },
  { file: 'Pumpjacks at sunset, Lost Hills, California (home page, illustrative)', author: 'Arne Hückelheim', licence: 'CC BY-SA 3.0', lic: 'https://creativecommons.org/licenses/by-sa/3.0/', src: 'https://commons.wikimedia.org/wiki/File:LostHillsPumpjacksSunset.JPG' },
];

function Card({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass scroll-mt-4 rounded-2xl p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold tracking-wide text-navy-900 uppercase">
        <span className="text-[#c26a1a]">{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}
