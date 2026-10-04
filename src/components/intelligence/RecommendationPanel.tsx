import { Brain } from 'lucide-react';
import type { Recommendation } from '../../types';
import { Badge, Panel, RiskBadge } from '../common/ui';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { loadColor } from '../../lib/format';

export function RecommendationPanel({ rec, applied }: { rec: Recommendation; applied?: string | null }) {
  const f = rec.forecast;
  const rows: [string, string, string][] = [
    ['SPM', `${rec.currentValue}`, `${rec.recommendedValue}`],
    ['Stroke', `${rec.stroke.toFixed(1)} m`, `${rec.stroke.toFixed(1)} m`],
    ['VFD', `${rec.currentVfd.toFixed(0)} Hz`, `${rec.recommendedVfd.toFixed(0)} Hz`],
  ];
  return (
    <Panel
      title="AI-assisted operating recommendation"
      icon={<Brain size={13} />}
      right={
        <span className="flex items-center gap-1.5">
          <Badge tone="info">{rec.id}</Badge>
          <Badge tone={rec.safetyStatus === 'PASSED' ? 'ok' : rec.safetyStatus === 'FAILED' ? 'crit' : 'neutral'}>SAFETY {rec.safetyStatus}</Badge>
          {applied && <Badge tone={applied === 'APPROVED' ? 'ok' : 'crit'}>{applied === 'APPROVED' ? 'EXECUTED' : applied.replace('_', ' ')}</Badge>}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Parameter</th>
                <th className="text-right">Current</th>
                <th className="text-right">Recommended</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, a, b]) => (
                <tr key={k}>
                  <td className="font-medium">{k}</td>
                  <td className="num text-right">{a}</td>
                  <td className={`num text-right font-semibold ${a !== b ? 'text-ind-600' : ''}`}>{b}</td>
                </tr>
              ))}
              <tr>
                <td className="font-medium">Predicted rod load (+{rec.horizonH} h)</td>
                <td className="num text-right font-semibold" style={{ color: loadColor(f.rodLoadCurrentSpm.value) }}>
                  {f.rodLoadCurrentSpm.value.toFixed(0)}%
                </td>
                <td className="num text-right font-semibold" style={{ color: loadColor(f.rodLoadRecommended?.value ?? 0) }}>
                  {f.rodLoadRecommended?.value.toFixed(0)}%
                </td>
              </tr>
              <tr>
                <td className="font-medium">Risk</td>
                <td className="text-right">
                  <RiskBadge risk={f.riskCurrentSpm} />
                </td>
                <td className="text-right">{f.riskRecommended && <RiskBadge risk={f.riskRecommended} />}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="label">SPM</div>
              <div className="num text-[28px] leading-8 font-semibold text-ink-2">{rec.currentValue}</div>
            </div>
            <div className="text-[22px] text-ink-3">→</div>
            <div className="text-center">
              <div className="label text-ind-600">Recommended</div>
              <div className="num text-[28px] leading-8 font-semibold text-ind-600">{rec.recommendedValue}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="label">Rod load +{rec.horizonH} h</div>
              <div className="num text-[18px] font-semibold">
                <span style={{ color: loadColor(f.rodLoadCurrentSpm.value) }}>{f.rodLoadCurrentSpm.value.toFixed(0)}%</span>
                <span className="text-ink-3"> → </span>
                <span style={{ color: loadColor(f.rodLoadRecommended?.value ?? 0) }}>{f.rodLoadRecommended?.value.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          <ConfidenceIndicator value={rec.confidence} />
          <div className="rounded-[3px] border border-steel-200 bg-[#f4f7fa] p-2.5 text-[12px] leading-relaxed text-ink-2">
            <div className="label mb-1 text-navy-800">Why</div>
            {rec.reason}
          </div>
        </div>
      </div>
    </Panel>
  );
}
