import { memo } from 'react';
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import type { CardPoint } from '../../services/dynacardModel';
import { AXIS, GRID } from '../operations/TimeSeriesChart';

export interface CardSeries {
  name: string;
  points: CardPoint[];
  color: string;
  dashed?: boolean;
}

const NoDot = () => null;

export const DynacardChart = memo(function DynacardChart({ cards, height = 300, ratedKN, stroke, yMax, refLabel = '90% structure rating', showRef = true, xLabel = 'Polished-rod position (m)' }: { cards: CardSeries[]; height?: number; ratedKN: number; stroke: number; yMax?: number; refLabel?: string; showRef?: boolean; xLabel?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 18, bottom: 16, left: 4 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          dataKey="position"
          type="number"
          domain={[0, Math.ceil(stroke * 10) / 10]}
          tick={AXIS}
          stroke="#c9d0d6"
          tickFormatter={(v) => Number(v).toFixed(1)}
          label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 10.5, fill: '#66707a' }}
        />
        <YAxis
          dataKey="load"
          type="number"
          domain={[yMax !== undefined ? -Math.ceil(yMax * 0.05) : 0, Math.ceil((yMax ?? ratedKN) / 10) * 10]}
          tickFormatter={(v) => Number(v).toFixed(0)}
          tick={AXIS}
          stroke="#c9d0d6"
          width={52}
          label={{ value: 'Load (kN)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 10.5, fill: '#66707a' }}
        />
        <Tooltip
          isAnimationActive={false}
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(v, n) => [n === 'position' ? `${Number(v).toFixed(2)} m` : `${Number(v).toFixed(1)} kN`, n === 'position' ? 'Position' : 'Load']}
          contentStyle={{ fontSize: 11, border: '1px solid #dccab5', borderRadius: 3 }}
        />
        <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 10.5, color: '#3d4650' }} verticalAlign="top" align="right" height={20} />
        {showRef && <ReferenceLine y={ratedKN * 0.9} stroke="#b3261e" strokeDasharray="4 3" label={{ value: refLabel, position: 'insideTopRight', fontSize: 9.5, fill: '#b3261e' }} />}
        {cards.map((c) => (
          <Scatter
            key={c.name}
            name={c.name}
            data={c.points}
            line={{ stroke: c.color, strokeWidth: 2, strokeDasharray: c.dashed ? '5 4' : undefined }}
            lineType="joint"
            shape={<NoDot />}
            fill={c.color}
            isAnimationActive={false}
            legendType="plainline"
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
});
