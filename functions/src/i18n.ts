// Notification text in every supported language. logic.ts decides WHAT to
// send; this module only decides HOW to say it. Pure and dependency-free
// (only the app's shared modules), like logic.ts.
//
// Every language must produce the same messages: only wording changes, never
// which messages exist, their order, dedupe keys, tags or URLs.
import type { Lang } from '../../src/shared/types';
import { diffDays, parts, weekday, type DateStr } from '../../src/shared/dates';

export type { Lang };

export const LANGS: readonly Lang[] = ['es', 'en'];
/** Language used when a device doesn't say (or says something unknown). */
export const DEFAULT_LANG: Lang = 'es';

/** Normalizes a stored language: 'es' | 'en', anything else ⇒ DEFAULT_LANG. */
export function toLang(x: unknown): Lang {
  return (LANGS as readonly unknown[]).includes(x) ? (x as Lang) : DEFAULT_LANG;
}

/** '09:05' → '9:05' (24 h in every language). */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  return `${Number(h)}:${m}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Everything a language has to provide. Dates are local 'YYYY-MM-DD'. */
export interface Texts {
  /** BCP 47 locale, for sorting titles. */
  locale: string;

  // ---- building blocks ----
  /** 'jueves 22' / 'Thursday 22' */
  dayName(d: DateStr): string;
  /** 'jue 29 oct' / 'Thu 29 Oct' (with the year when it isn't `today`'s). */
  shortDate(d: DateStr, today?: DateStr): string;
  /** 'Hoy' / 'Today', 'Mañana' / 'Tomorrow', 'El sábado 24' / 'On Saturday 24', … */
  relativeDay(d: DateStr, today: DateStr): string;
  /** 'a, b y c' / 'a, b and c'; with `max`, 'a, b y 2 más' / 'a, b and 2 more'. */
  list(items: string[], max?: number): string;
  /** Cents → '45,90 €' / '€45.90' */
  money(cents: number): string;

  // ---- 1. event reminders ----
  untitledEvent: string;
  /** 'Hoy a las 17:00' / 'Today at 17:00'; all day (time null): 'Mañana, todo el día' / 'Tomorrow, all day'. */
  reminderWhen(date: DateStr, time: string | null, today: DateStr): string;
  /** Multi-day events: ' (hasta el martes 27)' / ' (until Tuesday 27)'. */
  until(endDate: DateStr): string;

  // ---- 4. key dates (n = days left, 0 = today) ----
  untitledKeyDate: string;
  /** 'Cumpleaños de Noa' / "Noa's birthday"; with no name, 'Cumpleaños' / 'Birthday'. */
  birthdayOf(name: string): string;
  /** age is null when the birth year isn't credible. */
  birthdayBody(n: number, age: number | null, d: DateStr, today: DateStr): string;
  /** `due`: things that fall due (car, insurance, bill): 'Vence hoy' / 'Due today'. */
  keyDateBody(n: number, due: boolean, d: DateStr, today: DateStr): string;

  // ---- 3. daily summary ----
  greeting(hour: number): string;
  allDay: string;
  moreEvents(n: number): string;
  lunch: string;
  dinner: string;
  oneTask(title: string, overdue: boolean): string;
  /** `titles` is already joined with `list`. */
  manyTasks(count: number, overdue: number, titles: string): string;
  /** Birthday line suffix: '4 años' / 'turns 4'. */
  ageNote(age: number): string;
  dueToday: string;

  // ---- 2. activity ----
  /** Title when the actor has no name. */
  someone: string;
  /** One line of an activity digest; `texts` are the distinct item texts. */
  activityLine(kind: string, texts: string[], max: number): string;
}

// =====================================================================
// Spanish
// =====================================================================

const ES_WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const ES_WEEKDAYS_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const ES_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ES_MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** Spanish "and": 'e' before words starting with an /i/ sound ("Lía e Iker"), otherwise 'y'. */
function esAnd(next: string): string {
  const w = next.trim().toLocaleLowerCase('es-ES');
  if (/^[ií]/.test(w)) return 'e';
  if (/^h[ií]/.test(w) && !/^hi[aeiouáéó]/.test(w)) return 'e';
  return 'y';
}

/** Spanish list: ['a','b','c'] → 'a, b y c'; with `max`, 'a, b, c y 2 más'. */
export function listEs(items: string[], max = Infinity): string {
  const xs = items.filter(Boolean);
  if (xs.length > max) return `${xs.slice(0, max).join(', ')} y ${xs.length - max} más`;
  if (xs.length <= 1) return xs[0] ?? '';
  const last = xs[xs.length - 1];
  return `${xs.slice(0, -1).join(', ')} ${esAnd(last)} ${last}`;
}

const esEuro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const esDayName = (d: DateStr) => `${ES_WEEKDAYS[weekday(d)]} ${parts(d).d}`;
const esShortDate = (d: DateStr, today?: DateStr) => {
  const p = parts(d);
  const year = today && parts(today).y !== p.y ? ` ${p.y}` : '';
  return `${ES_WEEKDAYS_SHORT[weekday(d)]} ${p.d} ${ES_MONTHS_SHORT[p.m - 1]}${year}`;
};
/** 'a las 17:00', 'a la 1:30' */
const esAtTime = (t: string) => `${Number(t.split(':')[0]) === 1 ? 'a la' : 'a las'} ${fmtTime(t)}`;
const esYears = (n: number) => `${n} ${plural(n, 'año', 'años')}`;

export const es: Texts = {
  locale: 'es-ES',
  dayName: esDayName,
  shortDate: esShortDate,
  relativeDay(d, today) {
    const n = diffDays(d, today);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    if (n === -1) return 'Ayer';
    if (n > 1 && n < 7) return `El ${esDayName(d)}`;
    const p = parts(d);
    const year = parts(today).y !== p.y ? ` de ${p.y}` : '';
    return `El ${esDayName(d)} de ${ES_MONTHS[p.m - 1]}${year}`;
  },
  list: listEs,
  money: (cents) => esEuro.format(cents / 100),

  untitledEvent: 'Evento',
  reminderWhen(date, time, today) {
    const day = es.relativeDay(date, today);
    return time ? `${day} ${esAtTime(time)}` : `${day}, todo el día`;
  },
  until: (end) => ` (hasta el ${esDayName(end)})`,

  untitledKeyDate: 'Fecha importante',
  birthdayOf: (name) => (name ? `Cumpleaños de ${name}` : 'Cumpleaños'),
  birthdayBody(n, age, d, today) {
    const years = age != null ? esYears(age) : null;
    if (n === 0) return years ? `¡Hoy cumple ${years}!` : '¡Hoy es su cumpleaños!';
    if (n === 1) return years ? `Mañana cumple ${years}` : 'Mañana es su cumpleaños';
    const when = `${n} días (${esShortDate(d, today)})`;
    return years ? `Cumple ${years} en ${when}` : `En ${when}`;
  },
  keyDateBody(n, due, d, today) {
    if (n === 0) return due ? 'Vence hoy' : 'Hoy';
    if (n === 1) return due ? 'Vence mañana' : 'Mañana';
    const when = `${n} días (${esShortDate(d, today)})`;
    return due ? `Vence en ${when}` : `En ${when}`;
  },

  greeting: (hour) => (hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'),
  allDay: 'Todo el día',
  moreEvents: (n) => `y ${n} ${plural(n, 'evento', 'eventos')} más`,
  lunch: 'Comida',
  dinner: 'Cena',
  oneTask: (title, overdue) => `Tarea: ${title}${overdue ? ' (atrasada)' : ''}`,
  manyTasks: (count, overdue, titles) =>
    `${count} tareas${overdue ? ` (${overdue} ${plural(overdue, 'atrasada', 'atrasadas')})` : ''}: ${titles}`,
  ageNote: esYears,
  dueToday: 'vence hoy',

  someone: 'Alguien de casa',
  activityLine(kind, texts, max) {
    const n = texts.length;
    const list = listEs(texts, max);
    const withList = (label: string) => (n ? `${label}: ${list}` : label);
    switch (kind) {
      case 'shopping': return n ? `Ha añadido a la compra: ${list}` : 'Ha actualizado la compra';
      case 'event': return withList(plural(n, 'Nuevo evento', 'Nuevos eventos'));
      case 'task': return withList(plural(n, 'Nueva tarea', 'Nuevas tareas'));
      case 'note': return withList(plural(n, 'Nueva nota', 'Nuevas notas'));
      case 'expense': return withList(plural(n, 'Nuevo gasto', 'Nuevos gastos'));
      case 'date': return withList(plural(n, 'Nueva fecha', 'Nuevas fechas'));
      case 'menu': return 'Menú actualizado';
      default: return withList('Cambios');
    }
  },
};

// =====================================================================
// English
// =====================================================================

const EN_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EN_WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** English list: ['a','b','c'] → 'a, b and c'; with `max`, 'a, b, c and 2 more'. */
export function listEn(items: string[], max = Infinity): string {
  const xs = items.filter(Boolean);
  if (xs.length > max) return `${xs.slice(0, max).join(', ')} and ${xs.length - max} more`;
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

const enEuro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const enDayName = (d: DateStr) => `${EN_WEEKDAYS[weekday(d)]} ${parts(d).d}`;
const enShortDate = (d: DateStr, today?: DateStr) => {
  const p = parts(d);
  const year = today && parts(today).y !== p.y ? ` ${p.y}` : '';
  return `${EN_WEEKDAYS_SHORT[weekday(d)]} ${p.d} ${EN_MONTHS_SHORT[p.m - 1]}${year}`;
};

export const en: Texts = {
  locale: 'en-GB',
  dayName: enDayName,
  shortDate: enShortDate,
  relativeDay(d, today) {
    const n = diffDays(d, today);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1 && n < 7) return `On ${enDayName(d)}`;
    const p = parts(d);
    const year = parts(today).y !== p.y ? ` ${p.y}` : '';
    return `On ${enDayName(d)} ${EN_MONTHS[p.m - 1]}${year}`;
  },
  list: listEn,
  money: (cents) => enEuro.format(cents / 100),

  untitledEvent: 'Event',
  reminderWhen(date, time, today) {
    const day = en.relativeDay(date, today);
    return time ? `${day} at ${fmtTime(time)}` : `${day}, all day`;
  },
  until: (end) => ` (until ${enDayName(end)})`,

  untitledKeyDate: 'Important date',
  birthdayOf: (name) => (name ? `${name}'s birthday` : 'Birthday'),
  birthdayBody(n, age, d, today) {
    if (n === 0) return age != null ? `Turns ${age} today!` : "It's their birthday today!";
    if (n === 1) return age != null ? `Turns ${age} tomorrow` : 'Their birthday is tomorrow';
    const when = `${n} days (${enShortDate(d, today)})`;
    return age != null ? `Turns ${age} in ${when}` : `In ${when}`;
  },
  keyDateBody(n, due, d, today) {
    if (n === 0) return due ? 'Due today' : 'Today';
    if (n === 1) return due ? 'Due tomorrow' : 'Tomorrow';
    const when = `${n} days (${enShortDate(d, today)})`;
    return due ? `Due in ${when}` : `In ${when}`;
  },

  greeting: (hour) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'),
  allDay: 'All day',
  moreEvents: (n) => `and ${n} more ${plural(n, 'event', 'events')}`,
  lunch: 'Lunch',
  dinner: 'Dinner',
  oneTask: (title, overdue) => `Task: ${title}${overdue ? ' (overdue)' : ''}`,
  manyTasks: (count, overdue, titles) => `${count} tasks${overdue ? ` (${overdue} overdue)` : ''}: ${titles}`,
  ageNote: (age) => `turns ${age}`,
  dueToday: 'due today',

  someone: 'Someone at home',
  activityLine(kind, texts, max) {
    const n = texts.length;
    const list = listEn(texts, max);
    const withList = (label: string) => (n ? `${label}: ${list}` : label);
    switch (kind) {
      case 'shopping': return n ? `Added to the shopping list: ${list}` : 'Updated the shopping list';
      case 'event': return withList(plural(n, 'New event', 'New events'));
      case 'task': return withList(plural(n, 'New task', 'New tasks'));
      case 'note': return withList(plural(n, 'New note', 'New notes'));
      case 'expense': return withList(plural(n, 'New expense', 'New expenses'));
      case 'date': return withList(plural(n, 'New key date', 'New key dates'));
      case 'menu': return 'Updated the menu';
      default: return withList('Changes');
    }
  },
};

const TEXTS: Record<Lang, Texts> = { es, en };

/** Texts for a language (unknown ⇒ DEFAULT_LANG). */
export function texts(lang: Lang): Texts {
  return TEXTS[toLang(lang)];
}
