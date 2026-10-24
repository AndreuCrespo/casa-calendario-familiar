import { describe, expect, it } from 'vitest';
import { zonedToUtc } from '../../shared/dates';
import type { CalEvent, KeyDate } from '../../shared/types';
import { buildAgenda, nextUp, occurrenceBounds } from './agenda';

const TZ = 'Europe/Madrid';
let n = 0;
const event = (e: Partial<CalEvent>): CalEvent => ({
  id: `ev${n++}`,
  title: 'Event',
  date: '2026-10-20',
  memberIds: [],
  ...e,
});

describe('buildAgenda', () => {
  it('places timed, all-day and multi-day events, key dates and meals on their days', () => {
    const timed = event({ startTime: '10:00', endTime: '11:00' });
    const trip = event({ date: '2026-10-19', endDate: '2026-10-21' });
    const birthday: KeyDate = {
      id: 'kd',
      title: 'Lía',
      kind: 'birthday',
      date: '2023-10-20',
      repeat: 'yearly',
      remindDays: 7,
    };
    const days = buildAgenda(
      { events: [timed, trip], keyDates: [birthday], menu: [{ id: '2026-10-20', lunch: 'Paella' }] },
      '2026-10-20',
      '2026-10-21',
    );
    expect(days.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-21']);
    expect(days[0]?.timed.map((o) => o.event)).toEqual([timed]);
    expect(days[0]?.allDay.map((o) => o.event)).toEqual([trip]);
    expect(days[0]?.keyDates).toEqual([birthday]);
    expect(days[0]?.menu?.lunch).toBe('Paella');
    expect(days[1]?.allDay.map((o) => o.event)).toEqual([trip]);
    expect(days[1]?.timed).toEqual([]);
  });

  it('filters by member but keeps events for everyone', () => {
    const mine = event({ memberIds: ['a'] });
    const theirs = event({ memberIds: ['b'] });
    const everyone = event({});
    const day = buildAgenda({ events: [mine, theirs, everyone], keyDates: [], menu: [] }, '2026-10-20', '2026-10-20', [
      'a',
    ])[0];
    expect(day?.allDay.map((o) => o.event)).toEqual(expect.arrayContaining([mine, everyone]));
    expect(day?.allDay.map((o) => o.event)).not.toContain(theirs);
  });
});

describe('occurrenceBounds and nextUp', () => {
  it('ends an overnight event the next morning', () => {
    const night = event({ startTime: '22:00', endTime: '06:00' });
    const b = occurrenceBounds({ key: 'k', event: night, date: '2026-10-20', endDate: '2026-10-20' }, TZ);
    expect(b?.end).toBe(zonedToUtc('2026-10-21', '06:00', TZ));
  });

  it('defaults to one hour without an end time and ignores all-day events', () => {
    const b = occurrenceBounds(
      { key: 'k', event: event({ startTime: '10:00' }), date: '2026-10-20', endDate: '2026-10-20' },
      TZ,
    );
    expect(b && b.end - b.start).toBe(3_600_000);
    expect(occurrenceBounds({ key: 'k', event: event({}), date: '2026-10-20', endDate: '2026-10-20' }, TZ)).toBeNull();
  });

  it('returns the event in progress before the next one', () => {
    const now = zonedToUtc('2026-10-20', '23:00', TZ);
    const night = event({ title: 'Night', startTime: '22:00', endTime: '06:00' });
    const morning = event({ title: 'Morning', date: '2026-10-21', startTime: '09:00' });
    expect(nextUp([morning, night], now, '2026-10-20', TZ)?.occ.event).toBe(night);
    const later = zonedToUtc('2026-10-21', '07:00', TZ);
    expect(nextUp([morning, night], later, '2026-10-21', TZ)?.occ.event).toBe(morning);
  });
});
