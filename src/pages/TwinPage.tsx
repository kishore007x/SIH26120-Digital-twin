import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, Camera, Eye, Mountain, Pause, Play, RotateCcw, Scissors, Tag, AlertTriangle, Cpu, Sparkles, Thermometer } from 'lucide-react';
import { DigitalTwinModelViewer, CAMERA_PRESETS, type CameraPreset, type ViewMode } from '../components/twin/DigitalTwinModelViewer';
import { useModelSource, hasWebGL } from '../components/twin/models/modelLoader';
import { rig, type ComponentKey } from '../components/twin/rig';
import type { SelectionCtx } from '../components/twin/selection';
import { ComponentInspector } from '../components/twin/ComponentInspector';
import { CycleIndicator } from '../components/twin/CycleIndicator';
import { TwinFallback2D } from '../components/twin/TwinFallback2D';
import { useTwin } from '../store/twinStore';
import { HealthBadge, KV, Panel, Prov, RiskBadge } from '../components/common/ui';
import { healthTone, loadColor, riskTone } from '../lib/format';
import { SAFETY_LIMITS } from '../services/modelConfig';
import { THERMAL_GRADIENT_CSS, THERMAL_SCALE, fluidTemperature } from '../services/thermalProfile';

const SURFACE_PRESETS: CameraPreset[] = ['iso', 'side', 'front', 'top'];
const UNDER_PRESETS: CameraPreset[] = ['section', 'downhole', 'pump'];

function WellInfoPanel() {
  const wellId = useTwin((s) => s.wellId);
  const c = useTwin((s) => s.computed);
  const x = c.sample;
  return (
    <Panel title={`Well ${wellId}`} right={<Prov kind="SIMULATED" label="Simulated observation" />}>
      <div className="px-3 py-1.5">
        <KV k="Production" v={x.oil.toFixed(0)} unit="BOPD" />
        <KV k="Temperature" v={x.temperature.toFixed(1)} unit="°C" sub={c.thermalState} />
        <KV k="Viscosity" v={x.viscosity.toFixed(0)} unit="cP" />
        <KV k="SPM" v={x.spm.toFixed(1)} unit="strokes/min" />
        <KV k="Stroke" v={x.stroke.toFixed(1)} unit="m" />
        <KV k="VFD" v={x.vfd.toFixed(0)} unit="Hz" />
        <KV k="Rod load" v={<span style={{ color: loadColor(x.rodLoad) }}>{x.rodLoad.toFixed(0)}</span>} unit="%" sub={<span>+24 h forecast {c.forecast.rodLoadCurrentSpm.value.toFixed(0)}%</span>} />
        <KV k="Pump efficiency" v={x.pumpEfficiency.toFixed(0)} unit="%" />
        <div className="flex items-center justify-between border-b border-[#f3eadf] py-[5px]">
          <span className="text-[12px] text-ink-2">Well health</span>
          <HealthBadge health={c.health} />
        </div>
        <div className="flex items-center justify-between py-[5px]">
          <span className="text-[12px] text-ink-2">Risk (current / +24 h)</span>
          <span className="flex gap-1">
            <RiskBadge risk={c.currentRisk} />
            <RiskBadge risk={c.forecast.riskCurrentSpm} />
          </span>
        </div>
      </div>
    </Panel>
  );
}

