import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { SafetyResult } from '../../types';

export function SafetyCheckRow({ label, limit, value, status, note, pending }: { label: string; limit: string; value: string; status: 'PASS' | 'WARN' | 'FAIL'; note?: string; pending?: boolean }) {
  return (
    <tr className={pending ? 'opacity-40' : 'reveal'}>
      <td className="font-medium">{label}</td>
      <td className="num text-right text-ink-2">{limit}</td>
      <td className="num text-right">{pending ? '…' : value}</td>
      <td className="w-[92px]">
        {pending ? (
          <span className="flex items-center gap-1 text-[11px] text-ink-3">
            <Loader2 size={12} className="animate-spin" /> checking
          </span>
        ) : status === 'PASS' ? (
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ok">
            <CheckCircle2 size={13} /> PASS
          </span>
        ) : status === 'WARN' ? (
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-warn" title={note}>
            <AlertTriangle size={13} /> WARN
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-crit">
            <XCircle size={13} /> FAIL
          </span>
        )}
      </td>
    </tr>
  );
}

export function SafetyEnvelope({ result, revealed }: { result: SafetyResult; revealed: number }) {
  const done = revealed >= result.checks.length;
  return (
    <div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Check</th>
            <th className="text-right">Limit (configured)</th>
            <th className="text-right">Proposed / predicted</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {result.checks.map((c, i) => (
            <SafetyCheckRow key={c.id} {...c} pending={i >= revealed} />
          ))}
        </tbody>
      </table>
      {done && (
        <div
          className={`reveal m-3 flex items-center gap-3 rounded-[3px] border px-3 py-2.5 ${result.safe ? 'border-[#9cc7a6] bg-ok-bg text-[#2d5a38]' : 'border-[#e3aca7] bg-crit-bg text-crit'}`}
        >
          {result.safe ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
          <div>
            <div className="text-[14px] font-semibold tracking-wide">{result.safe ? (result.warnings.length ? 'SAFETY CHECKS PASSED WITH WARNINGS' : 'ALL SAFETY CHECKS PASSED') : 'RECOMMENDATION REJECTED BY SAFETY ENGINE'}</div>
            <div className="text-[12px]">{result.safe ? 'RECOMMENDATION WITHIN SAFETY ENVELOPE' : result.violations.join(' · ')}</div>
            {result.safe && result.warnings.length > 0 && <div className="text-[11px] text-warn">{result.warnings.join(' · ')}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
