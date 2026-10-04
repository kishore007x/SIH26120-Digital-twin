import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header, UtilityBar } from './components/layout/Header';
import { MainNav } from './components/layout/MainNav';
import { PageBar } from './components/layout/PageBar';
import { Footer } from './components/layout/Footer';
import { CommandPalette } from './components/layout/CommandPalette';
import { useUiPrefs } from './store/uiPrefs';
import HomePage from './pages/HomePage';
import { ScenarioBar } from './components/layout/ScenarioBar';
import { useTwin } from './store/twinStore';
import { dataSource } from './services/dataSource';
import { Note } from './components/common/ui';

// 3D page is code-split so the rest of the application loads without Three.js.
const TwinPage = lazy(() => import('./pages/TwinPage'));

// Every other page except Home is code-split too (first load ships only the shell + Home);
// Prefetch3D warms all of them on idle so navigating, and scenario auto-follow, stay instant.
const PAGE_LOADERS = {
  ReportPage: () => import('./pages/ReportPage'),
  HelpPage: () => import('./pages/HelpPage'),
  FieldPage: () => import('./pages/FieldPage'),
  OperationsPage: () => import('./pages/OperationsPage'),
  ThermalPage: () => import('./pages/ThermalPage'),
  SrpPage: () => import('./pages/SrpPage'),
  CausalPage: () => import('./pages/CausalPage'),
  OptimizationPage: () => import('./pages/OptimizationPage'),
  SafetyPage: () => import('./pages/SafetyPage'),
  OutcomePage: () => import('./pages/OutcomePage'),
  HistoryPage: () => import('./pages/HistoryPage'),
  AlarmsPage: () => import('./pages/AlarmsPage'),
  CssPlannerPage: () => import('./pages/CssPlannerPage'),
  TanksPage: () => import('./pages/TanksPage'),
  DataQualityPage: () => import('./pages/DataQualityPage'),
  GovernancePage: () => import('./pages/GovernancePage'),
  ArchitecturePage: () => import('./pages/ArchitecturePage'),
};
const ReportPage = lazy(PAGE_LOADERS.ReportPage);
const HelpPage = lazy(PAGE_LOADERS.HelpPage);
const FieldPage = lazy(PAGE_LOADERS.FieldPage);
const OperationsPage = lazy(PAGE_LOADERS.OperationsPage);
const ThermalPage = lazy(PAGE_LOADERS.ThermalPage);
const SrpPage = lazy(PAGE_LOADERS.SrpPage);
const CausalPage = lazy(PAGE_LOADERS.CausalPage);
const OptimizationPage = lazy(PAGE_LOADERS.OptimizationPage);
const SafetyPage = lazy(PAGE_LOADERS.SafetyPage);
const OutcomePage = lazy(PAGE_LOADERS.OutcomePage);
const HistoryPage = lazy(PAGE_LOADERS.HistoryPage);
const AlarmsPage = lazy(PAGE_LOADERS.AlarmsPage);
const CssPlannerPage = lazy(PAGE_LOADERS.CssPlannerPage);
const TanksPage = lazy(PAGE_LOADERS.TanksPage);
const DataQualityPage = lazy(PAGE_LOADERS.DataQualityPage);
const GovernancePage = lazy(PAGE_LOADERS.GovernancePage);
const ArchitecturePage = lazy(PAGE_LOADERS.ArchitecturePage);

/** Warm the 3D code and field-map assets in the background so opening them feels instant. */
function Prefetch3D() {
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    idle(
      () => {
        Object.values(PAGE_LOADERS).forEach((load) => load());
        import('./components/field3d/FieldView3D');
        import('./pages/TwinPage');
        for (const href of ['/img/field-albedo.jpg', '/data/field-vegetation.json', '/models/srp-pump.glb?v=2']) {
          const l = document.createElement('link');
          l.rel = 'prefetch';
          l.href = href;
          document.head.appendChild(l);
        }
      },
      { timeout: 3000 },
    );
  }, []);
  return null;
}

function SimulationDriver() {
  const tick = useTwin((s) => s.tick);
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // Keep scenario timing tied to wall-clock even if rendering delays ticks (cap guards tab sleep).
      const dt = Math.min(2.5, (now - last) / 1000);
      last = now;
      tick(dt);
    }, 200);
    return () => window.clearInterval(id);
  }, [tick]);
  return null;
}

