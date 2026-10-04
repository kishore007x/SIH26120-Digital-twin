import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box, Flame, GitBranch, Crosshair } from 'lucide-react';
import { dataSource } from '../services/dataSource';
import { useTwin } from '../store/twinStore';
import { FieldMap } from '../components/field/FieldMap';
import { useWellDisplays } from '../components/field/useLiveWell';
import { HealthBadge, Panel, Prov, RiskBadge } from '../components/common/ui';
import { STATUS_COLOR, STATUS_LABEL, f0, loadColor } from '../lib/format';
import { ExceptionsPanel } from '../components/field/ExceptionsPanel';

// Three.js field view is code-split so the command center loads quickly.
const FieldView3D = lazy(() => import('../components/field3d/FieldView3D'));

export default function FieldPage() {
  const [view, setView] = useState<'3d' | 'schematic'>(() => {
    try {
      return localStorage.getItem('field.view') === 'schematic' ? 'schematic' : '3d';
    } catch {
      return '3d';
    }
  });
  const setViewPersist = (v: '3d' | 'schematic') => {
    setView(v);
    try {
      localStorage.setItem('field.view', v);
    } catch {
      /* storage unavailable */
    }
  };
  const wells = dataSource.listWells();
  const ref = dataSource.fieldReference();
  const displays = useWellDisplays(wells);
  const selectedId = useTwin((s) => s.wellId);
  // the map is fully controllable in place: clicking a well focuses it here; opening the twin is explicit
  const [focusId, setFocusId] = useState<string | null>(selectedId);
  const nav = useNavigate();

  const producing = wells.filter((w) => w.status === 'PRODUCING' || w.status === 'AT_RISK');
  const atRisk = producing.filter((w) => w.status === 'AT_RISK' || displays[w.id].risk === 'HIGH' || displays[w.id].risk === 'CRITICAL');
  const fieldOil = producing.reduce((a, w) => a + displays[w.id].production, 0);
  const attention = useMemo(
    () => [...atRisk].sort((a, b) => displays[b.id].rodLoad - displays[a.id].rodLoad),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atRisk.map((w) => w.id).join(), Math.round(displays[selectedId]?.rodLoad ?? 0)],
  );
  const shownId = focusId ?? selectedId;
  const sel = wells.find((w) => w.id === shownId)!;
  const sd = displays[shownId];
  const selProducing = sel.status === 'PRODUCING' || sel.status === 'AT_RISK';

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-2.5 p-3">
      {/* compact header: the 3D map is the main screen, KPIs ride along in one line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[17px] leading-tight font-bold tracking-wide text-navy-900">BAGHEWALA FIELD COMMAND CENTER</h1>
          <div className="text-[11.5px] text-ink-3">
            Heavy-oil CSS + SRP · Field counts: <Prov kind="REFERENCE" label="Field reference / demonstration" /> · Well values: <Prov kind="SIMULATED" /> · {dataSource.label}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-stretch gap-1.5">
          <Kpi label="Total wells" value={ref.total} />
          <Kpi label="Producing" value={ref.producing} tone="ok" title={`${ref.notProducing} not producing (inactive + maintenance)`} />
          <Kpi label="At risk" value={atRisk.length} tone={atRisk.length > 7 ? 'crit' : atRisk.length ? 'warn' : 'ok'} title="Predicted risk ≥ HIGH" />
          <Kpi label="Field oil" value={f0(fieldOil)} unit="BOPD" title="Sum of demo wells (simulated)" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title={view === '3d' ? 'Field overview — interactive 3D map' : 'Field map — schematic well layout'}
          right={
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
              <span className="flex overflow-hidden rounded-lg border border-line">
                {(['3d', 'schematic'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewPersist(v)}
                    aria-pressed={view === v}
                    className={`px-2.5 py-[3px] text-[11px] font-semibold tracking-wide ${view === v ? 'bg-ind-600 text-white' : 'bg-white text-ink-2 hover:bg-[#f7eee3]'}`}
                  >
                    {v === '3d' ? '3D MAP' : 'SCHEMATIC'}
                  </button>
                ))}
              </span>
              {(['PRODUCING', 'AT_RISK', 'MAINTENANCE', 'INACTIVE'] as const).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s], outline: s === 'INACTIVE' ? '1px solid #8a939c' : undefined }} />
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          }
          bodyClass="p-1 min-h-[460px]"
        >
          {view === '3d' ? (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-[12px] text-ink-3">Loading 3D field view…</div>}>
              <FieldView3D wells={wells} displays={displays} selectedId={selectedId} focusId={focusId} onFocus={setFocusId} />
            </Suspense>
          ) : (
            <FieldMap wells={wells} displays={displays} selectedId={selectedId} focusId={focusId} onFocus={setFocusId} />
          )}
        </Panel>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
          <Panel title={`Focused well — ${sel.id}`} icon={<Box size={13} />} right={selProducing ? <RiskBadge risk={sd.risk} /> : <span className="text-[11px] font-semibold text-ink-3">{STATUS_LABEL[sel.status]}</span>}>
            <div className="p-3">
              {selProducing ? (
                <div className="grid grid-cols-2 gap-2">
                  <Tile label="Oil rate" value={f0(sd.production)} unit="BOPD" />
                  <Tile label="Rod load" value={f0(sd.rodLoad)} unit="%" color={loadColor(sd.rodLoad)} bar={sd.rodLoad} />
                  <Tile label="Temperature" value={sd.temperature.toFixed(1)} unit="°C" />
                  <Tile label="Viscosity" value={f0(sd.viscosity)} unit="cP" />
                </div>
              ) : (
                <div className="rounded-lg border border-line bg-white/60 p-3 text-[12px] text-ink-2">
                  {sel.status === 'MAINTENANCE' ? 'Workover in progress — no live production values.' : 'Well not producing — no live production values.'}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-[12px]">
                <span className="text-ink-3">Health</span>
                <HealthBadge health={sd.health} />
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-1.5">
                <button className="btn btn-primary justify-center" onClick={() => nav(`/well/${sel.id}`)}>
                  OPEN 3D TWIN <ArrowRight size={14} />
                </button>
                <button className="btn" onClick={() => nav(`/well/${sel.id}?view=thermal`)} title="Thermal view" aria-label="Thermal view">
                  <Flame size={14} />
                </button>
                <button className="btn" onClick={() => nav(`/well/${sel.id}/causal`)} title="Causal analysis" aria-label="Causal analysis">
                  <GitBranch size={14} />
                </button>
              </div>
              <div className="mt-2 text-[11px] leading-snug text-ink-3">Click a pin — or simply fly the camera close to a well — to focus it here; double-click opens its twin. Keys: arrows/WASD move, +/− zoom, Q/E rotate.</div>
            </div>
          </Panel>

          <Panel title="Wells requiring attention" right={<Prov kind="PREDICTED" />} className="min-h-[200px] flex-1" bodyClass="overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Well</th>
                  <th className="text-right">Load</th>
                  <th className="text-right">Oil</th>
                  <th>Risk</th>
                  <th className="w-8">
                    <span className="sr-only">Focus</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {attention.map((w) => (
                  <tr key={w.id} className={`cursor-pointer hover:bg-white/80 ${w.id === shownId ? 'bg-[#fff3dc]' : ''}`} onClick={() => setFocusId(w.id)} onDoubleClick={() => nav(`/well/${w.id}`)}>
                    <td className="num font-semibold">
                      {w.id}
                      {displays[w.id].live && <span className="ml-1 text-[9px] text-ind-600">LIVE</span>}
                    </td>
                    <td className="num text-right font-semibold" style={{ color: loadColor(displays[w.id].rodLoad) }}>
                      {f0(displays[w.id].rodLoad)}%
                    </td>
                    <td className="num text-right">{f0(displays[w.id].production)}</td>
                    <td>
                      <RiskBadge risk={displays[w.id].risk} />
                    </td>
                    <td>
                      <button
                        className="rounded p-1 text-ind-600 hover:bg-white"
                        aria-label={`Focus ${w.id} on the map`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusId(w.id);
                        }}
                      >
                        <Crosshair size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <ExceptionsPanel />
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, unit, color, bar }: { label: string; value: string; unit: string; color?: string; bar?: number }) {
  return (
    <div className="rounded-xl border border-line/70 bg-white/70 px-3 py-2">
      <div className="label">{label}</div>
      <div className="num mt-0.5 text-[22px] leading-7 font-bold" style={{ color: color ?? '#3f160e' }}>
        {value}
        <span className="ml-1 text-[12px] font-medium text-ink-3">{unit}</span>
      </div>
      {bar !== undefined && (
        <div className="mt-1 h-1.5 rounded-full bg-[#eee2d3]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, bar)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, tone, title }: { label: string; value: React.ReactNode; unit?: string; tone?: 'ok' | 'warn' | 'crit'; title?: string }) {
  const color = tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-navy-900';
  return (
    <div className="panel flex items-baseline gap-1.5 px-3 py-1.5" title={title}>
      <span className="label leading-none">{label}</span>
      <span className={`num text-[18px] leading-none font-bold ${color}`}>{value}</span>
      {unit && <span className="text-[11px] text-ink-3">{unit}</span>}
    </div>
  );
}
