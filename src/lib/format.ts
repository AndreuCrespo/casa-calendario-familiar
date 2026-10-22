import { type DateStr, diffDays, parts, weekday } from '../shared/dates';
import type { CalEvent, Member } from '../shared/types';

export const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DOW_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DOW_LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "martes 20 de octubre" */
export function dayLong(d: DateStr) {
  const p = parts(d);
  return `${DOW_LONG[weekday(d)]} ${p.d} de ${MONTHS[p.m - 1]}`;
}

/** "mar 20 oct" */
export function dayShort(d: DateStr) {
  const p = parts(d);
  return `${DOW[weekday(d)].toLowerCase()} ${p.d} ${MONTHS_SHORT[p.m - 1]}`;
}

/** "Hoy", "Mañana", "Ayer" o "jue 23 oct" */
export function dayRelative(d: DateStr, today: DateStr) {
  const n = diffDays(d, today);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return dayShort(d);
}

export function inDays(d: DateStr, today: DateStr) {
  const n = diffDays(d, today);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n < 0) return `hace ${-n} días`;
  return `en ${n} días`;
}

export function timeRange(ev: Pick<CalEvent, 'startTime' | 'endTime'>) {
  if (!ev.startTime) return 'Todo el día';
  return ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime;
}

/** "en 17 h 8 min", "en 3 días" */
export function countdown(ms: number) {
  if (ms <= 0) return 'ahora';
  const min = Math.round(ms / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `en ${h} h ${min % 60} min`;
  const days = Math.round(h / 24);
  return days === 1 ? 'en 1 día' : `en ${days} días`;
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const euros = (cents: number) => eur.format(cents / 100);

export function parseEuros(s: string): number | null {
  const clean = s.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function memberNames(ids: string[] | undefined, members: Member[]) {
  return joinNames((ids ?? []).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean) as string[]);
}

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}
