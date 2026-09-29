import type { HealthLevel, RiskLevel, WellStatus } from '../types';

export const f0 = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : '—');
export const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—');
export const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '—');
export const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function fmtSimTime(ms: number, withDate = true) {
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...(withDate ? { day: '2-digit', month: 'short', year: 'numeric' } : {}),
  };
  return new Intl.DateTimeFormat('en-GB', opts).format(d);
}

export function fmtClock(ms: number) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}

export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral';

export const riskTone = (r: RiskLevel): Tone => (r === 'NORMAL' ? 'ok' : r === 'MODERATE' ? 'warn' : 'crit');
export const healthTone = (h: HealthLevel): Tone => (h === 'GOOD' ? 'ok' : h === 'WATCH' ? 'warn' : 'crit');
export const statusTone = (s: WellStatus): Tone => (s === 'PRODUCING' ? 'ok' : s === 'AT_RISK' ? 'warn' : s === 'MAINTENANCE' ? 'info' : 'neutral');

export const STATUS_LABEL: Record<WellStatus, string> = {
  PRODUCING: 'Producing',
  INACTIVE: 'Inactive',
  MAINTENANCE: 'Maintenance',
  AT_RISK: 'At Risk',
};

export const STATUS_COLOR: Record<WellStatus, string> = {
  PRODUCING: '#3f7d4e',
  AT_RISK: '#c98a12',
  MAINTENANCE: '#2d64a8',
  INACTIVE: '#8a939c',
};

export const loadColor = (load: number) => (load >= 90 ? '#b3261e' : load >= 80 ? '#d0661b' : load >= 70 ? '#c98a12' : '#3f7d4e');
