import { memo, useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { hybridTemperature, physicsTemperature, temperatureSigma } from '../../services/thermalModel';
import { viscosityAt } from '../../services/viscosityModel';
import { AXIS, GRID, SERIES } from '../operations/TimeSeriesChart';
import type { TwinSample } from '../../types';

interface Props {
  tPlateau: number;
  nowH: number;
  coolingDeclared: boolean;
  trend: TwinSample[];
  mode: 'temperature' | 'viscosity';
  height?: number;
}

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number | number[]; color: string }[]; label?: number; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[3px] border border-[#dccab5] bg-white px-2 py-1.5 text-[11px] shadow-md">
      <div className="mb-0.5 text-ink-3">t {Number(label) >= 0 ? '+' : ''}{Number(label).toFixed(1)} h from cooling onset</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-3" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="num ml-auto font-semibold">
            {Array.isArray(p.value) ? `${p.value[0].toFixed(unit === 'cP' ? 0 : 1)}–${p.value[1].toFixed(unit === 'cP' ? 0 : 1)}` : p.value.toFixed(unit === 'cP' ? 0 : 1)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Physics baseline vs physics + ML residual vs simulated observation, with forecast band. */
export const ThermalChart = memo(function ThermalChart({ tPlateau, nowH, coolingDeclared, trend, mode, height = 250 }: Props) {
  const data = useMemo(() => {
    const out: Record<string, number | number[] | undefined>[] = [];
    const conv = (t: number) => (mode === 'temperature' ? t : viscosityAt(t));
    for (let h = -6; h <= 48 + 1e-9; h += 0.5) {
      const phys = coolingDeclared ? physicsTemperature(tPlateau, h) : tPlateau;
      const hyb = coolingDeclared ? hybridTemperature(tPlateau, h) : tPlateau;
      const row: Record<string, number | number[] | undefined> = { h, physics: conv(phys), hybrid: conv(hyb) };
      if (h > nowH) {
        const s = temperatureSigma(h - nowH);
        row.band = mode === 'temperature' ? [hyb - s, hyb + s] : [viscosityAt(hyb + s), viscosityAt(hyb - s)];
      }
      out.push(row);
    }
    const obs = trend.filter((t) => t.tH >= -6 && t.tH <= nowH + 1e-6);
    // thin observations to every 0.5 h for legibility
    let lastH = -Infinity;
    for (const o of obs) {
      if (o.tH - lastH < 0.5) continue;
      lastH = o.tH;
      out.push({ h: o.tH, obs: mode === 'temperature' ? o.temperature : o.viscosity });
    }
    return out.sort((a, b) => (a.h as number) - (b.h as number));
  }, [tPlateau, nowH, coolingDeclared, trend, mode]);

  const unit = mode === 'temperature' ? '°C' : 'cP';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="h" type="number" domain={[-6, 48]} ticks={[-6, 0, 6, 12, 18, 24, 30, 36, 42, 48]} tick={AXIS} stroke="#c9d0d6" tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v}h`} />
        <YAxis tick={AXIS} stroke="#c9d0d6" domain={mode === 'temperature' ? [60, 78] : [330, 520]} width={48} allowDataOverflow />
        <Tooltip content={<Tip unit={unit} />} isAnimationActive={false} />
        <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 10.5, color: '#3d4650' }} verticalAlign="top" align="right" height={height < 240 ? 38 : 20} />
        <Area dataKey="band" name="Forecast band (≈95%)" stroke="none" fill={SERIES.s1} fillOpacity={0.1} isAnimationActive={false} connectNulls legendType="square" />
        <Line dataKey="physics" name="Physics baseline" stroke={SERIES.s3} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
        <Line dataKey="hybrid" name="Physics + ML residual" stroke={SERIES.s1} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        <Scatter dataKey="obs" name="Simulated observation" fill={SERIES.s2} shape="circle" isAnimationActive={false} legendType="circle" />
        <ReferenceLine x={nowH} stroke="#1d242b" strokeDasharray="3 3" label={{ value: 'now', position: 'insideTopLeft', fontSize: 10, fill: '#1d242b' }} />
        {coolingDeclared && <ReferenceLine x={0} stroke="#66707a" strokeDasharray="2 3" label={{ value: 'CSS support ends', position: 'insideBottomRight', fontSize: 9.5, fill: '#66707a' }} />}
        {coolingDeclared && <ReferenceLine x={nowH + 24} stroke="#b7791f" strokeDasharray="2 3" label={{ value: '+24 h forecast', position: 'insideTopRight', fontSize: 9.5, fill: '#b7791f' }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
});
