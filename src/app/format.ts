import type { EndReason } from '@/game/core/entities';
import type { MessageKey } from '@/i18n';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatPlayedAt(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '—', time: '' };
  return {
    day: `${pad(date.getDate())} ${MONTHS[date.getMonth()] ?? ''}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function endReasonLabelKey(reason: EndReason): MessageKey {
  return reason === 'time_up' ? 'result.timeUp' : 'result.defeated';
}

export function endReasonTitleKey(reason: EndReason): MessageKey {
  return reason === 'time_up' ? 'result.battleComplete' : 'result.shipSunk';
}
