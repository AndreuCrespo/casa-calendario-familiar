// Utilidades de fechas sin dependencias. Una fecha es 'YYYY-MM-DD' y se
// opera en UTC para que los cambios de hora no muevan los días.

export type DateStr = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toUTC(d: DateStr): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fromUTC(dt: Date): DateStr {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function ymd(y: number, m: number, d: number): DateStr {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parts(d: DateStr) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, d: day };
}

export function addDays(d: DateStr, n: number): DateStr {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Suma meses fijando el día (o el último del mes si no existe). */
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

/** 0 = lunes … 6 = domingo */
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
  const dt = toUTC(addDays(d, 3 - weekday(d))); // jueves de esa semana
  const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.floor((dt.getTime() - jan1.getTime()) / 86400000 / 7) + 1;
}

export function minDate(a: DateStr, b: DateStr) { return a < b ? a : b; }
export function maxDate(a: DateStr, b: DateStr) { return a > b ? a : b; }

// ---------- zonas horarias ----------

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Fecha y hora locales de un instante en la zona dada. */
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
  const p = zonedParts(ts, tz);
  const [y, m, d] = p.date.split('-').map(Number);
  const asUTC = Date.UTC(y, m - 1, d, p.hour, p.minute, p.second);
  return asUTC - Math.floor(ts / 1000) * 1000;
}

/**
 * Convierte fecha+hora locales de la zona a un instante (ms).
 * Como en RFC 5545: una hora repetida (otoño) es la primera de las dos y una
 * hora inexistente (primavera) se adelanta (02:30 → 03:30), en cualquier zona.
 */
export function zonedToUtc(date: DateStr, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const before = offsetAt(guess - 86400000, tz); // desfase antes de un posible cambio
  const tsBefore = guess - before;
  if (offsetAt(tsBefore, tz) === before) return tsBefore;
  const after = offsetAt(guess + 86400000, tz);
  const tsAfter = guess - after;
  if (offsetAt(tsAfter, tz) === after) return tsAfter;
  return tsBefore; // hueco: con el desfase anterior cae justo después del cambio
}

export function todayIn(tz: string, now = Date.now()): DateStr {
  return zonedParts(now, tz).date;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
