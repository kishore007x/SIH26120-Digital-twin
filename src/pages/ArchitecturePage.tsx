import { ArrowDown, ArrowRight } from 'lucide-react';
import { Badge, Note, PageTitle, Panel } from '../components/common/ui';

interface Block {
  title: string;
  items: string[];
  mvp: 'BUILT' | 'SIMULATED' | 'PLANNED';
}

const LAYERS: { name: string; blocks: Block[] }[] = [
  {
    name: '1 · Wellsite (per well)',
    blocks: [
      { title: 'Sensors', items: ['Polished-rod load cell + position', 'Downhole P/T gauge', 'Tank radar level', 'Motor / VFD data'], mvp: 'SIMULATED' },
      { title: 'Rod pump controller (RPC / POC)', items: ['Stroke-by-stroke speed control', 'Downhole card (Gibbs wave equation)', 'Local pump-off fail-safe', 'Accepts bounded setpoints'], mvp: 'SIMULATED' },
    ],
  },
  {
    name: '2 · Edge & communications',
    blocks: [
      { title: 'RTU / IoT gateway', items: ['Radio / cellular backhaul', 'Store-and-forward on link loss', 'MQTT / OPC-UA', 'Heartbeat + setpoint ack'], mvp: 'SIMULATED' },
    ],
  },
  {
    name: '3 · Data platform',
    blocks: [
      { title: 'SCADA / historian', items: ['Real-time tags', 'Alarm & event journal', 'Well tests / tank gauging'], mvp: 'PLANNED' },
      { title: 'Time-series store', items: ['PostgreSQL + TimescaleDB', 'Data-quality flags per sample', 'Model predictions + outcomes'], mvp: 'PLANNED' },
    ],
  },
  {
    name: '4 · Digital-twin services',
    blocks: [
      { title: 'Physics-informed models', items: ['Thermal decay + ML residual', 'Viscosity μ(T)', 'SRP load, fillage, Goodman stress', 'Dynacard classifier'], mvp: 'BUILT' },
      { title: 'Decision layer', items: ['Constraint-aware optimiser', 'Independent safety gate', 'Supervised automation + escalation', 'CSS re-steam planner'], mvp: 'BUILT' },
      { title: 'ML ops', items: ['Python + PyTorch training', 'Model registry & versions', 'Drift monitoring / back-test'], mvp: 'PLANNED' },
    ],
  },
  {
    name: '5 · People & workflow',
    blocks: [
      { title: 'Operations UI (this app)', items: ['Field map, 3D twins, alarms', 'Tanks & evacuation, data quality', 'Approve / modify / reject / roll back'], mvp: 'BUILT' },
      { title: 'Governance', items: ['SSO + role-based access', 'Automation policy & MOC log', 'Append-only audit trail'], mvp: 'BUILT' },
    ],
  },
];

const TONE = { BUILT: 'ok', SIMULATED: 'warn', PLANNED: 'info' } as const;

export default function ArchitecturePage() {
  return (
    <div className="p-4">
      <PageTitle
        title="System architecture"
        sub="How the twin fits between wellsite equipment and operators. The labels show what the MVP builds, what it simulates, and what is planned for production."
        right={
          <span className="flex gap-1.5">
            <Badge tone="ok">BUILT IN MVP</Badge>
            <Badge tone="warn">SIMULATED IN MVP</Badge>
            <Badge tone="info">PLANNED</Badge>
          </span>
        }
      />
      <div className="flex flex-col items-stretch">
        {LAYERS.map((l, i) => (
          <div key={l.name} className="flex flex-col items-center">
            <Panel title={l.name} className="w-full">
              <div className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${l.blocks.length}, minmax(0, 1fr))` }}>
                {l.blocks.map((b) => (
                  <div key={b.title} className="rounded-[3px] border border-line bg-[#fafbfc] p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-navy-900">{b.title}</span>
                      <Badge tone={TONE[b.mvp]}>{b.mvp}</Badge>
                    </div>
                    <ul className="list-disc pl-4 text-[11.5px] leading-relaxed text-ink-2">
                      {b.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
            {i < LAYERS.length - 1 && <ArrowDown size={18} className="my-1 text-navy-800" />}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel title="Control principle: supervisory, not direct">
          <div className="space-y-2 p-3 text-[12px] text-ink-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-navy-900">
              <span className="rounded-[2px] border border-line px-1.5 py-0.5">Forecast (hours)</span>
              <ArrowRight size={13} />
              <span className="rounded-[2px] border border-line px-1.5 py-0.5">Twin sets limits / targets</span>
              <ArrowRight size={13} />
              <span className="rounded-[2px] border border-line px-1.5 py-0.5">RPC controls each stroke (seconds)</span>
              <ArrowRight size={13} />
              <span className="rounded-[2px] border border-line px-1.5 py-0.5">Pump</span>
            </div>
            <p>Fast control stays at the wellsite, where it keeps working without the network. The twin works on the slow timescale: thermal decline, viscosity and CSS cycles. It adjusts the RPC's speed limit and fillage target inside the safety envelope.</p>
          </div>
        </Panel>
        <Panel title="Scaling to the full field">
          <div className="space-y-1.5 p-3 text-[12px] text-ink-2">
            <p>• <b>52 wells today, hundreds tomorrow:</b> each well's models are small and independent, so they run in parallel as stateless services fed by the time-series store.</p>
            <p>• <b>Management by exception:</b> operators work from the alarm list, tank plan and CSS planner, not from 52 screens.</p>
            <p>• <b>Replaceable modules:</b> the data source, thermal model, dynacard classifier and optimiser each sit behind an interface, so they can be swapped for SCADA feeds, trained PyTorch models or Bayesian optimisation without changing the UI.</p>
            <p>• <b>Offline-tolerant:</b> the edge buffers data and the RPC fails safe, so a desert link outage doesn't stop production.</p>
          </div>
        </Panel>
      </div>
      <div className="mt-3">
        <Note>Security in production: network segmentation between the control (OT) and business (IT) networks following ISA/IEC 62443; read-only historian replication to the cloud; write-back of setpoints only through the authenticated RPC interface with acknowledgement.</Note>
      </div>
    </div>
  );
}
