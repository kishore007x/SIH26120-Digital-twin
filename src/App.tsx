import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ScenarioBar } from './components/layout/ScenarioBar';
import { useTwin } from './store/twinStore';
import { dataSource } from './services/dataSource';
import FieldPage from './pages/FieldPage';
import OperationsPage from './pages/OperationsPage';
import ThermalPage from './pages/ThermalPage';
import SrpPage from './pages/SrpPage';
import CausalPage from './pages/CausalPage';
import OptimizationPage from './pages/OptimizationPage';
import SafetyPage from './pages/SafetyPage';
import OutcomePage from './pages/OutcomePage';
import HistoryPage from './pages/HistoryPage';
import { Note } from './components/common/ui';

// 3D page is code-split so the rest of the application loads without Three.js.
const TwinPage = lazy(() => import('./pages/TwinPage'));

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

function Shell() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <ScenarioBar />
          <div className="min-h-0 flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <SimulationDriver />
      <NavFollower />
    </div>
  );
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
          <Route path="/field" element={<FieldPage />} />
          <Route path="/well/:wellId" element={<WellScope />}>
            <Route
              index
              element={
                <Suspense fallback={<Loading3D />}>
                  <TwinPage />
                </Suspense>
              }
            />
            <Route path="operations" element={<OperationsPage />} />
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
