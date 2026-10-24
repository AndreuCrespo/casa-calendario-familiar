// Day-by-day view of events, key dates and meals, and "what's next".
import { useMemo } from 'react';
import { useApp, useCollection, useToday } from '../../core/app';
import { useNow } from '../../core/clock';
import { addDays, type DateStr, zonedToUtc } from '../../shared/dates';
import { expandEvents, keyDateOccurrences, type Occurrence, occursOn } from '../../shared/recurrence';
import type { CalEvent, KeyDate, MenuDay } from '../../shared/types';
import { useMenu } from '../menu/menu';

export interface DayAgenda {
  date: DateStr;
  allDay: Occurrence[];
  timed: Occurrence[];
  keyDates: KeyDate[];
  menu?: MenuDay;
}

/** Days between from and to (inclusive), each with what happens on it. */
export function buildAgenda(
  input: { events: readonly CalEvent[]; keyDates: readonly KeyDate[]; menu: readonly MenuDay[] },
  from: DateStr,
  to: DateStr,
  memberFilter?: readonly string[] | null,
): DayAgenda[] {
  let occ = expandEvents([...input.events], from, to);
  if (memberFilter) {
    occ = occ.filter((o) => !o.event.memberIds?.length || o.event.memberIds.some((id) => memberFilter.includes(id)));
  }
  const menuById = new Map(input.menu.map((m) => [m.id, m]));
  const kdByDate = new Map<DateStr, KeyDate[]>();
  for (const kd of input.keyDates) {
    for (const d of keyDateOccurrences(kd, from, to)) kdByDate.set(d, [...(kdByDate.get(d) ?? []), kd]);
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
}

/** Start and end (ms) of a timed occurrence; an end before the start means the next day. */
export function occurrenceBounds(o: Occurrence, tz: string): { start: number; end: number } | null {
  if (!o.event.startTime) return null;
  const start = zonedToUtc(o.date, o.event.startTime, tz);
  let end = o.event.endTime ? zonedToUtc(o.endDate, o.event.endTime, tz) : start + 3_600_000;
  if (end <= start) end += 86_400_000; // e.g. a night shift 22:00–06:00
  return { start, end };
}

export interface NextUp {
  occ: Occurrence;
  start: number;
  end: number;
}

/** The timed event in progress or starting next, within two weeks. */
export function nextUp(events: readonly CalEvent[], now: number, today: DateStr, tz: string): NextUp | null {
  let best: NextUp | null = null;
  for (const occ of expandEvents([...events], addDays(today, -1), addDays(today, 14))) {
    const b = occurrenceBounds(occ, tz);
    if (!b || b.end <= now) continue;
    if (!best || b.start < best.start) best = { occ, ...b };
  }
  return best;
}

export function useAgenda(from: DateStr, to: DateStr, memberFilter?: readonly string[] | null) {
  const events = useCollection('events');
  const keyDates = useCollection('dates');
  const menu = useMenu(from, to);
  return useMemo(
    () => buildAgenda({ events: events ?? [], keyDates: keyDates ?? [], menu: menu ?? [] }, from, to, memberFilter),
    [events, keyDates, menu, from, to, memberFilter],
  );
}

export function useNextUp(): { next: NextUp | null; now: number; today: DateStr } {
  const { tz } = useApp();
  const now = useNow();
  const today = useToday();
  const events = useCollection('events');
  const next = useMemo(() => nextUp(events ?? [], now, today, tz), [events, now, today, tz]);
  return { next, now, today };
}
