// Expansión de eventos repetidos, fechas clave y tareas periódicas.
import {
  type DateStr, addDays, addMonthsClamped, diffDays, maxDate, parts, startOfWeek, weekday, ymd, daysInMonth,
} from './dates';
import type { CalEvent, KeyDate, Recurrence, Task } from './types';

const MAX_ITER = 5000;

/**
 * Fechas de inicio de las repeticiones cuyo intervalo [inicio, inicio+duración]
 * se solapa con [from, to] (ambos inclusive).
 */
export function occurrenceStarts(
  start: DateStr,
  durationDays: number,
  rec: Recurrence | null | undefined,
  from: DateStr,
  to: DateStr,
  exdates: string[] = [],
): DateStr[] {
  const lo = addDays(from, -durationDays); // primer inicio que aún pisa el rango
  const out: DateStr[] = [];
  const push = (s: DateStr) => {
    if (s >= start && s >= lo && s <= to && !exdates.includes(s)) out.push(s);
  };

  if (!rec) {
    push(start);
    return out;
  }

  const until = rec.until && rec.until < to ? rec.until : to;
  const interval = Math.max(1, rec.interval || 1);
  const first = maxDate(start, lo);

  switch (rec.freq) {
    case 'daily': {
      const k = Math.max(0, Math.ceil(diffDays(first, start) / interval));
      for (let i = k, n = 0; n < MAX_ITER; i++, n++) {
        const s = addDays(start, i * interval);
        if (s > until) break;
        push(s);
      }
      break;
    }
    case 'weekly': {
      const days = (rec.byWeekday?.length ? rec.byWeekday : [weekday(start)]).slice().sort();
      const week0 = startOfWeek(start);
      const weeksFirst = Math.floor(diffDays(startOfWeek(first), week0) / 7);
      let w = Math.max(0, Math.ceil(weeksFirst / interval) * interval);
      if (w > weeksFirst) w = Math.max(0, w - interval); // la semana anterior puede pisar el rango
      for (let n = 0; n < MAX_ITER; n++, w += interval) {
        const ws = addDays(week0, w * 7);
        if (ws > until) break;
        for (const d of days) {
          const s = addDays(ws, d);
          if (s <= until) push(s);
        }
      }
      break;
    }
    case 'monthly': {
      const p = parts(start);
      const monthsFirst = (parts(first).y - p.y) * 12 + (parts(first).m - p.m) - 1;
      let i = Math.max(0, Math.floor(monthsFirst / interval) * interval);
      for (let n = 0; n < MAX_ITER; n++, i += interval) {
        const s = addMonthsClamped(ymd(p.y, p.m, 1), i, p.d);
        if (s > until) break;
        push(s);
      }
      break;
    }
    case 'yearly': {
      const p = parts(start);
      let y = Math.max(p.y, parts(first).y - 1);
      y = p.y + Math.ceil((y - p.y) / interval) * interval;
      for (let n = 0; n < MAX_ITER; n++, y += interval) {
        const s = ymd(y, p.m, Math.min(p.d, daysInMonth(y, p.m)));
        if (s > until) break;
        push(s);
      }
      break;
    }
  }
  return out;
}

export interface Occurrence {
  key: string;
  event: CalEvent;
  date: DateStr; // inicio de esta repetición
  endDate: DateStr;
}

export function eventDuration(ev: CalEvent): number {
  return ev.endDate && ev.endDate > ev.date ? diffDays(ev.endDate, ev.date) : 0;
}

export function expandEvents(events: CalEvent[], from: DateStr, to: DateStr): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) {
    const dur = eventDuration(ev);
    for (const s of occurrenceStarts(ev.date, dur, ev.recurrence, from, to, ev.exdates)) {
      out.push({ key: `${ev.id}_${s}`, event: ev, date: s, endDate: addDays(s, dur) });
    }
  }
  return out.sort(compareOcc);
}

export function compareOcc(a: Occurrence, b: Occurrence) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.event.startTime ?? '';
  const tb = b.event.startTime ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.event.title.localeCompare(b.event.title);
}

/** ¿La repetición cubre el día d? */
export function occursOn(o: Occurrence, d: DateStr) {
  return o.date <= d && o.endDate >= d;
}

export function keyDateRecurrence(kd: KeyDate): Recurrence | null {
  if (kd.repeat === 'yearly') return { freq: 'yearly', interval: 1 };
  if (kd.repeat === 'monthly') return { freq: 'monthly', interval: 1 };
  return null;
}

export function keyDateOccurrences(kd: KeyDate, from: DateStr, to: DateStr): DateStr[] {
  return occurrenceStarts(kd.date, 0, keyDateRecurrence(kd), from, to);
}

/** Próxima fecha (>= hoy) de una fecha clave, o null si ya pasó. */
export function nextKeyDate(kd: KeyDate, today: DateStr): DateStr | null {
  // El horizonte cuenta desde la primera fecha posible (puede estar a años vista).
  const base = maxDate(today, kd.date);
  const horizon = kd.repeat === 'monthly' ? addDays(base, 40) : addDays(base, 400);
  return keyDateOccurrences(kd, today, horizon)[0] ?? null;
}

function addRepeat(d: DateStr, every: number, unit: 'day' | 'week' | 'month'): DateStr {
  if (unit === 'day') return addDays(d, every);
  if (unit === 'week') return addDays(d, every * 7);
  return addMonthsClamped(d, every);
}

/** Siguiente vencimiento de una tarea periódica al marcarla como hecha. */
export function nextTaskDue(task: Task, today: DateStr): DateStr | null {
  if (!task.repeat) return null;
  const { every, unit } = task.repeat;
  let next = addRepeat(task.due ?? today, every, unit);
  for (let n = 0; next <= today && n < MAX_ITER; n++) next = addRepeat(next, every, unit);
  return next;
}
