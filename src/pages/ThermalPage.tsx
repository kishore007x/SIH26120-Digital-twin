import { useTwin } from '../store/twinStore';
import { dataSource } from '../services/dataSource';
import { ThermalChart } from '../components/thermal/ThermalChart';
import { ViscosityCurve } from '../components/thermal/ViscosityChart';
import { CSSCyclePanel } from '../components/thermal/CSSCyclePanel';
import { Badge, KV, Note, PageTitle, Panel, Prov } from '../components/common/ui';
import { ConfidenceIndicator } from '../components/intelligence/ConfidenceIndicator';
import { CRUDE, THERMAL } from '../services/modelConfig';
import { cycleForWell } from '../data/cssCycles';
import { WellThermalSection } from '../components/thermal/WellThermalSection';
import { Link } from 'react-router-dom';
import { Thermometer } from 'lucide-react';

export default function ThermalPage() {
  const wellId = useTwin((s) => s.wellId);
  const cal = useTwin((s) => s.cal);
  const h = useTwin((s) => s.h);
  const coolingDeclared = useTwin((s) => s.coolingDeclared);
  const trend = useTwin((s) => s.trend);
  const c = useTwin((s) => s.computed);
  const well = dataSource.getWell(wellId)!;
  const cycle = { ...cycleForWell(well.cssCycle, wellId), thermalState: c.thermalState === 'HOT PRODUCTION' ? ('HOT PRODUCTION' as const) : ('COOLING' as const) };
  const f = c.forecast;
  const tSig = (f.temperature.upperBound - f.temperature.lowerBound) / 2;
  const muSig = (f.viscosity.upperBound - f.viscosity.lowerBound) / 2;

  return (
    <div className="p-4">
      <PageTitle
        title={`Thermal / CSS digital twin — ${wellId}`}
        sub={
          <>
            <b>PHYSICS-INFORMED THERMAL APPROXIMATION</b> (prototype model) · T<sub>final</sub> = T<sub>physics</sub> + ML<sub>residual</sub> · observations are <Prov kind="SIMULATED" /> — not Baghewala measurements
          </>
        }
        right={
          <span className="flex items-center gap-2">
            <span className="label">Thermal state</span>
            <Badge tone={c.thermalState === 'HOT PRODUCTION' ? 'ok' : 'warn'} className="text-[12px]">
              {c.thermalState}
            </Badge>
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <CSSCyclePanel cycle={cycle} thermalState={c.thermalState} />
          <Panel title="Model definition" right={<Prov kind="CONFIGURED" />}>
            <div className="space-y-1.5 p-3 text-[11.5px] leading-snug text-ink-2">
              <div className="num rounded-[2px] bg-[#f8efe4] px-2 py-1 text-[11px]">T(t) = T_base + A·exp(−k·t)</div>
              <div>
                T_base = {THERMAL.tBase} °C (near-wellbore quasi-steady) · A = {(cal.tPlateau - THERMAL.tBase).toFixed(0)} °C · k = {THERMAL.k.toFixed(4)} h⁻¹ · reservoir {THERMAL.tReservoir} °C
              </div>
              <div className="num rounded-[2px] bg-[#f8efe4] px-2 py-1 text-[11px]">μ(T) = A·exp(B / T[K])</div>
              <div>
                A = {CRUDE.A} cP · B = {CRUDE.B} K (demonstration crude)
              </div>
              <div className="text-ink-3">ML residual: learned-shape stand-in (±{THERMAL.residualAmp} °C) for effects not captured by the physics term. Demonstration model — not a reservoir simulator.</div>
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Temperature vs time (°C)" right={<Prov kind="PREDICTED" label="Model + simulated obs." />} bodyClass="p-2">
            <ThermalChart tPlateau={cal.tPlateau} nowH={h} coolingDeclared={coolingDeclared} trend={trend} mode="temperature" />
          </Panel>
          <Panel
            title="Well thermal view — depth profile and heated zone"
            icon={<Thermometer size={13} />}
            right={
              <span className="flex items-center gap-2">
                <Link to={`/well/${wellId}?view=thermal`} className="text-[11px] font-semibold text-ind-600 underline">
                  Open in 3D
                </Link>
                <Prov kind="PREDICTED" label="Model" />
              </span>
            }
          >
            <WellThermalSection />
          </Panel>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="Viscosity vs time (cP)" right={<Prov kind="PREDICTED" />} bodyClass="p-2">
              <ThermalChart tPlateau={cal.tPlateau} nowH={h} coolingDeclared={coolingDeclared} trend={trend} mode="viscosity" height={210} />
            </Panel>
            <Panel title="Temperature–viscosity relationship" right={<Prov kind="CONFIGURED" label="Model" />} bodyClass="p-2">
              <ViscosityCurve current={c.sample.temperature} forecast={f.temperature.value} />
            </Panel>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="+24 h thermal forecast" right={<Prov kind="PREDICTED" />}>
            <div className="p-3">
              <div className="label">Temperature</div>
              <div className="num text-[26px] leading-8 font-semibold text-navy-900">
                {f.temperature.value.toFixed(0)} <span className="text-[15px] text-ink-3">± {tSig.toFixed(0)} °C</span>
              </div>
              <div className="label mt-2">Viscosity</div>
              <div className="num text-[26px] leading-8 font-semibold text-navy-900">
                {f.viscosity.value.toFixed(0)} <span className="text-[15px] text-ink-3">± {muSig.toFixed(0)} cP</span>
              </div>
              <div className="mt-3">
                <ConfidenceIndicator value={f.temperature.confidence} />
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <KV k="Current (simulated obs.)" v={`${c.sample.temperature.toFixed(1)} °C`} />
                <KV k="Current viscosity" v={`${c.sample.viscosity.toFixed(0)} cP`} />
                <KV k="Physics baseline now" v={`${c.sample.tempPhysics.toFixed(1)} °C`} />
                <KV k="ML residual now" v={`${(c.sample.tempHybrid - c.sample.tempPhysics >= 0 ? '+' : '')}${(c.sample.tempHybrid - c.sample.tempPhysics).toFixed(2)} °C`} />
              </div>
            </div>
          </Panel>
          {!coolingDeclared ? (
            <Note>Hot-production plateau. Forecast assumes the plateau persists until CSS thermal support is declared ended. Start the demo scenario to run the post-CSS decline.</Note>
          ) : !c.coolingConfirmed ? (
            <Note tone="warn">Cooling detected but not yet confirmed (needs ≥ 6 h of observed decline). Forecasts are held at plateau until confirmation to avoid false alarms.</Note>
          ) : (
            <Note tone="warn">
              <b>THERMAL STATE: COOLING.</b> Oil at the pump is becoming more viscous. This feeds the SRP load forecast and the causal analysis.
            </Note>
          )}
        </div>
      </div>
    </div>
  );
}
