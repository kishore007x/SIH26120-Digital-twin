import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box } from 'lucide-react';
import { dataSource } from '../services/dataSource';
import { useTwin } from '../store/twinStore';
import { FieldMap } from '../components/field/FieldMap';
import { useWellDisplays } from '../components/field/useLiveWell';
import { HealthBadge, Panel, Prov, RiskBadge, Stat, StatStrip } from '../components/common/ui';
import { STATUS_COLOR, f0, loadColor } from '../lib/format';
import { PADS } from '../data/wells';

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
  const nav = useNavigate();

  const producing = wells.filter((w) => w.status === 'PRODUCING' || w.status === 'AT_RISK');
  const atRisk = producing.filter((w) => w.status === 'AT_RISK' || displays[w.id].risk === 'HIGH' || displays[w.id].risk === 'CRITICAL');
  const fieldOil = producing.reduce((a, w) => a + displays[w.id].production, 0);
  const attention = useMemo(
    () => [...atRisk].sort((a, b) => displays[b.id].rodLoad - displays[a.id].rodLoad),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atRisk.map((w) => w.id).join(), Math.round(displays[selectedId]?.rodLoad ?? 0)],
  );
  const sel = wells.find((w) => w.id === selectedId)!;
  const sd = displays[selectedId];

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-wide text-navy-900">BAGHEWALA FIELD COMMAND CENTER</h1>
          <div className="text-[12px] text-ink-3">
            Heavy-oil CSS + SRP well inventory · Field counts: <Prov kind="REFERENCE" label="Field reference / demonstration" /> · Well values: <Prov kind="SIMULATED" />
          </div>
        </div>
      </div>

      <StatStrip cols={6}>
        <Stat label="Total wells" value={ref.total} prov="REFERENCE" sub="field reference" />
        <Stat label="Producing" value={ref.producing} tone="ok" sub={`${producing.length} in demo inventory`} />
        <Stat label="Not producing" value={ref.notProducing} sub="inactive + maintenance" />
        <Stat label="At-risk" value={atRisk.length} tone={atRisk.length > 7 ? 'crit' : 'warn'} sub="predicted risk ≥ HIGH" prov="PREDICTED" />
        <Stat label="Field oil rate" value={f0(fieldOil)} unit="BOPD" sub="sum of demo wells" prov="SIMULATED" />
        <Stat label="Data mode" value={<span className="text-[13px]">DEMONSTRATION</span>} sub={dataSource.label} />
      </StatStrip>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title={view === '3d' ? 'Field overview map — top view (representative terrain)' : 'Field map — schematic well layout'}
          right={
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
              <span className="flex overflow-hidden rounded-[3px] border border-line">
                {(['3d', 'schematic'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewPersist(v)}
                    className={`px-2 py-[2px] text-[10.5px] font-semibold tracking-wide ${view === v ? 'bg-ind-600 text-white' : 'bg-white text-ink-2 hover:bg-[#f0f3f6]'}`}
                  >
                    {v === '3d' ? '3D FIELD' : 'SCHEMATIC'}
                  </button>
                ))}
              </span>
              {(['PRODUCING', 'AT_RISK', 'MAINTENANCE', 'INACTIVE'] as const).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s], outline: s === 'INACTIVE' ? '1px solid #8a939c' : undefined }} />
                  {s === 'AT_RISK' ? 'At Risk' : s[0] + s.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
          }
          bodyClass="p-1 min-h-[380px]"
        >
          {view === '3d' ? (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-[12px] text-ink-3">Loading 3D field view…</div>}>
              <FieldView3D wells={wells} displays={displays} selectedId={selectedId} />
            </Suspense>
          ) : (
            <FieldMap wells={wells} displays={displays} selectedId={selectedId} />
          )}
        </Panel>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <Panel title={`Selected well — ${sel.id}`} icon={<Box size={13} />} right={<RiskBadge risk={sd.risk} />}>
            <div className="p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <span className="text-ink-3">Production</span>
                <span className="num text-right font-semibold">{f0(sd.production)} BOPD</span>
                <span className="text-ink-3">Temperature</span>
                <span className="num text-right font-semibold">{sd.temperature.toFixed(1)} °C</span>
                <span className="text-ink-3">Viscosity</span>
                <span className="num text-right font-semibold">{f0(sd.viscosity)} cP</span>
                <span className="text-ink-3">Rod load</span>
                <span className="num text-right font-semibold" style={{ color: loadColor(sd.rodLoad) }}>
                  {f0(sd.rodLoad)} %
                </span>
                <span className="text-ink-3">Health</span>
                <span className="text-right">
                  <HealthBadge health={sd.health} />
                </span>
              </div>
              <button className="btn btn-primary mt-3 w-full justify-center" onClick={() => nav(`/well/${sel.id}`)}>
                OPEN 3D DIGITAL TWIN <ArrowRight size={14} />
              </button>
              <div className="mt-2 text-[10.5px] text-ink-3">Recommended demonstration well: W-17 (CSS-08, SRP, 10 SPM). Click any marker to open its twin.</div>
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
                </tr>
              </thead>
              <tbody>
                {attention.map((w) => (
                  <tr key={w.id} className="cursor-pointer hover:bg-[#f3f6f9]" onClick={() => nav(`/well/${w.id}`)}>
                    <td className="num font-semibold">
                      {w.id}
                      {displays[w.id].live && <span className="ml-1 text-[9px] text-ind-600">LIVE</span>}
                    </td>
                    <td className="num text-right" style={{ color: loadColor(displays[w.id].rodLoad) }}>
                      {f0(displays[w.id].rodLoad)}%
                    </td>
                    <td className="num text-right">{f0(displays[w.id].production)}</td>
                    <td>
                      <RiskBadge risk={displays[w.id].risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Pad summary" className="shrink-0" bodyClass="[&_td]:py-[3px]">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pad</th>
                  <th className="text-right">Wells</th>
                  <th className="text-right">Prod.</th>
                  <th className="text-right">BOPD</th>
                </tr>
              </thead>
              <tbody>
                {PADS.map((p) => {
                  const pw = wells.filter((w) => w.pad === p.id);
                  const pp = pw.filter((w) => w.status === 'PRODUCING' || w.status === 'AT_RISK');
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold">PAD {p.id}</td>
                      <td className="num text-right">{pw.length}</td>
                      <td className="num text-right">{pp.length}</td>
                      <td className="num text-right">{f0(pp.reduce((a, w) => a + displays[w.id].production, 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
