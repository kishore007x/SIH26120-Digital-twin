import { Flame } from 'lucide-react';
import type { CSSCycle } from '../../types';
import { Badge, KV, Panel, Prov } from '../common/ui';

export function CSSCyclePanel({ cycle, thermalState }: { cycle: CSSCycle; thermalState: string }) {
  const tone = thermalState === 'COOLING' ? 'warn' : thermalState.startsWith('COOLING') ? 'warn' : 'ok';
  return (
    <Panel title="Current CSS cycle" icon={<Flame size={13} />} right={<Prov kind="CONFIGURED" label="Demonstration data" />}>
      <div className="px-3 py-1.5">
        <KV k="Cycle" v={cycle.cycleId} />
        <KV k="Steam injected" v={cycle.steamVolume} unit="tons" />
        <KV k="Injection pressure" v={cycle.injectionPressure} unit="bar" />
        <KV k="Soak" v={cycle.soakTime} unit="hours" />
        <KV k="Cycle avg. production" v={cycle.productionRate} unit="BOPD" />
        <KV k="Steam-oil ratio" v={cycle.sor.toFixed(1)} unit="t/t" />
        <KV k="Production start" v={cycle.startDate} />
        <div className="flex items-center justify-between py-[6px]">
          <span className="text-[12px] text-ink-2">Thermal state</span>
          <Badge tone={tone}>{thermalState}</Badge>
        </div>
      </div>
    </Panel>
  );
}
