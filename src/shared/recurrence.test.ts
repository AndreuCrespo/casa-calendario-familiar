import { describe, expect, it } from 'vitest';
import { expandEvents, nextKeyDate, nextTaskDue, occurrenceStarts } from './recurrence';
import type { CalEvent, KeyDate, Recurrence, Task } from './types';

const ev = (e: Partial<CalEvent> & Pick<CalEvent, 'id' | 'title' | 'date'>): CalEvent => ({ memberIds: [], ...e });

describe('occurrenceStarts', () => {
  it('repeats daily every 2 days', () => {
    const rec: Recurrence = { freq: 'daily', interval: 2 };
    expect(occurrenceStarts('2026-10-01', 0, rec, '2026-10-20', '2026-10-26')).toEqual([
      '2026-10-21',
      '2026-10-23',
      '2026-10-25',
    ]);
    expect(occurrenceStarts('2026-10-01', 0, rec, '2026-09-01', '2026-10-05')).toEqual([
      '2026-10-01',
      '2026-10-03',
      '2026-10-05',
    ]);
  });

  it('repeats weekly on Monday and Wednesday every 2 weeks', () => {
    const rec: Recurrence = { freq: 'weekly', interval: 2, byWeekday: [2, 0] };
    // 2026-10-07 is a Wednesday; Monday 2026-10-05 is before the start and doesn't count.
    expect(occurrenceStarts('2026-10-07', 0, rec, '2026-10-01', '2026-11-10')).toEqual([
      '2026-10-07',
      '2026-10-19',
      '2026-10-21',
      '2026-11-02',
      '2026-11-04',
    ]);
    expect(occurrenceStarts('2026-10-07', 0, rec, '2026-10-27', '2026-11-03')).toEqual(['2026-11-02']);
    expect(occurrenceStarts('2026-10-07', 0, rec, '2027-01-01', '2027-01-14')).toEqual(['2027-01-11', '2027-01-13']);
    expect(occurrenceStarts('2026-10-07', 0, rec, '2026-10-26', '2026-10-30')).toEqual([]); // odd week
  });

  it('sorts weekdays as numbers and ignores invalid or repeated ones', () => {
    const start = '2026-10-05'; // Monday
    const week = (byWeekday: unknown) =>
      occurrenceStarts(start, 0, { freq: 'weekly', interval: 1, byWeekday } as Recurrence, start, '2026-10-11');
    expect(week([6, 0, 3])).toEqual(['2026-10-05', '2026-10-08', '2026-10-11']);
    expect(week([3, 3, 0])).toEqual(['2026-10-05', '2026-10-08']);
    expect(week([9, -1, 2.5, 'x', 4])).toEqual(['2026-10-09']);
    expect(week([9])).toEqual(['2026-10-05']); // none valid ⇒ the start's weekday
    expect(week(null)).toEqual(['2026-10-05']);
  });

  it('treats a bad interval as 1', () => {
    for (const interval of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(occurrenceStarts('2026-10-01', 0, { freq: 'daily', interval }, '2026-10-01', '2026-10-03')).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
      ]);
    }
    expect(occurrenceStarts('2026-10-01', 0, { freq: 'daily', interval: 2.7 }, '2026-10-01', '2026-10-05')).toEqual([
      '2026-10-01',
      '2026-10-03',
      '2026-10-05',
    ]);
  });

  it('yields nothing for a malformed start date', () => {
    expect(occurrenceStarts('', 0, null, '2026-10-01', '2026-10-31')).toEqual([]);
    expect(occurrenceStarts('22/10/2026', 0, { freq: 'daily', interval: 1 }, '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('repeats monthly on the 31st (clamped to the last day of the month)', () => {
    const rec: Recurrence = { freq: 'monthly', interval: 1 };
    expect(occurrenceStarts('2026-01-31', 0, rec, '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
    expect(occurrenceStarts('2026-01-31', 0, rec, '2026-11-01', '2026-11-30')).toEqual(['2026-11-30']);
    expect(occurrenceStarts('2026-01-31', 0, rec, '2028-02-01', '2028-03-01')).toEqual(['2028-02-29']);
    // every 2 months: Jan, Mar, May, Jul, Sep, Nov, Jan…
    expect(occurrenceStarts('2026-01-31', 0, { freq: 'monthly', interval: 2 }, '2026-08-01', '2027-01-31')).toEqual([
      '2026-09-30',
      '2026-11-30',
      '2027-01-31',
    ]);
    // every 5 months across a year boundary: Nov 2026, Apr 2027
    expect(occurrenceStarts('2026-06-15', 0, { freq: 'monthly', interval: 5 }, '2026-10-01', '2027-05-01')).toEqual([
      '2026-11-15',
      '2027-04-15',
    ]);
  });

  it('repeats yearly on 29 February', () => {
    const rec: Recurrence = { freq: 'yearly', interval: 1 };
    expect(occurrenceStarts('2024-02-29', 0, rec, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
    expect(occurrenceStarts('2024-02-29', 0, rec, '2026-10-22', '2027-10-22')).toEqual(['2027-02-28']);
  });

  it('includes multi-day events crossing the start of the range', () => {
    expect(occurrenceStarts('2026-10-18', 3, null, '2026-10-20', '2026-10-25')).toEqual(['2026-10-18']);
    expect(occurrenceStarts('2026-10-18', 3, null, '2026-10-21', '2026-10-25')).toEqual(['2026-10-18']);
    expect(occurrenceStarts('2026-10-18', 3, null, '2026-10-22', '2026-10-25')).toEqual([]);
    // weekly, Friday to Sunday: the one from Friday 16 still covers Sunday 18
    expect(occurrenceStarts('2026-10-02', 2, { freq: 'weekly', interval: 1 }, '2026-10-18', '2026-10-20')).toEqual([
      '2026-10-16',
    ]);
    // monthly, 3 days at the end of the month, spilling into the next month
    expect(occurrenceStarts('2026-01-30', 3, { freq: 'monthly', interval: 1 }, '2026-11-01', '2026-11-05')).toEqual([
      '2026-10-30',
    ]);
  });

  it('honours exdates and until', () => {
    expect(
      occurrenceStarts('2026-10-20', 0, { freq: 'daily', interval: 1 }, '2026-10-20', '2026-10-24', ['2026-10-22']),
    ).toEqual(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24']);
    expect(
      occurrenceStarts(
        '2026-10-01',
        0,
        { freq: 'weekly', interval: 1, until: '2026-10-15' },
        '2026-10-01',
        '2026-11-30',
      ),
    ).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
    expect(
      occurrenceStarts(
        '2026-10-01',
        0,
        { freq: 'daily', interval: 1, until: '2026-10-10' },
        '2026-10-20',
        '2026-10-30',
      ),
    ).toEqual([]);
    expect(occurrenceStarts('2026-10-20', 0, null, '2026-10-20', '2026-10-20', ['2026-10-20'])).toEqual([]);
  });
});

describe('expandEvents', () => {
  it('gives each occurrence its span and key', () => {
    const occ = expandEvents(
      [ev({ id: 'v', title: 'Vacaciones', date: '2026-10-18', endDate: '2026-10-21' })],
      '2026-10-20',
      '2026-10-25',
    );
    expect(occ.map((o) => [o.key, o.date, o.endDate])).toEqual([['v_2026-10-18', '2026-10-18', '2026-10-21']]);
  });

  it('sorts by date, then all-day, then time, then title', () => {
    const occ = expandEvents(
      [
        ev({ id: 'b', title: 'B', date: '2026-10-22', startTime: '10:00' }),
        ev({ id: 'a', title: 'A', date: '2026-10-22' }),
        ev({ id: 'c', title: 'C', date: '2026-10-21', startTime: '23:00' }),
      ],
      '2026-10-21',
      '2026-10-22',
    );
    expect(occ.map((o) => o.event.id)).toEqual(['c', 'a', 'b']);
  });

  it("doesn't throw on events without a title, in any order", () => {
    const untitled = { ...ev({ id: 'u', title: '', date: '2026-10-22', startTime: '17:00' }), title: undefined };
    const titled = ev({ id: 't', title: 'X', date: '2026-10-22', startTime: '17:00' });
    for (const list of [
      [untitled, titled],
      [titled, untitled],
    ]) {
      expect(expandEvents(list as unknown as CalEvent[], '2026-10-22', '2026-10-22')).toHaveLength(2);
    }
  });

  it('ignores a malformed end date', () => {
    const occ = expandEvents(
      [ev({ id: 'x', title: 'X', date: '2026-10-22', endDate: 'soon' })],
      '2026-10-22',
      '2026-10-23',
    );
    expect(occ.map((o) => o.endDate)).toEqual(['2026-10-22']);
  });
});

describe('nextKeyDate', () => {
  const kd = (k: Partial<KeyDate>): KeyDate => ({
    id: 'k',
    title: 'K',
    kind: 'other',
    date: '2026-01-31',
    repeat: 'none',
    remindDays: 0,
    ...k,
  });

  it('finds the next occurrence', () => {
    expect(nextKeyDate(kd({ repeat: 'monthly' }), '2026-11-01')).toBe('2026-11-30');
    expect(nextKeyDate(kd({ repeat: 'monthly' }), '2026-10-31')).toBe('2026-10-31');
    expect(nextKeyDate(kd({ repeat: 'yearly', date: '2016-02-29' }), '2027-01-01')).toBe('2027-02-28');
    expect(nextKeyDate(kd({ repeat: 'none', date: '2026-10-21' }), '2026-10-22')).toBe(null);
  });

  it('finds dates more than 400 days ahead', () => {
    expect(nextKeyDate(kd({ repeat: 'none', date: '2029-05-01' }), '2026-10-22')).toBe('2029-05-01');
    expect(nextKeyDate(kd({ repeat: 'yearly', date: '2028-06-01' }), '2026-10-22')).toBe('2028-06-01');
    expect(nextKeyDate(kd({ repeat: 'monthly', date: '2027-12-15' }), '2026-10-22')).toBe('2027-12-15');
  });

  it('returns null for a malformed date instead of throwing', () => {
    expect(nextKeyDate(kd({ date: undefined as unknown as string }), '2026-10-22')).toBe(null);
    expect(nextKeyDate(kd({ date: 'mañana', repeat: 'yearly' }), '2026-10-22')).toBe(null);
  });
});

describe('nextTaskDue', () => {
  const task = (t: Partial<Task>): Task => ({ id: 't', title: 'T', memberIds: [], done: false, createdAt: 0, ...t });

  it('moves a periodic task past today', () => {
    expect(nextTaskDue(task({ due: '2026-10-20', repeat: { every: 1, unit: 'week' } }), '2026-10-22')).toBe(
      '2026-10-27',
    );
    expect(nextTaskDue(task({ due: '2026-01-31', repeat: { every: 1, unit: 'month' } }), '2026-02-01')).toBe(
      '2026-02-28',
    );
    expect(nextTaskDue(task({ due: null }), '2026-10-22')).toBe(null);
  });

  it('survives a bad interval or due date', () => {
    expect(nextTaskDue(task({ due: '2026-10-20', repeat: { every: 0, unit: 'day' } }), '2026-10-22')).toBe(
      '2026-10-23',
    );
    expect(nextTaskDue(task({ due: 'x', repeat: { every: 2, unit: 'day' } }), '2026-10-22')).toBe('2026-10-24');
  });
});
