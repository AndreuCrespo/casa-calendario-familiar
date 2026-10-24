// Locale-aware formatting of dates, times, amounts and name lists.
import { getLang, locale, t } from '../i18n';
import { type DateStr, diffDays, parts, weekday } from '../shared/dates';
import { CALENDAR_NAMES } from '../shared/locale';
import { joinList } from '../shared/text';
import type { CalEvent } from '../shared/types';

/** One-letter weekday names (for the weekday picker), Monday first. */
const LETTERS = { es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] } as const;

const names = () => CALENDAR_NAMES[getLang()];
const pick = (list: readonly string[], i: number) => list[i] ?? '';

/** Short weekday names, capitalized, Monday first (column headers). */
export const dow = () => names().weekdaysShort.map(cap);
/** Full weekday names, Monday first. */
export const dowLong = () => names().weekdays;
/** One-letter weekday names, Monday first. */
export const dowLetter = () => LETTERS[getLang()];
export const monthName = (m: number) => pick(names().months, m - 1);
export const monthShort = (m: number) => pick(names().monthsShort, m - 1);

export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Two-digit hour and minute: hm(9, 5) → "09:05". */
export const hm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Weekday name alone (lowercase in Spanish, capitalized in English). */
export const weekdayLong = (d: DateStr) => pick(names().weekdays, weekday(d));

/** Date without the weekday. es: "20 de octubre" · en: "20 October" */
export function dayMonth(d: DateStr) {
  const p = parts(d);
  const month = monthName(p.m);
  return getLang() === 'es' ? `${p.d} de ${month}` : `${p.d} ${month}`;
}

/** es: "martes 20 de octubre" · en: "Tuesday 20 October" */
export const dayLong = (d: DateStr) => `${weekdayLong(d)} ${dayMonth(d)}`;

/** es: "mar 20 oct" · en: "Tue 20 Oct" */
export function dayShort(d: DateStr) {
  const p = parts(d);
  return `${pick(names().weekdaysShort, weekday(d))} ${p.d} ${monthShort(p.m)}`;
}

/** "20 oct – 26 oct" */
export function dateRange(from: DateStr, to: DateStr) {
  const a = parts(from);
  const b = parts(to);
  return `${a.d} ${monthShort(a.m)} – ${b.d} ${monthShort(b.m)}`;
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

const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(key: string, options: Intl.NumberFormatOptions) {
  const id = `${locale()}|${key}`;
  let f = formatters.get(id);
  if (!f) {
    f = new Intl.NumberFormat(locale(), options);
    formatters.set(id, f);
  }
  return f;
}

export function euros(cents: number) {
  return numberFormat('eur', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Number with the locale's decimal separator ("0,217" / "0.217"). */
export function decimal(n: number, digits: number) {
  return numberFormat(`d${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/**
 * Parses an amount typed by the user into cents, or null if it isn't one.
 * Accepts "23,40", "23.40", "1.234,50", "1,234.50", "1.200" (es: one thousand
 * two hundred) and "€ 12". With a single separator followed by exactly three
 * digits, the current language decides whether it groups thousands.
 */
export function parseEuros(input: string, lang = getLang()): number | null {
  const s = input.replace(/[€\s ]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const seps = [...s.matchAll(/[.,]/g)];
  let int = s;
  let frac = '';
  const last = seps.at(-1);
  if (last && last.index !== undefined) {
    const sep = last[0];
    const after = s.slice(last.index + 1);
    const mixed = seps.some((m) => m[0] !== sep);
    const repeated = seps.filter((m) => m[0] === sep).length > 1;
    const grouping = lang === 'es' ? '.' : ',';
    const isDecimal = mixed || (!repeated && !(sep === grouping && after.length === 3));
    if (isDecimal) {
      int = s.slice(0, last.index);
      frac = after;
    }
    // What's left of the separators must group thousands: 1.234.567
    if (/[.,]/.test(int) && !/^\d{1,3}([.,]\d{3})+$/.test(int)) return null;
    int = int.replace(/[.,]/g, '');
  }
  if (!/^\d+$/.test(int) || !/^\d{0,2}$/.test(frac)) return null;
  return Number(int) * 100 + Number(frac.padEnd(2, '0'));
}

/** Cents as an editable string in the current language ("1234,50" / "1234.50"). */
export function centsToInput(cents: number, lang = getLang()) {
  const s = (cents / 100).toFixed(2);
  return lang === 'es' ? s.replace('.', ',') : s;
}

/** "A, B and C" / "A, B y C" */
export const joinNames = (list: string[]) => joinList(list, getLang());
