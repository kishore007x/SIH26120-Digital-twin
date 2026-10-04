import { memo, useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { viscosityAt } from '../../services/viscosityModel';
import { AXIS, GRID, SERIES } from '../operations/TimeSeriesChart';

/** μ(T) relationship with the current and forecast operating points marked. */
export const ViscosityCurve = memo(function ViscosityCurve({ current, forecast, height = 210 }: { current: number; forecast: number; height?: number }) {
  const data = useMemo(() => {
    const out = [];
    for (let t = 50; t <= 95; t += 1) out.push({ t, mu: viscosityAt(t) });
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="t" type="number" domain={[50, 95]} tick={AXIS} stroke="#c9d0d6" tickFormatter={(v) => `${v}°C`} />
        <YAxis tick={AXIS} stroke="#c9d0d6" width={48} domain={[0, 700]} />
        <Tooltip
          isAnimationActive={false}
          formatter={(v) => [`${Number(v).toFixed(0)} cP`, 'μ(T)']}
          labelFormatter={(l) => `T = ${l} °C`}
          contentStyle={{ fontSize: 11, border: '1px solid #dccab5', borderRadius: 3 }}
        />
        <Line dataKey="mu" name="μ(T)" stroke={SERIES.s1} strokeWidth={2} dot={false} isAnimationActive={false} />
        <ReferenceDot x={Number(current.toFixed(1))} y={viscosityAt(current)} r={5} fill={SERIES.s2} stroke="#fff" strokeWidth={2} label={{ value: 'now', position: 'top', fontSize: 10, fill: '#3d4650' }} />
        <ReferenceDot x={Number(forecast.toFixed(1))} y={viscosityAt(forecast)} r={5} fill="#fff" stroke={SERIES.s2} strokeWidth={2} label={{ value: '+24 h', position: 'left', fontSize: 10, fill: '#3d4650' }} />
      </LineChart>
    </ResponsiveContainer>
  );
});
