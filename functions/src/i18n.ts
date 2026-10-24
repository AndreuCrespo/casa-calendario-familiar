// Notification text in every supported language. logic.ts decides WHAT to
// send; this module only decides HOW to say it. Pure and dependency-free
// (only the app's shared modules), like logic.ts.
import { type DateStr, diffDays, parts, type TimeStr, weekday } from '../../src/shared/dates';
import { CALENDAR_NAMES, LOCALE, toLang } from '../../src/shared/locale';
import { joinList } from '../../src/shared/text';
import type { Lang } from '../../src/shared/types';

/** '09:05' → '9:05' (24 h in every language). */
export function fmtTime(t: TimeStr): string {
  const [h = '', m = ''] = t.split(':');
  return `${Number(h)}:${m}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const at = (xs: readonly string[], i: number) => xs[i] ?? '';

/** List with an optional cap: 'a, b y 2 más' / 'a, b and 2 more'. */
function lister(lang: Lang, more: (n: number) => string) {
  return (items: string[], max = Number.POSITIVE_INFINITY): string => {
    const xs = items.filter((s) => s.trim() !== '');
    return xs.length > max ? `${xs.slice(0, max).join(', ')} ${more(xs.length - max)}` : joinList(xs, lang);
  };
}

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

  // ---- event reminders ----
  untitledEvent: string;
  /** 'Hoy a las 17:00' / 'Today at 17:00'; all day (time null): 'Mañana, todo el día' / 'Tomorrow, all day'. */
  reminderWhen(date: DateStr, time: TimeStr | null, today: DateStr): string;
  /** Multi-day events: ' (hasta el martes 27)' / ' (until Tuesday 27)'. */
  until(endDate: DateStr): string;

  // ---- key dates (n = days left, 0 = today) ----
  untitledKeyDate: string;
  /** 'Cumpleaños de Noa' / "Noa's birthday"; with no name, 'Cumpleaños' / 'Birthday'. */
  birthdayOf(name: string): string;
  /** age is null when the birth year isn't credible. */
  birthdayBody(n: number, age: number | null, d: DateStr, today: DateStr): string;
  /** `due`: things that fall due (car, insurance, bill): 'Vence hoy' / 'Due today'. */
  keyDateBody(n: number, due: boolean, d: DateStr, today: DateStr): string;

  // ---- daily summary ----
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

  // ---- activity ----
  /** Title when the actor has no name. */
  someone: string;
  /** One line of an activity digest; `texts` are the distinct item texts. */
  activityLine(kind: string, texts: string[], max: number): string;
}

// =====================================================================
// Spanish
// =====================================================================

const ES = CALENDAR_NAMES.es;
const esList = lister('es', (n) => `y ${n} más`);
const esEuro = new Intl.NumberFormat(LOCALE.es, { style: 'currency', currency: 'EUR' });
const esDayName = (d: DateStr) => `${at(ES.weekdays, weekday(d))} ${parts(d).d}`;
const esShortDate = (d: DateStr, today?: DateStr) => {
  const p = parts(d);
  const year = today && parts(today).y !== p.y ? ` ${p.y}` : '';
  return `${at(ES.weekdaysShort, weekday(d))} ${p.d} ${at(ES.monthsShort, p.m - 1)}${year}`;
};
/** 'a las 17:00', 'a la 1:30' */
const esAtTime = (t: TimeStr) => `${Number(t.split(':')[0]) === 1 ? 'a la' : 'a las'} ${fmtTime(t)}`;
const esYears = (n: number) => `${n} ${plural(n, 'año', 'años')}`;

const es: Texts = {
  locale: LOCALE.es,
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
    return `El ${esDayName(d)} de ${at(ES.months, p.m - 1)}${year}`;
  },
  list: esList,
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
    const list = esList(texts, max);
    const withList = (label: string) => (n ? `${label}: ${list}` : label);
    switch (kind) {
      case 'shopping':
        return n ? `Ha añadido a la compra: ${list}` : 'Ha actualizado la compra';
      case 'event':
        return withList(plural(n, 'Nuevo evento', 'Nuevos eventos'));
      case 'task':
        return withList(plural(n, 'Nueva tarea', 'Nuevas tareas'));
      case 'note':
        return withList(plural(n, 'Nueva nota', 'Nuevas notas'));
      case 'expense':
        return withList(plural(n, 'Nuevo gasto', 'Nuevos gastos'));
      case 'date':
        return withList(plural(n, 'Nueva fecha', 'Nuevas fechas'));
      case 'menu':
        return 'Menú actualizado';
      default:
        return withList('Cambios');
    }
  },
};

// =====================================================================
// English
// =====================================================================

const EN = CALENDAR_NAMES.en;
const enList = lister('en', (n) => `and ${n} more`);
const enEuro = new Intl.NumberFormat(LOCALE.en, { style: 'currency', currency: 'EUR' });
const enDayName = (d: DateStr) => `${at(EN.weekdays, weekday(d))} ${parts(d).d}`;
const enShortDate = (d: DateStr, today?: DateStr) => {
  const p = parts(d);
  const year = today && parts(today).y !== p.y ? ` ${p.y}` : '';
  return `${at(EN.weekdaysShort, weekday(d))} ${p.d} ${at(EN.monthsShort, p.m - 1)}${year}`;
};

const en: Texts = {
  locale: LOCALE.en,
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
    return `On ${enDayName(d)} ${at(EN.months, p.m - 1)}${year}`;
  },
  list: enList,
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
    const list = enList(texts, max);
    const withList = (label: string) => (n ? `${label}: ${list}` : label);
    switch (kind) {
      case 'shopping':
        return n ? `Added to the shopping list: ${list}` : 'Updated the shopping list';
      case 'event':
        return withList(plural(n, 'New event', 'New events'));
      case 'task':
        return withList(plural(n, 'New task', 'New tasks'));
      case 'note':
        return withList(plural(n, 'New note', 'New notes'));
      case 'expense':
        return withList(plural(n, 'New expense', 'New expenses'));
      case 'date':
        return withList(plural(n, 'New key date', 'New key dates'));
      case 'menu':
        return 'Updated the menu';
      default:
        return withList('Changes');
    }
  },
};

const TEXTS: Record<Lang, Texts> = { es, en };

/** Texts for a language (unknown ⇒ the default language). */
export function texts(lang: Lang): Texts {
  return TEXTS[toLang(lang)];
}