/** Follows scenario phases to the relevant page when auto-follow is on. */
function NavFollower() {
  const navTarget = useTwin((s) => s.navTarget);
  const nav = useNavigate();
  const loc = useLocation();
  const lastSeq = useRef(0);
  useEffect(() => {
    if (!navTarget || navTarget.seq === lastSeq.current) return;
    lastSeq.current = navTarget.seq;
    if (loc.pathname !== navTarget.path) nav(navTarget.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTarget]);
  return null;
}

function WellScope() {
  const { wellId } = useParams();
  const selectWell = useTwin((s) => s.selectWell);
  const current = useTwin((s) => s.wellId);
  const well = dataSource.getWell(wellId ?? '');
  const [params, setParams] = useSearchParams();
  const startScenario = useTwin((s) => s.startScenario);
  useEffect(() => {
    if (well && wellId && wellId !== current) selectWell(wellId);
  }, [well, wellId, current, selectWell]);
  // ?start=1 → launch the demo scenario on this well (used by the test-case button)
  useEffect(() => {
    if (params.get('start') === '1' && wellId === current) {
      setParams({}, { replace: true });
      startScenario();
    }
  }, [params, wellId, current, setParams, startScenario]);
  if (!well)
    return (
      <div className="p-6">
        <Note tone="warn">
          Well “{wellId}” is not in the demonstration inventory. Return to the <a className="underline" href="/field">Field Command Center</a>.
        </Note>
      </div>
    );
  if (wellId !== current) return null;
  return <Outlet />;
}

const NO_SCENARIO_BAR = ['/home', '/help', '/report'];
/** Full-screen pages: the field map and the 3D twin take exactly one screen height. */
const FILL_ROUTE = /^\/(field|well\/[^/]+)\/?$/;

function Shell() {
  const loc = useLocation();
  const fontScale = useUiPrefs((s) => s.fontScale);
  const contrast = useUiPrefs((s) => s.contrast);
  const scrollRef = useRef<HTMLDivElement>(null);
  // new page → start at the top (hash links keep their own anchor)
  useEffect(() => {
    if (!loc.hash) scrollRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);
  useEffect(() => {
    document.documentElement.dataset.contrast = contrast;
  }, [contrast]);
  return (
    // One scroll for the whole site: the header, scenario bar and breadcrumbs scroll away with each
    // page, only the slim main menu stays pinned. Map / 3D pages then fill the screen below it.
    <div ref={scrollRef} id="app-scroll" className="app-bg h-full overflow-x-hidden overflow-y-auto">
      <UtilityBar />
      <Header />
      <MainNav />
      <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-col outline-none">
        {!NO_SCENARIO_BAR.includes(loc.pathname) && <ScenarioBar />}
        <PageBar />
        <div
          className="page-body"
          style={{
            zoom: fontScale,
            // sizes are divided by the text zoom so the page is exactly one screen (below the pinned menu)
            [FILL_ROUTE.test(loc.pathname) ? 'height' : 'minHeight']: `calc((100dvh - var(--nav-h)) / ${fontScale})`,
          }}
        >
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      <CommandPalette />
      <SimulationDriver />
      <NavFollower />
      <Prefetch3D />
    </div>
  );
}

function PageLoading() {
  return <div className="flex flex-1 items-center justify-center p-8 text-ink-3 label">Loading…</div>;
}

function Loading3D() {
  return (
    <div className="flex h-full items-center justify-center text-ink-3">
      <div className="text-center">
        <div className="label">Loading 3D digital twin…</div>
        <div className="mt-1 text-[11px]">Initialising WebGL viewport</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/field" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/field" element={<FieldPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/alarms" element={<AlarmsPage />} />
          <Route path="/css-planner" element={<CssPlannerPage />} />
          <Route path="/tanks" element={<TanksPage />} />
          <Route path="/data-quality" element={<DataQualityPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/well/:wellId" element={<WellScope />}>
            <Route
              index
              element={
                <Suspense fallback={<Loading3D />}>
                  <TwinPage />
                </Suspense>
              }
            />
            <Route path="operations" element={<Navigate to="/operations" replace />} />
            <Route path="thermal" element={<ThermalPage />} />
            <Route path="srp" element={<SrpPage />} />
            <Route path="causal" element={<CausalPage />} />
            <Route path="optimization" element={<OptimizationPage />} />
            <Route path="safety" element={<SafetyPage />} />
            <Route path="outcome" element={<OutcomePage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/field" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
