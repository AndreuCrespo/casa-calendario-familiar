// Dependency-free date utilities. A date is 'YYYY-MM-DD' and the math is
// done in UTC so daylight-saving changes never shift days.

/** Local date, 'YYYY-MM-DD'. */
export type DateStr = string;
/** Local time, 'HH:mm' (24 h). */
export type TimeStr = string;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Is it a well-formed 'YYYY-MM-DD'? (A 31st in a 30-day month isn't caught.) */
export const isDateStr = (x: unknown): x is DateStr => typeof x === 'string' && DATE_RE.test(x);
/** Is it a well-formed 'HH:mm' (or 'H:mm')? */
export const isTimeStr = (x: unknown): x is TimeStr => typeof x === 'string' && TIME_RE.test(x);

const pad = (n: number) => String(n).padStart(2, '0');

export function parts(d: DateStr) {
  const [y = Number.NaN, m = Number.NaN, day = Number.NaN] = d.split('-').map(Number);
  return { y, m, d: day };
}

export function toUTC(d: DateStr): Date {
  const p = parts(d);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

export function fromUTC(dt: Date): DateStr {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function ymd(y: number, m: number, d: number): DateStr {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function addDays(d: DateStr, n: number): DateStr {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Adds months keeping the day (or the last day of the month if it doesn't exist). */
export function addMonthsClamped(d: DateStr, n: number, day?: number): DateStr {
  const p = parts(d);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return ymd(y, m, Math.min(day ?? p.d, daysInMonth(y, m)));
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000);
}

/** 0 = Monday … 6 = Sunday */
export function weekday(d: DateStr): number {
  return (toUTC(d).getUTCDay() + 6) % 7;
}

export function startOfWeek(d: DateStr): DateStr {
  return addDays(d, -weekday(d));
}

export function startOfMonth(d: DateStr): DateStr {
  const p = parts(d);
  return ymd(p.y, p.m, 1);
}

export function isoWeek(d: DateStr): number {
  const dt = toUTC(addDays(d, 3 - weekday(d))); // Thursday of that week
  const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.floor((dt.getTime() - jan1.getTime()) / 86400000 / 7) + 1;
}

export function minDate(a: DateStr, b: DateStr) {
  return a < b ? a : b;
}
export function maxDate(a: DateStr, b: DateStr) {
  return a > b ? a : b;
}

// ---------- time zones ----------

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Local date and time of an instant in the given zone. */
export function zonedParts(ts: number, tz: string) {
  const p: Record<string, string> = {};
  for (const x of fmtFor(tz).formatToParts(new Date(ts))) p[x.type] = x.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

function offsetAt(ts: number, tz: string): number {
  const z = zonedParts(ts, tz);
  const p = parts(z.date);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, z.hour, z.minute, z.second);
  return asUTC - Math.floor(ts / 1000) * 1000;
}

/**
 * Converts a local date+time in the zone to an instant (ms).
 * As in RFC 5545: a repeated time (autumn) is the first of the two, and a
 * non-existent time (spring) is moved forward (02:30 → 03:30), in any zone.
 */
export function zonedToUtc(date: DateStr, time: TimeStr, tz: string): number {
  const p = parts(date);
  const guess = Date.UTC(p.y, p.m - 1, p.d) + timeToMinutes(time) * 60_000;
  const before = offsetAt(guess - 86400000, tz); // offset before a possible change
  const tsBefore = guess - before;
  if (offsetAt(tsBefore, tz) === before) return tsBefore;
  const after = offsetAt(guess + 86400000, tz);
  const tsAfter = guess - after;
  if (offsetAt(tsAfter, tz) === after) return tsAfter;
  return tsBefore; // gap: with the earlier offset it lands right after the change
}

/** Today's date in a time zone (`now` defaults to the current instant). */
export function todayIn(tz: string, now = Date.now()): DateStr {
  return zonedParts(now, tz).date;
}

export function timeToMinutes(t: TimeStr): number {
  const [h = Number.NaN, m = Number.NaN] = t.split(':').map(Number);
  return h * 60 + m;
}
