// Languages and calendar names shared by the app and the notifier, so both
// spell dates the same way without depending on the runtime's Intl data.
import type { Lang } from './types';

export const LANG_IDS: readonly Lang[] = ['es', 'en'];
/** Language of whatever doesn't say (or says something unknown). */
export const DEFAULT_LANG: Lang = 'es';

/** Normalizes a stored or detected language: 'es' | 'en', anything else ⇒ `fallback`. */
export function toLang(x: unknown, fallback: Lang = DEFAULT_LANG): Lang {
  return (LANG_IDS as readonly unknown[]).includes(x) ? (x as Lang) : fallback;
}

/** BCP 47 locale of each language (sorting, numbers, currency). */
export const LOCALE: Record<Lang, string> = { es: 'es-ES', en: 'en-GB' };

export interface CalendarNames {
  /** Monday first. */
  weekdays: readonly string[];
  weekdaysShort: readonly string[];
  months: readonly string[];
  monthsShort: readonly string[];
}

/** Written as each language does mid-sentence: lowercase in Spanish, capitalized in English. */
export const CALENDAR_NAMES: Record<Lang, CalendarNames> = {
  es: {
    weekdays: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    weekdaysShort: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
    months: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
    monthsShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  },
  en: {
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};
