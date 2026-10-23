// Locale-aware formatting of dates, times, amounts and name lists.
import { type DateStr, diffDays, parts, weekday } from '../shared/dates';
import type { CalEvent, Member } from '../shared/types';
import { getLang, locale, t } from '../i18n';

const NAMES = {
  es: {
    dow: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    dowLong: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    dowLetter: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    monthsShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  },
  en: {
    dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dowLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    dowLetter: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
} as const;

const names = () => NAMES[getLang()];

/** Short weekday names, Monday first. */
export const dow = () => names().dow;
/** One-letter weekday names, Monday first. */
export const dowLetter = () => names().dowLetter;
export const monthName = (m: number) => names().months[m - 1];
export const monthShort = (m: number) => names().monthsShort[m - 1];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** es: "martes 20 de octubre" · en: "Tuesday 20 October" */
export function dayLong(d: DateStr) {
  const p = parts(d);
  const n = names();
  return getLang() === 'es'
    ? `${n.dowLong[weekday(d)]} ${p.d} de ${n.months[p.m - 1]}`
    : `${n.dowLong[weekday(d)]} ${p.d} ${n.months[p.m - 1]}`;
}

/** Weekday name alone (lowercase in Spanish, capitalized in English). */
export const weekdayLong = (d: DateStr) => names().dowLong[weekday(d)];

/** es: "mar 20 oct" · en: "Tue 20 Oct" */
export function dayShort(d: DateStr) {
  const p = parts(d);
  const n = names();
  const w = n.dow[weekday(d)];
  return `${getLang() === 'es' ? w.toLowerCase() : w} ${p.d} ${n.monthsShort[p.m - 1]}`;
}

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function dayRelative(d: DateStr, today: DateStr) {
  const n = diffDays(d, today);
  if (n === 0) return t('date.today');
  if (n === 1) return t('date.tomorrow');
  if (n === -1) return t('date.yesterday');
  return dayShort(d);
}

/** "today", "tomorrow", "in 3 days", "3 days ago". */
export function inDays(d: DateStr, today: DateStr) {
  const n = diffDays(d, today);
  if (n === 0) return t('date.today_lower');
  if (n === 1) return t('date.tomorrow_lower');
  if (n === -1) return t('date.yesterday_lower');
  if (n < 0) return t('date.daysAgo', { n: -n });
  return t('date.inDays', { n });
}

export function timeRange(ev: Pick<CalEvent, 'startTime' | 'endTime'>) {
  if (!ev.startTime) return t('date.allDay');
  return ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime;
}

/** "in 17 h 8 min", "in 3 days" */
export function countdown(ms: number) {
  if (ms <= 0) return t('date.now');
  const min = Math.round(ms / 60000);
  if (min < 60) return t('date.inMinutes', { m: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('date.inHoursMinutes', { h, m: min % 60 });
  const days = Math.round(h / 24);
  return days === 1 ? t('date.inOneDay') : t('date.inDays', { n: days });
}

export function euros(cents: number) {
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Number with the locale's decimal separator ("0,217" / "0.217"). */
export function decimal(n: number, digits: number) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** Parses "23,40", "23.40" or "1.234,50" into cents. */
export function parseEuros(s: string): number | null {
  let clean = s.replace(/[€\s]/g, '');
  if (clean.includes(',')) clean = clean.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Cents as an editable string in the current locale ("23,40" / "23.40"). */
export function centsToInput(cents: number) {
  const s = (cents / 100).toFixed(2);
  return getLang() === 'es' ? s.replace('.', ',') : s;
}

/** "A, B and C" / "A, B y C" */
export function joinNames(list: string[]) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${t('list.and')} ${list[list.length - 1]}`;
}

export function memberNames(ids: string[] | undefined, members: Member[]) {
  return joinNames((ids ?? []).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean) as string[]);
}
