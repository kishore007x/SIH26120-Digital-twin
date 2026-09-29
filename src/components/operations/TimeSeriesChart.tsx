import { memo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { fmtClock, fmtSimTime } from '../../lib/format';

// Validated categorical order (see dataviz validator): blue, orange, violet.
export const SERIES = { s1: '#2d64a8', s2: '#c9651a', s3: '#7b5ea7' };
export const AXIS = { stroke: '#9aa3ab', fontSize: 10.5, fontFamily: 'IBM Plex Mono' };
export const GRID = '#e8ebee';

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
  dashed?: boolean;
  dot?: boolean;
  width?: number;
}

export interface RefLineDef {
  y: number;
  label: string;
  color: string;
}

interface Props {
  data: Record<string, number>[];
  series: SeriesDef[];
  unit: string;
  height?: number;
  domain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  refLines?: RefLineDef[];
  markers?: { x: number; label: string }[];
  decimals?: number;
  xKey?: string;
}

function TooltipBox({ active, payload, label, unit, decimals }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number; unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[3px] border border-[#c6ced6] bg-white px-2 py-1.5 text-[11px] shadow-md">
      <div className="mb-0.5 text-ink-3">{label ? fmtSimTime(label) : ''}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-3" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="num ml-auto font-semibold text-ink">
            {Number(p.value).toFixed(decimals)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export const TimeSeriesChart = memo(function TimeSeriesChart({ data, series, unit, height = 150, domain = ['auto', 'auto'], refLines = [], markers = [], decimals = 1, xKey = 'time' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={(v) => fmtClock(v)} tick={AXIS} stroke="#c9d0d6" minTickGap={40} />
        <YAxis domain={domain} tick={AXIS} stroke="#c9d0d6" width={48} tickFormatter={(v) => Number(v).toFixed(decimals > 1 ? 1 : 0)} allowDecimals />
        <Tooltip content={<TooltipBox unit={unit} decimals={decimals} />} isAnimationActive={false} />
        {series.length > 1 && <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 10.5, color: '#3d4650', paddingTop: 0 }} height={18} verticalAlign="top" align="right" />}
        {refLines.map((r) => (
          <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="4 3" label={{ value: r.label, position: 'insideTopLeft', fontSize: 9.5, fill: '#66707a' }} />
        ))}
        {markers.map((m) => (
          <ReferenceLine key={m.label} x={m.x} stroke="#66707a" strokeDasharray="2 3" label={{ value: m.label, position: 'insideTopRight', fontSize: 9.5, fill: '#66707a' }} />
        ))}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.width ?? 2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            dot={s.dot ? { r: 2, strokeWidth: 0, fill: s.color } : false}
            activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});
