import { useMemo } from 'react';
import { useApp, useCollection } from './app';
import { addDays, diffDays, parts, zonedToUtc, type DateStr } from '../shared/dates';
import { expandEvents, keyDateOccurrences, occursOn, type Occurrence } from '../shared/recurrence';
import type { CalEvent, KeyDate, MenuDay } from '../shared/types';

export interface DayAgenda {
  date: DateStr;
  allDay: Occurrence[];
  timed: Occurrence[];
  keyDates: KeyDate[];
  menu?: MenuDay;
}

export function useCalendarData() {
  const events = useCollection<CalEvent>('events');
  const keyDates = useCollection<KeyDate>('dates');
  const menu = useCollection<MenuDay>('menu');
  return { events, keyDates, menu, loading: !events };
}

/** Agenda día a día entre from y to (inclusive). */
export function useAgenda(from: DateStr, to: DateStr, memberFilter?: string[] | null) {
  const { events, keyDates, menu } = useCalendarData();
  return useMemo(() => {
    let occ = expandEvents(events ?? [], from, to);
    if (memberFilter) {
      occ = occ.filter((o) => !o.event.memberIds?.length || o.event.memberIds.some((id) => memberFilter.includes(id)));
    }
    const menuById = new Map((menu ?? []).map((m) => [m.id, m]));
    const kdByDate = new Map<DateStr, KeyDate[]>();
    for (const kd of keyDates ?? []) {
      for (const d of keyDateOccurrences(kd, from, to)) {
        if (!kdByDate.has(d)) kdByDate.set(d, []);
        kdByDate.get(d)!.push(kd);
      }
    }
    const days: DayAgenda[] = [];
    for (let d = from, n = 0; d <= to && n < 400; d = addDays(d, 1), n++) {
      const todays = occ.filter((o) => occursOn(o, d));
      days.push({
        date: d,
        allDay: todays.filter((o) => !o.event.startTime || o.date !== d),
        timed: todays.filter((o) => o.event.startTime && o.date === d),
        keyDates: kdByDate.get(d) ?? [],
        menu: menuById.get(d),
      });
    }
    return days;
  }, [events, keyDates, menu, from, to, memberFilter]);
}

export interface NextUp { occ: Occurrence; start: number; end: number }

/** Próximo evento con hora (o en curso) a partir de ahora. */
export function useNextUp(now: number, today: DateStr): NextUp | null {
  const { tz } = useApp();
  const { events } = useCalendarData();
  return useMemo(() => {
    const occ = expandEvents(events ?? [], addDays(today, -1), addDays(today, 14));
    let best: NextUp | null = null;
    for (const o of occ) {
      if (!o.event.startTime) continue;
      const start = zonedToUtc(o.date, o.event.startTime, tz);
      let end = o.event.endTime ? zonedToUtc(o.endDate, o.event.endTime, tz) : start + 3600_000;
      if (end <= start) end += 86400_000; // termina al día siguiente (turnos de noche)
      if (end <= now) continue;
      if (!best || start < best.start) best = { occ: o, start, end };
    }
    return best;
  }, [events, now, today, tz]);
}

export function keyDateEmoji(kind: KeyDate['kind']) {
  return { birthday: '🎂', car: '🚗', insurance: '🛡️', bill: '🧾', health: '🩺', school: '🎒', other: '📌' }[kind] ?? '📌';
}

/** "Lía (3)" para cumpleaños, el título en el resto. */
export function keyDateLabel(kd: KeyDate, on: DateStr) {
  if (kd.kind !== 'birthday') return kd.title;
  const age = parts(on).y - parts(kd.date).y;
  return age > 0 && age < 120 ? `${kd.title} cumple ${age}` : `Cumple ${kd.title}`;
}

export function daysUntil(d: DateStr, today: DateStr) {
  return diffDays(d, today);
}