function PumpControls() {
  const playing = useTwin((s) => s.animationPlaying);
  const toggle = useTwin((s) => s.toggleAnimation);
  const spm = useTwin((s) => s.spm);
  const spmTarget = useTwin((s) => s.spmTarget);
  const status = useTwin((s) => s.scenario.status);
  const setWhatIf = useTwin((s) => s.setWhatIfSpm);
  const locked = status === 'RUNNING' || status === 'AWAITING' || status === 'PAUSED';
  return (
    <Panel title="Pumping animation & SPM">
      <div className="space-y-2.5 p-3">
        <div className="flex gap-1.5">
          <button className="btn flex-1 justify-center" onClick={toggle}>
            {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'PAUSE' : 'PLAY'}
          </button>
          <button
            className="btn flex-1 justify-center"
            onClick={() => {
              rig.resetRequested = true;
            }}
            title="Return rods to bottom of stroke"
          >
            <RotateCcw size={13} /> RESET
          </button>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">SPM setpoint (what-if)</span>
            <span className="num text-[13px] font-semibold">
              {spm.toFixed(1)}
              {Math.abs(spmTarget - spm) > 0.05 && <span className="text-ink-3"> → {spmTarget.toFixed(1)}</span>}
            </span>
          </div>
          <input
            type="range"
            min={SAFETY_LIMITS.minSpm}
            max={SAFETY_LIMITS.maxSpm}
            step={0.5}
            value={spmTarget}
            disabled={locked}
            onChange={(e) => setWhatIf(Number(e.target.value))}
            className="mt-1 w-full"
            aria-label="SPM what-if setpoint"
          />
          <div className="flex justify-between text-[10px] text-ink-3">
            <span>{SAFETY_LIMITS.minSpm}</span>
            <span>envelope (configured)</span>
            <span>{SAFETY_LIMITS.maxSpm}</span>
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
            {locked
              ? 'Locked while the demo scenario runs — SPM changes only through the recommendation → safety gate → supervised automation / operator path.'
              : 'Simulation input only (not a control action). Observe animation speed, rod load and fillage respond.'}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default function TwinPage() {
  const source = useModelSource();
  const webgl = useMemo(() => hasWebGL(), []);
  const [params, setParams] = useSearchParams();
  const startUnder = params.get('view') === 'thermal';
  // two modes, switched only with the toolbar: above ground (pumping unit + site) / underground (well + geology)
  const [viewMode, setViewMode] = useState<ViewMode>(startUnder ? 'downhole' : 'surface');
  const underground = viewMode === 'downhole';
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(fadeTimer.current), []);
  const [cutaway, setCutaway] = useState(true);
  const [labels, setLabels] = useState(true);
  const [thermal, setThermal] = useState(startUnder);
  const [realistic, setRealistic] = useState(() => {
    try {
      return localStorage.getItem('twin.quality') !== 'performance';
    } catch {
      return true;
    }
  });
  const toggleQuality = () =>
    setRealistic((v) => {
      try {
        localStorage.setItem('twin.quality', v ? 'performance' : 'realistic');
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  const [camera, setCamera] = useState<{ preset: CameraPreset; seq: number }>({ preset: startUnder ? 'section' : 'iso', seq: 0 });
  const [selected, setSelected] = useState<ComponentKey | null>(null);
  const [hovered, setHovered] = useState<ComponentKey | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const risk = useTwin((s) => s.computed.risk);
  const health = useTwin((s) => s.computed.health);
  const wellId = useTwin((s) => s.wellId);
  const status = useTwin((s) => s.scenario.status);

  const selection: SelectionCtx = useMemo(() => ({ selected, hovered, select: setSelected, hover: setHovered }), [selected, hovered]);
  /** Switch above ground ⇄ underground behind a short fade, then ease the camera into the new view. */
  const switchMode = (m: ViewMode, preset: CameraPreset = m === 'downhole' ? 'section' : 'iso') => {
    if (m === viewMode) return setCamera((c) => ({ preset, seq: c.seq + 1 }));
    window.clearTimeout(fadeTimer.current);
    setFading(true);
    fadeTimer.current = window.setTimeout(() => {
      setViewMode(m);
      setCamera((c) => ({ preset, seq: c.seq + 1 }));
      fadeTimer.current = window.setTimeout(() => setFading(false), 120);
    }, 220);
  };
  const go = (preset: CameraPreset) => {
    const wantUnder = UNDER_PRESETS.includes(preset);
    if (wantUnder !== underground) switchMode(wantUnder ? 'downhole' : 'surface', preset);
    else setCamera((c) => ({ preset, seq: c.seq + 1 }));
  };
  const toggleThermal = () => {
    const on = !thermal;
    setThermal(on);
    if (on && !underground) switchMode('downhole', 'section');
  };
  // the deep link (/well/:id?view=thermal) is consumed once
  useEffect(() => {
    if (params.get('view') === 'thermal') setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveSource = modelError ? { kind: 'placeholder' as const, reason: modelError } : source;
  const cadLoaded = effectiveSource?.kind === 'gltf';

  return (
    <div className="flex h-full min-h-[600px] gap-3 p-3">
      <div className="panel relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line/70 bg-white/55 px-2 py-1.5">
          <span className="flex overflow-hidden rounded-[9px] border border-line" role="group" aria-label="View level">
            {(['surface', 'downhole'] as ViewMode[]).map((m) => (
              <button
                key={m}
                aria-pressed={viewMode === m}
                onClick={() => switchMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[11.5px] font-bold tracking-wide ${viewMode === m ? 'bg-ind-600 text-white' : 'bg-white/80 text-ink-2 hover:bg-white'}`}
              >
                {m === 'surface' ? <Mountain size={13} /> : <ArrowDownToLine size={13} />}
                {m === 'surface' ? 'ABOVE GROUND' : 'UNDERGROUND'}
              </button>
            ))}
          </span>
          <div className="mx-1 h-5 w-px bg-line" />
          <span className="label flex items-center gap-1 text-navy-800">
            <Camera size={13} /> View
          </span>
          {(underground ? UNDER_PRESETS : SURFACE_PRESETS).map((p) => (
            <button key={p} className={`btn px-2 py-1 text-[11px] ${camera.preset === p ? 'btn-primary' : ''}`} onClick={() => go(p)}>
              {CAMERA_PRESETS[p].label}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-line" />
          {underground && (
            <button className={`btn px-2 py-1 text-[11px] ${cutaway ? 'btn-primary' : ''}`} onClick={() => setCutaway((v) => !v)} title="See-through casing and tubing">
              <Scissors size={12} /> CUTAWAY
            </button>
          )}
          <button className={`btn px-2 py-1 text-[11px] ${labels ? 'btn-primary' : ''}`} onClick={() => setLabels((v) => !v)}>
            <Tag size={12} /> LABELS
          </button>
          <button className={`btn px-2 py-1 text-[11px] ${realistic ? 'btn-primary' : ''}`} onClick={toggleQuality} title="Realistic: ambient occlusion + anti-aliasing post-processing. Performance: faster rendering.">
            <Sparkles size={12} /> {realistic ? 'REALISTIC' : 'PERFORMANCE'}
          </button>
          <button className={`btn px-2 py-1 text-[11px] ${thermal ? 'btn-warn-solid' : ''}`} onClick={toggleThermal} aria-pressed={thermal} title="Thermal view: false-colour temperature of the well, produced fluid and CSS heated zone">
            <Thermometer size={12} /> THERMAL
          </button>
          <button className="btn px-2 py-1 text-[11px]" onClick={() => go(underground ? 'section' : 'iso')} title="Reset camera">
            <Eye size={12} /> RESET CAMERA
          </button>
        </div>

        <div data-label-scope className="relative min-h-0 flex-1 bg-[#e9dcc8]">
          {!webgl ? (
            <TwinFallback2D />
          ) : effectiveSource ? (
            <DigitalTwinModelViewer
              source={effectiveSource}
              viewMode={viewMode}
              cutaway={cutaway}
              labels={labels}
              camera={camera}
              selection={selection}
              realistic={realistic}
              wellId={wellId}
              thermal={thermal && underground}
              onModelError={(m) => setModelError(`CAD model failed to load: ${m}`)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-3">Resolving model source…</div>
          )}

          {/* model provenance badge */}
          <div data-label-obstacle className="pointer-events-none absolute top-2 left-2 max-w-[340px] rounded-[3px] border border-[#dccab5] bg-white/92 px-2.5 py-1.5 text-[11px] shadow-sm">
            {cadLoaded ? (
              <>
                <div className="flex items-center gap-1 font-semibold text-ok">
                  <Cpu size={12} /> CAD MODEL LOADED
                </div>
                <div className="text-ink-3">
                  /models/srp-pump.glb{effectiveSource.kind === 'gltf' && effectiveSource.manifest ? ' · articulated via manifest' : ' · static (no manifest)'}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-warn">CAD MODEL NOT LOADED</div>
                <div className="text-ink-2">
                  Displaying: <b>DIGITAL TWIN PLACEHOLDER</b>
                </div>
                {effectiveSource?.kind === 'placeholder' && <div className="text-[10px] text-ink-3">{effectiveSource.reason}</div>}
              </>
            )}
          </div>

          {thermal && underground && <ThermalLegend />}
          {/* fade that hides the swap between above-ground and underground scenes */}
          <div aria-hidden className={`pointer-events-none absolute inset-0 bg-[#1a140f] transition-opacity duration-200 ${fading ? 'opacity-100' : 'opacity-0'}`} />
          {/* status beacon legend */}
          <div data-label-obstacle className="pointer-events-none absolute top-2 right-2 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 rounded-[3px] border border-[#dccab5] bg-white/92 px-2 py-1 text-[11px] shadow-sm">
              <span className="text-ink-3">Equipment status</span>
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${riskTone(risk) === 'crit' ? 'pulse bg-crit' : riskTone(risk) === 'warn' ? 'bg-[#f0a92a]' : 'bg-ok'}`} />
              <RiskBadge risk={risk} />
              <HealthBadge health={health} />
            </div>
            {(risk === 'HIGH' || risk === 'CRITICAL') && (
              <Link to={`/well/${wellId}/causal`} className="pointer-events-auto flex items-center gap-1.5 rounded-[3px] border border-[#e3aca7] bg-crit-bg px-2 py-1 text-[11px] font-semibold text-crit shadow-sm">
                <AlertTriangle size={12} /> Predicted rod-load risk — view causal analysis
              </Link>
            )}
            {healthTone(health) !== 'ok' && status === 'IDLE' && (
              <div className="rounded-[3px] border border-[#dccab5] bg-white/92 px-2 py-1 text-[10.5px] text-ink-3 shadow-sm">Tip: press START DEMO SCENARIO above</div>
            )}
          </div>

          {webgl && <CycleIndicator />}
          <div data-label-obstacle className="pointer-events-none absolute right-3 bottom-3 rounded-[2px] bg-white/80 px-2 py-0.5 text-[10px] text-ink-3">Drag = rotate · Right-drag = pan · Wheel = zoom · Click = inspect</div>
        </div>
      </div>

      <aside className="flex w-[290px] shrink-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
        <WellInfoPanel />
        <PumpControls />
        <ComponentInspector selected={selected} onClear={() => setSelected(null)} />
      </aside>
    </div>
  );
}

function ThermalLegend() {
  const t = useTwin((st) => st.computed.sample.temperature);
  const oil = useTwin((st) => st.computed.sample.oil);
  const head = fluidTemperature(0, t, oil);
  return (
    <div data-label-obstacle className="pointer-events-none absolute top-[70px] left-2 w-[260px] rounded-xl border border-[#dccab5] bg-white/92 px-3 py-2 text-[11px] shadow-sm">
      <div className="flex items-center gap-1 font-bold tracking-wide text-navy-900 uppercase">
        <Thermometer size={12} className="text-[#c26a1a]" /> Thermal view
        <span className="ml-auto rounded border border-line px-1 text-[9px] font-semibold text-ink-3">MODEL</span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-full" style={{ background: THERMAL_GRADIENT_CSS }} />
      <div className="num mt-0.5 flex justify-between text-[10px] text-ink-3">
        <span>{THERMAL_SCALE.min} °C</span>
        <span>{Math.round((THERMAL_SCALE.min + THERMAL_SCALE.max) / 2)} °C</span>
        <span>{THERMAL_SCALE.max} °C</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 text-[10.5px]">
        <span className="text-ink-3">Pump intake</span>
        <span className="num text-right font-semibold">{t.toFixed(1)} °C</span>
        <span className="text-ink-3">Wellhead fluid</span>
        <span className="num text-right font-semibold">{head.toFixed(0)} °C</span>
      </div>
      <div className="mt-1 text-[10px] leading-snug text-ink-3">Rock: geothermal gradient · tubing: produced-fluid heat loss · reservoir: CSS heated zone. Simplified model.</div>
    </div>
  );
}
