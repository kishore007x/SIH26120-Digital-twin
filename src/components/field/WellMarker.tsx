import { memo } from 'react';
import type { RiskLevel, Well } from '../../types';
import { STATUS_COLOR } from '../../lib/format';

interface Props {
  well: Well;
  risk: RiskLevel;
  selected: boolean;
  onEnter: (e: React.MouseEvent) => void;
  onLeave: () => void;
  onClick: () => void;
}

export const WellMarker = memo(function WellMarker({ well, risk, selected, onEnter, onLeave, onClick }: Props) {
  const liveAtRisk = well.status === 'PRODUCING' && (risk === 'HIGH' || risk === 'CRITICAL');
  const status = liveAtRisk ? 'AT_RISK' : well.status;
  const color = STATUS_COLOR[status];
  const { x, y } = well;
  return (
    <g transform={`translate(${x},${y})`} className="cursor-pointer" onMouseMove={onEnter} onMouseLeave={onLeave} onClick={onClick} role="button" aria-label={`Open ${well.id}`}>
      <circle r={13} fill="transparent" />
      {selected && <circle r={12} fill="none" stroke="#0f2340" strokeWidth={2} />}
      {status === 'AT_RISK' && <circle r={10} fill="none" stroke={color} strokeWidth={1.4} className="pulse" />}
      {status === 'MAINTENANCE' ? (
        <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" fill={color} stroke="#fff" strokeWidth={1.2} />
      ) : status === 'INACTIVE' ? (
        <circle r={5} fill="#fff" stroke={color} strokeWidth={2} />
      ) : (
        <circle r={6} fill={color} stroke="#fff" strokeWidth={1.4} />
      )}
      <text y={-10} fontSize={8.5} textAnchor="middle" fill={selected ? '#0f2340' : '#4a525a'} fontWeight={selected ? 700 : 500} fontFamily="IBM Plex Mono" style={{ pointerEvents: 'none' }}>
        {well.id}
      </text>
      {selected && (
        <g transform="translate(14,10)" style={{ pointerEvents: 'none' }}>
          <rect width={78} height={15} rx={2} fill="#0f2340" />
          <text x={39} y={10.5} fontSize={8.5} fill="#fff" textAnchor="middle" fontWeight={600} letterSpacing={0.8}>
            TWIN SELECTED
          </text>
        </g>
      )}
    </g>
  );
});
