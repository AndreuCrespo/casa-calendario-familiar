// Tests of the notifier (pure logic) and of the shared date/recurrence
// modules. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Activity, CalEvent, Device, Household, KeyDate, Lang, MenuDay, Task } from '../../src/shared/types';
import { todayIn, zonedParts, zonedToUtc } from '../../src/shared/dates';
import { expandEvents, nextKeyDate, occurrenceStarts } from '../../src/shared/recurrence';
import {
  computeNotifications, deviceLang, pushPayload, reminderFireAt, selectDevices, type ComputeInput, type OutMessage,
} from './logic';
import { listEn, listEs, toLang } from './i18n';

const Z = (iso: string) => Date.parse(iso);
const TZ = 'Europe/Madrid';
const nb = (s: string) => s.replace(/ /g, ' '); // Spanish euro format uses a non-breaking space

// ---------- sample data ----------

const H: Household = {
  id: 'h1',
  name: 'Casa',
  timezone: TZ,
  createdAt: 0,
  memberUids: ['u1', 'u2'],
  members: [
    { id: 'm1', name: 'Alex', color: '#e11', kind: 'adult', uid: 'u1' },
    { id: 'm2', name: 'Sam', color: '#1e1', kind: 'adult', uid: 'u2' },
    { id: 'lia', name: 'Lía', color: '#11e', kind: 'child' },
    { id: 'noa', name: 'Noa', color: '#ee1', kind: 'child' },
    { id: 'iker', name: 'Iker', color: '#1ee', kind: 'child' },
  ],
};

const ev = (e: Partial<CalEvent> & Pick<CalEvent, 'id' | 'title' | 'date'>): CalEvent => ({ memberIds: [], ...e });

function run(over: Partial<ComputeInput> & Pick<ComputeInput, 'now'>, lang?: Lang) {
  return computeNotifications({
    household: H, events: [], tasks: [], menuToday: null, keyDates: [], activity: [],
    lastRunAt: null, sentKeys: [], ...over,
  }, lang);
}
const ofKind = (ms: OutMessage[], kind: OutMessage['kind']) => ms.filter((m) => m.kind === kind);

// =====================================================================
// dates.ts
// =====================================================================

test('zonedToUtc: spring DST change (Madrid, 2026-03-29)', () => {
  assert.equal(zonedToUtc('2026-03-29', '01:30', TZ), Z('2026-03-29T00:30:00Z')); // CET
  assert.equal(zonedToUtc('2026-03-29', '03:30', TZ), Z('2026-03-29T01:30:00Z')); // CEST
  // 02:30 doesn't exist: moved to 03:30 CEST
  assert.equal(zonedToUtc('2026-03-29', '02:30', TZ), Z('2026-03-29T01:30:00Z'));
  assert.equal(zonedToUtc('2026-03-28', '20:00', TZ), Z('2026-03-28T19:00:00Z'));
  assert.equal(zonedToUtc('2026-03-30', '09:00', TZ), Z('2026-03-30T07:00:00Z'));
});

test('zonedToUtc: autumn DST change (Madrid, 2026-10-25)', () => {
  assert.equal(zonedToUtc('2026-10-25', '01:30', TZ), Z('2026-10-24T23:30:00Z')); // CEST
  assert.equal(zonedToUtc('2026-10-25', '02:30', TZ), Z('2026-10-25T00:30:00Z')); // repeated → the first one (CEST)
  assert.equal(zonedToUtc('2026-10-25', '03:00', TZ), Z('2026-10-25T02:00:00Z'));
  assert.equal(zonedToUtc('2026-10-24', '09:00', TZ), Z('2026-10-24T07:00:00Z'));
  assert.equal(zonedToUtc('2026-10-26', '09:00', TZ), Z('2026-10-26T08:00:00Z'));
});

test('zonedToUtc ↔ zonedParts: round trip every 15 min around DST changes', () => {
  const zones = ['Europe/Madrid', 'Atlantic/Canary', 'America/New_York', 'Australia/Sydney', 'Asia/Kolkata'];
  const days = ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26',
    '2026-11-01', '2026-04-05', '2026-10-04', '2026-03-08'];
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let gaps = 0;
  for (const tz of zones) {
    for (const d of days) {
      for (let m = 0; m < 1440; m += 15) {
        const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const back = zonedParts(zonedToUtc(d, t, tz), tz);
        if (back.date === d && back.time === t) continue;
        // It can only fail in the spring-forward gap (non-existent time): then the
        // result is exactly one hour later, on the same day.
        gaps++;
        assert.ok(back.date === d && mins(back.time) - m === 60, `${tz} ${d} ${t} → ${back.date} ${back.time}`);
      }
    }
  }
  // Madrid, Canaries, New York and Sydney have a 1 h gap (4 slots of 15 min) on these days.
  assert.equal(gaps, 4 * 4);
});

test('zonedToUtc: same rules west of UTC (New York)', () => {
  const NY = 'America/New_York';
  assert.equal(zonedToUtc('2026-03-08', '02:30', NY), Z('2026-03-08T07:30:00Z')); // gap → 03:30 EDT
  assert.equal(zonedToUtc('2026-11-01', '01:30', NY), Z('2026-11-01T05:30:00Z')); // repeated → 01:30 EDT
  assert.equal(zonedToUtc('2026-11-01', '09:00', NY), Z('2026-11-01T14:00:00Z'));
});

test("todayIn uses the household's time zone", () => {
  assert.equal(todayIn(TZ, Z('2026-10-22T22:30:00Z')), '2026-10-23');
  assert.equal(todayIn(TZ, Z('2026-10-22T21:59:00Z')), '2026-10-22');
  assert.equal(todayIn(TZ, Z('2026-12-31T23:30:00Z')), '2027-01-01');
});

// =====================================================================
// recurrence.ts
// =====================================================================

test('daily recurrence every 2 days', () => {
  const rec = { freq: 'daily' as const, interval: 2 };
  assert.deepEqual(occurrenceStarts('2026-10-01', 0, rec, '2026-10-20', '2026-10-26'),
    ['2026-10-21', '2026-10-23', '2026-10-25']);
  assert.deepEqual(occurrenceStarts('2026-10-01', 0, rec, '2026-09-01', '2026-10-05'),
    ['2026-10-01', '2026-10-03', '2026-10-05']);
});

test('weekly recurrence on Monday and Wednesday every 2 weeks', () => {
  const rec = { freq: 'weekly' as const, interval: 2, byWeekday: [2, 0] };
  // 2026-10-07 is a Wednesday; Monday 2026-10-05 is before the start and doesn't count.
  assert.deepEqual(occurrenceStarts('2026-10-07', 0, rec, '2026-10-01', '2026-11-10'),
    ['2026-10-07', '2026-10-19', '2026-10-21', '2026-11-02', '2026-11-04']);
  assert.deepEqual(occurrenceStarts('2026-10-07', 0, rec, '2026-10-27', '2026-11-03'), ['2026-11-02']);
  assert.deepEqual(occurrenceStarts('2026-10-07', 0, rec, '2027-01-01', '2027-01-14'), ['2027-01-11', '2027-01-13']);
  assert.deepEqual(occurrenceStarts('2026-10-07', 0, rec, '2026-10-26', '2026-10-30'), []); // odd week
});

test('monthly recurrence on the 31st (clamped to the last day of the month)', () => {
  const rec = { freq: 'monthly' as const, interval: 1 };
  assert.deepEqual(occurrenceStarts('2026-01-31', 0, rec, '2026-01-01', '2026-06-30'),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']);
  assert.deepEqual(occurrenceStarts('2026-01-31', 0, rec, '2026-11-01', '2026-11-30'), ['2026-11-30']);
  assert.deepEqual(occurrenceStarts('2026-01-31', 0, rec, '2028-02-01', '2028-03-01'), ['2028-02-29']);
  // every 2 months: Jan, Mar, May, Jul, Sep, Nov
  assert.deepEqual(occurrenceStarts('2026-01-31', 0, { freq: 'monthly', interval: 2 }, '2026-08-01', '2027-01-31'),
    ['2026-09-30', '2026-11-30', '2027-01-31']);
});

test('yearly recurrence on 29 February', () => {
  const rec = { freq: 'yearly' as const, interval: 1 };
  assert.deepEqual(occurrenceStarts('2024-02-29', 0, rec, '2024-01-01', '2028-12-31'),
    ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  assert.deepEqual(occurrenceStarts('2024-02-29', 0, rec, '2026-10-22', '2027-10-22'), ['2027-02-28']);
});

test('multi-day events crossing the start of the range', () => {
  assert.deepEqual(occurrenceStarts('2026-10-18', 3, null, '2026-10-20', '2026-10-25'), ['2026-10-18']);
  assert.deepEqual(occurrenceStarts('2026-10-18', 3, null, '2026-10-21', '2026-10-25'), ['2026-10-18']);
  assert.deepEqual(occurrenceStarts('2026-10-18', 3, null, '2026-10-22', '2026-10-25'), []);
  // weekly, Friday to Sunday: the one from Friday 16 still covers Sunday 18
  const wk = { freq: 'weekly' as const, interval: 1 };
  assert.deepEqual(occurrenceStarts('2026-10-02', 2, wk, '2026-10-18', '2026-10-20'), ['2026-10-16']);
  // monthly, 3 days at the end of the month, spilling into the next month
  assert.deepEqual(occurrenceStarts('2026-01-30', 3, { freq: 'monthly', interval: 1 }, '2026-11-01', '2026-11-05'),
    ['2026-10-30']);
  const occ = expandEvents([ev({ id: 'v', title: 'Vacaciones', date: '2026-10-18', endDate: '2026-10-21' })],
    '2026-10-20', '2026-10-25');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].date, '2026-10-18');
  assert.equal(occ[0].endDate, '2026-10-21');
  assert.equal(occ[0].key, 'v_2026-10-18');
});

test('exdates and until', () => {
  assert.deepEqual(occurrenceStarts('2026-10-20', 0, { freq: 'daily', interval: 1 }, '2026-10-20', '2026-10-24',
    ['2026-10-22']), ['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24']);
  assert.deepEqual(occurrenceStarts('2026-10-01', 0, { freq: 'weekly', interval: 1, until: '2026-10-15' },
    '2026-10-01', '2026-11-30'), ['2026-10-01', '2026-10-08', '2026-10-15']);
  assert.deepEqual(occurrenceStarts('2026-10-01', 0, { freq: 'daily', interval: 1, until: '2026-10-10' },
    '2026-10-20', '2026-10-30'), []);
  assert.deepEqual(occurrenceStarts('2026-10-20', 0, null, '2026-10-20', '2026-10-20', ['2026-10-20']), []);
});

test('expandEvents sorts by date, then all-day, then time', () => {
  const occ = expandEvents([
    ev({ id: 'b', title: 'B', date: '2026-10-22', startTime: '10:00' }),
    ev({ id: 'a', title: 'A', date: '2026-10-22' }),
    ev({ id: 'c', title: 'C', date: '2026-10-21', startTime: '23:00' }),
  ], '2026-10-21', '2026-10-22');
  assert.deepEqual(occ.map((o) => o.event.id), ['c', 'a', 'b']);
});

test('nextKeyDate', () => {
  const kd = (k: Partial<KeyDate>): KeyDate => ({ id: 'k', title: 'K', kind: 'other', date: '2026-01-31', repeat: 'none', remindDays: 0, ...k });
  assert.equal(nextKeyDate(kd({ repeat: 'monthly' }), '2026-11-01'), '2026-11-30');
  assert.equal(nextKeyDate(kd({ repeat: 'monthly' }), '2026-10-31'), '2026-10-31');
  assert.equal(nextKeyDate(kd({ repeat: 'yearly', date: '2016-02-29' }), '2027-01-01'), '2027-02-28');
  assert.equal(nextKeyDate(kd({ repeat: 'none', date: '2026-10-21' }), '2026-10-22'), null);
  // Far future dates (more than 400 days): it used to return null.
  assert.equal(nextKeyDate(kd({ repeat: 'none', date: '2029-05-01' }), '2026-10-22'), '2029-05-01');
  assert.equal(nextKeyDate(kd({ repeat: 'yearly', date: '2028-06-01' }), '2026-10-22'), '2028-06-01');
  assert.equal(nextKeyDate(kd({ repeat: 'monthly', date: '2027-12-15' }), '2026-10-22'), '2027-12-15');
});

// =====================================================================
// 1. Event reminders
// =====================================================================

const dentista = ev({
  id: 'dent', title: 'Dentista', date: '2026-10-22', startTime: '17:00', endTime: '17:30',
  reminderMins: 60, memberIds: ['lia', 'noa'], location: 'Clínica Sonrisas',
});

test('timed event reminder', () => {
  const r = run({ events: [dentista], now: Z('2026-10-22T14:05:00Z'), lastRunAt: Z('2026-10-22T13:55:00Z') });
  assert.equal(r.messages.length, 1);
  assert.deepEqual(r.messages[0], {
    key: 'ev_dent_2026-10-22_60',
    kind: 'reminder',
    title: 'Dentista',
    body: 'Hoy a las 17:00 · Lía y Noa · Clínica Sonrisas',
    url: '/#/calendar',
    tag: 'ev_dent_2026-10-22',
    urgency: 'high',
    toUids: 'all',
  });
  // already sent
  assert.equal(run({ events: [dentista], now: Z('2026-10-22T14:05:00Z'), lastRunAt: Z('2026-10-22T13:55:00Z'),
    sentKeys: ['ev_dent_2026-10-22_60'] }).messages.length, 0);
  // a different reminder is a different key
  assert.equal(run({ events: [{ ...dentista, reminderMins: 30 }], now: Z('2026-10-22T14:35:00Z'),
    lastRunAt: Z('2026-10-22T14:25:00Z'), sentKeys: ['ev_dent_2026-10-22_60'] }).messages[0]?.key, 'ev_dent_2026-10-22_30');
  // no reminder
  assert.equal(run({ events: [{ ...dentista, reminderMins: null }], now: Z('2026-10-22T14:05:00Z'),
    lastRunAt: Z('2026-10-22T13:55:00Z') }).messages.length, 0);
});

test('reminder window: (start, now]', () => {
  const fire = Z('2026-10-22T14:00:00Z');
  const n = (now: number, lastRunAt: number | null) => run({ events: [dentista], now, lastRunAt }).messages.length;
  assert.equal(n(fire, fire - 10 * 60_000), 1); // fireAt == now → yes
  assert.equal(n(fire + 10 * 60_000, fire), 0); // fireAt == start → no (sent in the previous run)
  assert.equal(n(fire - 60_000, fire - 11 * 60_000), 0); // not yet
  // no previous run: 15 min back
  assert.equal(n(fire + 14 * 60_000, null), 1);
  assert.equal(n(fire + 16 * 60_000, null), 0);
  // very old previous run: 45 min back at most
  assert.equal(n(fire + 44 * 60_000, fire - 3 * 3600_000), 1);
  assert.equal(n(fire + 46 * 60_000, fire - 3 * 3600_000), 0);
});

test('weekly event reminder (and exdates)', () => {
  const nat = ev({ id: 'nat', title: 'Natación', date: '2026-09-03', startTime: '17:30', reminderMins: 30,
    memberIds: ['lia'], recurrence: { freq: 'weekly', interval: 1 } });
  const args = { now: Z('2026-10-22T15:05:00Z'), lastRunAt: Z('2026-10-22T14:55:00Z') };
  const r = run({ events: [nat], ...args });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].key, 'ev_nat_2026-10-22_30');
  assert.equal(r.messages[0].body, 'Hoy a las 17:30 · Lía');
  assert.equal(run({ events: [{ ...nat, exdates: ['2026-10-22'] }], ...args }).messages.length, 0);
  assert.equal(run({ events: [{ ...nat, recurrence: { freq: 'weekly', interval: 1, until: '2026-10-15' } }], ...args })
    .messages.length, 0);
});

test('weekly event across the autumn DST change', () => {
  const merc = ev({ id: 'merc', title: 'Mercadillo', date: '2026-10-04', startTime: '10:00', reminderMins: 0,
    recurrence: { freq: 'weekly', interval: 1 } });
  // 18-10 (CEST): 10:00 = 08:00Z
  assert.equal(run({ events: [merc], now: Z('2026-10-18T08:02:00Z'), lastRunAt: Z('2026-10-18T07:55:00Z') })
    .messages[0]?.key, 'ev_merc_2026-10-18_0');
  // 25-10 (CET): 10:00 = 09:00Z, not 08:00Z (the daily summary does go out at that time)
  assert.equal(ofKind(run({ events: [merc], now: Z('2026-10-25T08:58:00Z'), lastRunAt: Z('2026-10-25T08:50:00Z') })
    .messages, 'reminder').length, 0);
  const r = ofKind(run({ events: [merc], now: Z('2026-10-25T09:05:00Z'), lastRunAt: Z('2026-10-25T08:58:00Z') })
    .messages, 'reminder');
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'ev_merc_2026-10-25_0');
  assert.equal(r[0].body, 'Hoy a las 10:00');
});

test('reminder for "tomorrow" and several days ahead', () => {
  const rev = ev({ id: 'rev', title: 'Revisión', date: '2026-10-23', startTime: '10:00', reminderMins: 1440 });
  const r = run({ events: [rev], now: Z('2026-10-22T08:05:00Z'), lastRunAt: Z('2026-10-22T07:55:00Z') });
  assert.equal(ofKind(r.messages, 'reminder')[0]?.body, 'Mañana a las 10:00');
  const viaje = ev({ id: 'via', title: 'Viaje', date: '2026-10-29', startTime: '08:00', reminderMins: 7 * 1440 });
  const r2 = run({ events: [viaje], now: Z('2026-10-22T06:05:00Z'), lastRunAt: Z('2026-10-22T05:55:00Z') });
  assert.equal(ofKind(r2.messages, 'reminder')[0]?.body, 'El jueves 29 de octubre a las 8:00');
  const sab = ev({ id: 'sab', title: 'Cumple de Ana', date: '2026-10-24', startTime: '13:00', reminderMins: 2 * 1440 });
  const r3 = run({ events: [sab], now: Z('2026-10-22T11:05:00Z'), lastRunAt: Z('2026-10-22T10:55:00Z') });
  assert.equal(ofKind(r3.messages, 'reminder')[0]?.body, 'El sábado 24 a las 13:00');
});

test('all-day event reminder', () => {
  const exc = ev({ id: 'exc', title: 'Excursión', date: '2026-10-23', reminderMins: 780, memberIds: ['lia', 'iker'] });
  // 780 → 20:00 the day before (CEST: 18:00Z)
  assert.equal(reminderFireAt(exc, '2026-10-23', TZ), Z('2026-10-22T18:00:00Z'));
  const r = run({ events: [exc], now: Z('2026-10-22T18:05:00Z'), lastRunAt: Z('2026-10-22T17:55:00Z') });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].title, 'Excursión');
  assert.equal(r.messages[0].body, 'Mañana, todo el día · Lía e Iker');
  assert.equal(r.messages[0].key, 'ev_exc_2026-10-23_780');
  // 0 → 09:00 the same day
  const sinCole = ev({ id: 'sc', title: 'Día sin cole', date: '2026-10-22', reminderMins: 0 });
  assert.equal(reminderFireAt(sinCole, '2026-10-22', TZ), Z('2026-10-22T07:00:00Z'));
  const r2 = run({ events: [sinCole], now: Z('2026-10-22T07:05:00Z'), lastRunAt: Z('2026-10-22T06:55:00Z') });
  assert.equal(ofKind(r2.messages, 'reminder')[0]?.body, 'Hoy, todo el día');
  // multi-day
  const vac = ev({ id: 'vac', title: 'Vacaciones', date: '2026-10-24', endDate: '2026-10-27', reminderMins: 780 });
  const r3 = run({ events: [vac], now: Z('2026-10-23T18:05:00Z'), lastRunAt: Z('2026-10-23T17:55:00Z') });
  assert.equal(r3.messages[0]?.body, 'Mañana, todo el día (hasta el martes 27)');
});

test('reminders across DST changes (Europe/Madrid)', () => {
  // All day, 780: always 20:00 wall-clock time the day before.
  assert.equal(reminderFireAt({ reminderMins: 780 }, '2026-10-26', TZ), Z('2026-10-25T19:00:00Z')); // 20:00 CET
  assert.equal(reminderFireAt({ reminderMins: 780 }, '2026-10-25', TZ), Z('2026-10-24T18:00:00Z')); // 20:00 CEST
  assert.equal(reminderFireAt({ reminderMins: 780 }, '2026-03-29', TZ), Z('2026-03-28T19:00:00Z')); // 20:00 CET
  assert.equal(reminderFireAt({ reminderMins: 780 }, '2026-03-30', TZ), Z('2026-03-29T18:00:00Z')); // 20:00 CEST
  assert.equal(reminderFireAt({ reminderMins: 1440 }, '2026-03-30', TZ), Z('2026-03-29T07:00:00Z')); // 09:00 CEST
  // Timed: loose minutes are real minutes (03:30 CEST − 60 min = 01:30 CET)…
  assert.equal(reminderFireAt({ startTime: '03:30', reminderMins: 60 }, '2026-03-29', TZ), Z('2026-03-29T00:30:00Z'));
  assert.equal(reminderFireAt({ startTime: '10:00', reminderMins: 120 }, '2026-03-29', TZ), Z('2026-03-29T06:00:00Z'));
  // …and whole days are wall-clock time: "1 day before" 10:00 is at 10:00.
  assert.equal(reminderFireAt({ startTime: '10:00', reminderMins: 1440 }, '2026-03-30', TZ), Z('2026-03-29T08:00:00Z'));
  assert.equal(reminderFireAt({ startTime: '10:00', reminderMins: 1440 }, '2026-10-26', TZ), Z('2026-10-25T09:00:00Z'));
  assert.equal(reminderFireAt({ startTime: '08:00', reminderMins: 7 * 1440 }, '2026-10-29', TZ), Z('2026-10-22T06:00:00Z'));
  assert.equal(reminderFireAt({ startTime: '10:00', reminderMins: 1440 + 30 }, '2026-10-26', TZ), Z('2026-10-25T08:30:00Z'));
  // Repeated hour in the early morning of 25-10: fires at 02:00 CEST (00:00Z) and
  // not again when it's 02:00 once more (CET, 01:00Z).
  const e = ev({ id: 'noct', title: 'Toma de medicina', date: '2026-10-25', startTime: '02:00', reminderMins: 0 });
  const r = run({ events: [e], now: Z('2026-10-25T00:05:00Z'), lastRunAt: Z('2026-10-24T23:55:00Z') });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].body, 'Hoy a las 2:00');
  assert.equal(run({ events: [e], now: Z('2026-10-25T01:05:00Z'), lastRunAt: Z('2026-10-25T00:55:00Z') }).messages.length, 0);
  // The all-day one on 29-03 fires on Saturday at 20:00 CET.
  const t = ev({ id: 'pri', title: 'Ruta', date: '2026-03-29', reminderMins: 780 });
  assert.equal(run({ events: [t], now: Z('2026-03-28T19:00:00Z'), lastRunAt: Z('2026-03-28T18:50:00Z') })
    .messages[0]?.body, 'Mañana, todo el día');
  assert.equal(run({ events: [t], now: Z('2026-03-28T18:55:00Z'), lastRunAt: Z('2026-03-28T18:45:00Z') })
    .messages.length, 0);
});

// =====================================================================
// 3. Daily summary
// =====================================================================

const dayEvents: CalEvent[] = [
  ev({ id: 'nat', title: 'Natación', date: '2026-09-03', startTime: '17:30', reminderMins: 30,
    recurrence: { freq: 'weekly', interval: 1 } }),
  ev({ id: 'sc', title: 'Día sin cole', date: '2026-10-22', reminderMins: 0 }),
  ev({ id: 'ab', title: 'Abuelos en casa', date: '2026-10-20', endDate: '2026-10-24' }),
  ev({ id: 'cena', title: 'Cena con amigos', date: '2026-10-22', startTime: '21:00' }),
  ev({ id: 'med', title: 'Médico', date: '2026-10-22', startTime: '09:15' }),
  ev({ id: 'man', title: 'Mañana no', date: '2026-10-23', startTime: '09:00' }),
];
const menu: MenuDay = { id: '2026-10-22', lunch: 'Lentejas', dinner: 'Tortilla de patatas' };
const task = (t: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({ memberIds: [], done: false, createdAt: 0, ...t });
const tasks: Task[] = [
  task({ id: 't1', title: 'Sacar la basura', due: '2026-10-22' }),
  task({ id: 't2', title: 'Pagar comedor', due: '2026-10-20' }),
  task({ id: 't3', title: 'Regar plantas', due: '2026-10-23' }),
  task({ id: 't4', title: 'Hecha', due: '2026-10-21', done: true }),
  task({ id: 't5', title: 'Sin fecha', due: null }),
];
const noaBirthday: KeyDate = { id: 'bnoa', title: 'Noa', kind: 'birthday', date: '2022-10-22', repeat: 'yearly', remindDays: 0 };
const dailyIn = { events: dayEvents, tasks, menuToday: menu, keyDates: [noaBirthday] };

test('daily summary', () => {
  const r = run({ ...dailyIn, now: Z('2026-10-22T06:05:00Z'), lastRunAt: Z('2026-10-22T05:55:00Z') });
  const d = ofKind(r.messages, 'daily');
  assert.equal(d.length, 1);
  assert.equal(d[0].key, 'daily_2026-10-22');
  assert.equal(d[0].title, 'Buenos días · jueves 22');
  assert.equal(d[0].url, '/#/');
  assert.deepEqual(d[0].toUids, 'all');
  assert.equal(d[0].body, [
    'Todo el día · Abuelos en casa',
    'Todo el día · Día sin cole',
    '9:15 · Médico',
    '17:30 · Natación',
    '21:00 · Cena con amigos',
    '🍽️ Comida: Lentejas · Cena: Tortilla de patatas',
    '✅ 2 tareas (1 atrasada): Pagar comedor y Sacar la basura',
    '🎂 Cumpleaños de Noa (4 años)',
  ].join('\n'));
  // No key date notifications before 9 (the birthday is in the summary).
  assert.equal(ofKind(r.messages, 'keydate').length, 0);
});

test('daily summary: time window, dedupe and settings', () => {
  const n = (now: string, over: Partial<ComputeInput> = {}) =>
    ofKind(run({ ...dailyIn, now: Z(now), lastRunAt: Z(now) - 600_000, ...over }).messages, 'daily').length;
  assert.equal(n('2026-10-22T05:59:00Z'), 0); // 07:59
  assert.equal(n('2026-10-22T06:00:00Z'), 1); // 08:00
  assert.equal(n('2026-10-22T08:59:00Z'), 1); // 10:59
  assert.equal(n('2026-10-22T09:00:00Z'), 0); // 11:00
  assert.equal(n('2026-10-22T06:30:00Z', { sentKeys: ['daily_2026-10-22'] }), 0);
  assert.equal(n('2026-10-22T06:30:00Z', { household: { ...H, notify: { dailySummary: false, dailyHour: 8, activity: true } } }), 0);
  // Custom hour
  const late = { ...H, notify: { dailySummary: true, dailyHour: 20, activity: true } };
  assert.equal(n('2026-10-22T06:30:00Z', { household: late }), 0);
  const r = run({ ...dailyIn, household: late, now: Z('2026-10-22T18:30:00Z') });
  assert.equal(ofKind(r.messages, 'daily')[0]?.title, 'Buenas noches · jueves 22');
  // Empty day → nothing is sent
  assert.equal(n('2026-10-22T06:30:00Z', { events: [], tasks: [], menuToday: null, keyDates: [] }), 0);
  // Menu only
  const onlyMenu = run({ now: Z('2026-10-22T06:30:00Z'), menuToday: { id: '2026-10-22', dinner: 'Pizza' } });
  assert.equal(ofKind(onlyMenu.messages, 'daily')[0]?.body, '🍽️ Cena: Pizza');
  // A single overdue task
  const one = run({ now: Z('2026-10-22T06:30:00Z'), tasks: [task({ id: 'x', title: 'Llamar al fontanero', due: '2026-10-19' })] });
  assert.equal(ofKind(one.messages, 'daily')[0]?.body, '✅ Tarea: Llamar al fontanero (atrasada)');
});

test('daily summary on a DST change day', () => {
  // 2026-10-25: 08:05 CET is 07:05Z
  const r = run({ now: Z('2026-10-25T07:05:00Z'), events: [ev({ id: 'x', title: 'Misa', date: '2026-10-25', startTime: '12:00' })] });
  assert.equal(ofKind(r.messages, 'daily')[0]?.title, 'Buenos días · domingo 25');
  assert.equal(ofKind(run({ now: Z('2026-10-25T06:59:00Z'), events: [ev({ id: 'x', title: 'Misa', date: '2026-10-25', startTime: '12:00' })] })
    .messages, 'daily').length, 0);
});

// =====================================================================
// 4. Key dates
// =====================================================================

const itv: KeyDate = { id: 'itv', title: 'ITV coche', kind: 'car', date: '2026-10-29', repeat: 'none', remindDays: 7, amount: 4590 };
const bday: KeyDate = { id: 'blia', title: 'Lía', kind: 'birthday', date: '2020-10-29', repeat: 'yearly', remindDays: 7 };
const rent: KeyDate = { id: 'alq', title: 'Alquiler', kind: 'bill', date: '2026-01-31', repeat: 'monthly', remindDays: 2, amount: 85000 };
const leap: KeyDate = { id: 'leo', title: 'Leo', kind: 'birthday', date: '2016-02-29', repeat: 'yearly', remindDays: 0 };

const kdRun = (keyDates: KeyDate[], now: string, sentKeys: string[] = []) =>
  ofKind(run({ keyDates, now: Z(now), sentKeys }).messages, 'keydate');

test('key date: car inspection (ITV) with amount', () => {
  assert.equal(kdRun([itv], '2026-10-22T06:50:00Z').length, 0); // 08:50: not yet
  const [m] = kdRun([itv], '2026-10-22T07:10:00Z'); // 09:10
  assert.equal(m.key, 'kd_itv_2026-10-29_7');
  assert.equal(m.title, '🚗 ITV coche');
  assert.equal(nb(m.body), 'Vence en 7 días (jue 29 oct) · 45,90 €');
  assert.equal(m.url, '/#/dates');
  assert.equal(kdRun([itv], '2026-10-22T07:10:00Z', ['kd_itv_2026-10-29_7']).length, 0);
  assert.equal(kdRun([itv], '2026-10-23T07:10:00Z').length, 0); // 6 days left
  const [today] = kdRun([itv], '2026-10-29T08:30:00Z'); // 09:30 CET
  assert.equal(today.key, 'kd_itv_2026-10-29_0');
  assert.equal(nb(today.body), 'Vence hoy · 45,90 €');
  assert.equal(kdRun([itv], '2026-10-30T08:30:00Z').length, 0); // already passed
  assert.equal(nb(kdRun([{ ...itv, remindDays: 1 }], '2026-10-28T08:30:00Z')[0].body), 'Vence mañana · 45,90 €');
});

test('key date: birthday', () => {
  const [m] = kdRun([bday], '2026-10-22T07:10:00Z');
  assert.equal(m.title, '🎂 Cumpleaños de Lía');
  assert.equal(m.body, 'Cumple 6 años en 7 días (jue 29 oct)');
  const [d] = kdRun([bday], '2026-10-29T08:00:00Z');
  assert.equal(d.key, 'kd_blia_2026-10-29_0');
  assert.equal(d.body, '¡Hoy cumple 6 años!');
  assert.equal(kdRun([{ ...bday, remindDays: 1 }], '2026-10-28T08:00:00Z')[0].body, 'Mañana cumple 6 años');
  assert.equal(kdRun([{ ...bday, date: '2025-10-29' }], '2026-10-29T08:00:00Z')[0].body, '¡Hoy cumple 1 año!');
  // title that already says "Cumple…", wrongly stored repeat and no credible year
  const abu: KeyDate = { id: 'abu', title: 'Cumple de la abuela', kind: 'birthday', date: '0001-11-02', repeat: 'none', remindDays: 0 };
  const [a] = kdRun([abu], '2026-11-02T09:00:00Z');
  assert.equal(a.title, '🎂 Cumple de la abuela');
  assert.equal(a.body, '¡Hoy es su cumpleaños!');
});

test('key date: 29 February', () => {
  const [m] = kdRun([leap], '2027-02-28T09:00:00Z');
  assert.equal(m.key, 'kd_leo_2027-02-28_0');
  assert.equal(m.body, '¡Hoy cumple 11 años!');
  assert.equal(kdRun([leap], '2028-02-28T09:00:00Z').length, 0);
  assert.equal(kdRun([leap], '2028-02-29T09:00:00Z')[0].body, '¡Hoy cumple 12 años!');
});

test('key date: monthly bill on the 31st', () => {
  const [oct] = kdRun([rent], '2026-10-29T08:30:00Z');
  assert.equal(oct.key, 'kd_alq_2026-10-31_2');
  assert.equal(oct.title, '🧾 Alquiler');
  assert.equal(nb(oct.body), 'Vence en 2 días (sáb 31 oct) · 850,00 €');
  const [nov] = kdRun([rent], '2026-11-28T08:30:00Z');
  assert.equal(nov.key, 'kd_alq_2026-11-30_2');
  assert.equal(nb(nov.body), 'Vence en 2 días (lun 30 nov) · 850,00 €');
  assert.equal(kdRun([rent], '2026-11-29T08:30:00Z').length, 0);
  const [day] = kdRun([rent], '2026-11-30T08:30:00Z');
  assert.equal(day.key, 'kd_alq_2026-11-30_0');
  assert.equal(nb(day.body), 'Vence hoy · 850,00 €');
  const [feb] = kdRun([rent], '2027-02-26T08:30:00Z');
  assert.equal(feb.key, 'kd_alq_2027-02-28_2');
  assert.equal(nb(feb.body), 'Vence en 2 días (dom 28 feb) · 850,00 €');
  // In the daily summary
  const r = run({ keyDates: [rent], now: Z('2026-11-30T07:30:00Z') });
  assert.equal(nb(ofKind(r.messages, 'daily')[0].body), '🧾 Alquiler · vence hoy · 850,00 €');
});

test('key date: other kinds, remindDays 0 and year change', () => {
  const vac: KeyDate = { id: 'vac', title: 'Vacuna gripe', kind: 'health', date: '2026-10-24', repeat: 'none', remindDays: 2 };
  assert.equal(kdRun([vac], '2026-10-22T07:10:00Z')[0].body, 'En 2 días (sáb 24 oct)');
  assert.equal(kdRun([vac], '2026-10-22T07:10:00Z')[0].title, '🩺 Vacuna gripe');
  const zero: KeyDate = { ...vac, remindDays: 0 };
  assert.equal(kdRun([zero], '2026-10-24T07:10:00Z').length, 1);
  const ny: KeyDate = { id: 'seg', title: 'Seguro hogar', kind: 'insurance', date: '2021-01-03', repeat: 'yearly', remindDays: 7 };
  assert.equal(kdRun([ny], '2026-12-27T09:00:00Z')[0].body, 'Vence en 7 días (dom 3 ene 2027)');
});

// =====================================================================
// 2. Activity
// =====================================================================

const NOW = Z('2026-10-22T10:00:00Z');
const act = (id: string, actorUid: string, actorName: string, kind: Activity['kind'], text: string, minsAgo: number, notified = false): Activity =>
  ({ id, actorUid, actorName, kind, text, createdAt: NOW - minsAgo * 60_000, notified });
const activity: Activity[] = [
  act('a1', 'u1', 'Alex', 'shopping', 'leche', 20),
  act('a2', 'u1', 'Alex', 'shopping', 'pan', 19),
  act('a3', 'u1', 'Alex', 'shopping', 'huevos', 18),
  act('a4', 'u2', 'Sam', 'event', 'Dentista', 15),
  act('a5', 'u2', 'Sam', 'task', 'Comprar regalo', 10),
  act('a6', 'u2', 'Sam', 'menu', '', 5),
  act('a7', 'u1', 'Alex', 'shopping', 'Leche', 17),
  act('a8', 'u1', 'Alex', 'shopping', 'viejo', 30, true),
  act('a9', 'u1', 'Alex', 'shopping', 'yogures', 13 * 60),
];

test('activity digest per person', () => {
  const r = run({ activity, now: NOW, lastRunAt: NOW - 600_000 });
  const ms = ofKind(r.messages, 'activity');
  assert.equal(ms.length, 2);
  const alex = ms.find((m) => m.title === 'Alex')!;
  assert.equal(alex.body, 'Ha añadido a la compra: leche, pan y huevos');
  assert.equal(alex.url, '/#/shopping');
  assert.deepEqual(alex.toUids, { excludeUid: 'u1' });
  assert.equal(alex.key, undefined);
  const sam = ms.find((m) => m.title === 'Sam')!;
  assert.equal(sam.body, 'Nuevo evento: Dentista\nNueva tarea: Comprar regalo\nMenú actualizado');
  assert.equal(sam.url, '/#/calendar');
  assert.deepEqual(sam.toUids, { excludeUid: 'u2' });
  assert.deepEqual([...r.activityIdsToMark].sort(), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a9']);
});

test('activity: dominant kind, many items and settings', () => {
  const r = run({ now: NOW, activity: [
    act('b1', 'u2', 'Sam', 'event', 'Cine', 3),
    act('b2', 'u2', 'Sam', 'task', 'Poner lavadora', 2),
    act('b3', 'u2', 'Sam', 'task', 'Ir al banco', 1),
    act('b4', 'u2', 'Sam', 'expense', 'Supermercado', 1),
    act('b5', 'u2', 'Sam', 'date', 'ITV coche', 1),
    act('b6', 'u2', 'Sam', 'note', 'Claves wifi', 1),
  ] });
  const [m] = ofKind(r.messages, 'activity');
  assert.equal(m.url, '/#/tasks');
  assert.equal(m.body, 'Nuevas tareas: Poner lavadora e Ir al banco\nNuevo evento: Cine\nNueva fecha: ITV coche\nNuevo gasto: Supermercado\nNueva nota: Claves wifi');
  const many = Array.from({ length: 10 }, (_, i) => act(`c${i}`, 'u1', 'Alex', 'shopping', `cosa ${i + 1}`, 10 - i));
  assert.equal(ofKind(run({ now: NOW, activity: many }).messages, 'activity')[0].body,
    'Ha añadido a la compra: cosa 1, cosa 2, cosa 3, cosa 4, cosa 5, cosa 6, cosa 7, cosa 8 y 2 más');
  const off = run({ now: NOW, activity, household: { ...H, notify: { dailySummary: true, dailyHour: 8, activity: false } } });
  assert.equal(ofKind(off.messages, 'activity').length, 0);
  assert.equal(off.activityIdsToMark.length, 8); // marked anyway
});

// =====================================================================
// Utilities
// =====================================================================

test('listEs and the conjunction "e"', () => {
  assert.equal(listEs([]), '');
  assert.equal(listEs(['pan']), 'pan');
  assert.equal(listEs(['leche', 'pan', 'huevos']), 'leche, pan y huevos');
  assert.equal(listEs(['pan', 'higos']), 'pan e higos');
  assert.equal(listEs(['agua', 'hielo']), 'agua y hielo');
  assert.equal(listEs(['Lía', 'Iker']), 'Lía e Iker');
  assert.equal(listEs(['a', 'b', 'c', 'd'], 2), 'a, b y 2 más');
});

test('device selection and push payload', () => {
  const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } });
  const devs: Device[] = [
    { id: 'd1', uid: 'u1', subscription: sub('https://push/1'), ua: '', createdAt: 0 },
    { id: 'd2', uid: 'u2', subscription: sub('https://push/2'), ua: '', createdAt: 0 },
    { id: 'd3', uid: 'u2', subscription: sub('https://push/2'), ua: '', createdAt: 0 },
    { id: 'd4', uid: 'u2', subscription: { endpoint: 'https://push/4', keys: { p256dh: '', auth: '' } }, ua: '', createdAt: 0 },
  ];
  assert.deepEqual(selectDevices(devs, 'all').map((d) => d.id), ['d1', 'd2']);
  assert.deepEqual(selectDevices(devs, { excludeUid: 'u1' }).map((d) => d.id), ['d2']);
  assert.deepEqual(selectDevices(devs, { excludeUid: 'u2' }).map((d) => d.id), ['d1']);
  assert.deepEqual(JSON.parse(pushPayload({ title: 'T', body: 'B', url: '/#/', tag: 'x' })),
    { title: 'T', body: 'B', url: '/#/', tag: 'x' });
});

test('all together: several things in one run', () => {
  const r = run({
    events: [...dayEvents, dentista], tasks, menuToday: menu, keyDates: [noaBirthday, itv, bday], activity,
    now: Z('2026-10-22T07:05:00Z'), lastRunAt: Z('2026-10-22T06:55:00Z'),
  });
  // 09:05: reminder for "Día sin cole" (09:00), key dates (Noa today; ITV and Lía's birthday in
  // 7 days), daily summary and activity.
  assert.deepEqual(r.messages.map((m) => m.key ?? m.kind), [
    'ev_sc_2026-10-22_0', 'kd_bnoa_2026-10-22_0', 'kd_itv_2026-10-29_7', 'kd_blia_2026-10-29_7',
    'daily_2026-10-22', 'activity', 'activity',
  ]);
});

// =====================================================================
// English ('en' devices)
// =====================================================================

test('en: event reminders', () => {
  const r = run({ events: [dentista], now: Z('2026-10-22T14:05:00Z'), lastRunAt: Z('2026-10-22T13:55:00Z') }, 'en');
  assert.deepEqual(r.messages, [{
    key: 'ev_dent_2026-10-22_60',
    kind: 'reminder',
    title: 'Dentista',
    body: 'Today at 17:00 · Lía and Noa · Clínica Sonrisas',
    url: '/#/calendar',
    tag: 'ev_dent_2026-10-22',
    urgency: 'high',
    toUids: 'all',
  }]);
  const body = (e: CalEvent, now: string, last: string) =>
    ofKind(run({ events: [e], now: Z(now), lastRunAt: Z(last) }, 'en').messages, 'reminder')[0]?.body;
  assert.equal(body(ev({ id: 'rev', title: 'R', date: '2026-10-23', startTime: '10:00', reminderMins: 1440 }),
    '2026-10-22T08:05:00Z', '2026-10-22T07:55:00Z'), 'Tomorrow at 10:00');
  assert.equal(body(ev({ id: 'via', title: 'Trip', date: '2026-10-29', startTime: '08:00', reminderMins: 7 * 1440 }),
    '2026-10-22T06:05:00Z', '2026-10-22T05:55:00Z'), 'On Thursday 29 October at 8:00');
  assert.equal(body(ev({ id: 'sab', title: 'Party', date: '2026-10-24', startTime: '13:00', reminderMins: 2 * 1440 }),
    '2026-10-22T11:05:00Z', '2026-10-22T10:55:00Z'), 'On Saturday 24 at 13:00');
  assert.equal(body(ev({ id: 'exc', title: 'Trip', date: '2026-10-23', reminderMins: 780, memberIds: ['lia', 'iker'] }),
    '2026-10-22T18:05:00Z', '2026-10-22T17:55:00Z'), 'Tomorrow, all day · Lía and Iker');
  assert.equal(body(ev({ id: 'vac', title: 'Holidays', date: '2026-10-24', endDate: '2026-10-27', reminderMins: 780 }),
    '2026-10-23T18:05:00Z', '2026-10-23T17:55:00Z'), 'Tomorrow, all day (until Tuesday 27)');
  const untitled = run({ events: [{ ...dentista, title: '  ' }], now: Z('2026-10-22T14:05:00Z'),
    lastRunAt: Z('2026-10-22T13:55:00Z') }, 'en');
  assert.equal(untitled.messages[0].title, 'Event');
});

test('en: daily summary', () => {
  const r = run({ ...dailyIn, now: Z('2026-10-22T06:05:00Z'), lastRunAt: Z('2026-10-22T05:55:00Z') }, 'en');
  const [d] = ofKind(r.messages, 'daily');
  assert.equal(d.key, 'daily_2026-10-22');
  assert.equal(d.title, 'Good morning · Thursday 22');
  assert.equal(d.url, '/#/');
  assert.equal(d.body, [
    'All day · Abuelos en casa',
    'All day · Día sin cole',
    '9:15 · Médico',
    '17:30 · Natación',
    '21:00 · Cena con amigos',
    '🍽️ Lunch: Lentejas · Dinner: Tortilla de patatas',
    '✅ 2 tasks (1 overdue): Pagar comedor and Sacar la basura',
    "🎂 Noa's birthday (turns 4)",
  ].join('\n'));
  const late = { ...H, notify: { dailySummary: true, dailyHour: 20, activity: true } };
  assert.equal(ofKind(run({ ...dailyIn, household: late, now: Z('2026-10-22T18:30:00Z') }, 'en').messages, 'daily')[0]?.title,
    'Good evening · Thursday 22');
  const one = run({ now: Z('2026-10-22T06:30:00Z'), tasks: [task({ id: 'x', title: 'Call the plumber', due: '2026-10-19' })] }, 'en');
  assert.equal(ofKind(one.messages, 'daily')[0]?.body, '✅ Task: Call the plumber (overdue)');
  const rentDay = run({ keyDates: [rent], now: Z('2026-11-30T07:30:00Z') }, 'en');
  assert.equal(ofKind(rentDay.messages, 'daily')[0].body, '🧾 Alquiler · due today · €850.00');
  // More than 6 events today
  const lots = Array.from({ length: 8 }, (_, i) => ev({ id: `l${i}`, title: `E${i}`, date: '2026-10-22', startTime: `1${i}:00` }));
  const body = ofKind(run({ events: lots, now: Z('2026-10-22T06:30:00Z') }, 'en').messages, 'daily')[0].body.split('\n');
  assert.equal(body.length, 7);
  assert.equal(body[6], 'and 2 more events');
  assert.equal(ofKind(run({ events: lots, now: Z('2026-10-22T06:30:00Z') }).messages, 'daily')[0].body.split('\n')[6],
    'y 2 eventos más');
});

test('en: key dates (birthday with age, amounts, other kinds)', () => {
  const kd = (keyDates: KeyDate[], now: string) => ofKind(run({ keyDates, now: Z(now) }, 'en').messages, 'keydate');
  const [b] = kd([bday], '2026-10-22T07:10:00Z');
  assert.equal(b.key, 'kd_blia_2026-10-29_7');
  assert.equal(b.title, "🎂 Lía's birthday");
  assert.equal(b.body, 'Turns 6 in 7 days (Thu 29 Oct)');
  assert.equal(b.url, '/#/dates');
  assert.equal(kd([bday], '2026-10-29T08:00:00Z')[0].body, 'Turns 6 today!');
  assert.equal(kd([{ ...bday, remindDays: 1 }], '2026-10-28T08:00:00Z')[0].body, 'Turns 6 tomorrow');
  const abu: KeyDate = { id: 'abu', title: 'Cumple de la abuela', kind: 'birthday', date: '0001-11-02', repeat: 'none', remindDays: 0 };
  const [a] = kd([abu], '2026-11-02T09:00:00Z');
  assert.equal(a.title, '🎂 Cumple de la abuela');
  assert.equal(a.body, "It's their birthday today!");
  assert.equal(kd([{ ...abu, title: "Grandma's birthday" }], '2026-11-02T09:00:00Z')[0].title, "🎂 Grandma's birthday");
  assert.equal(kd([{ ...abu, title: '' }], '2026-11-02T09:00:00Z')[0].title, '🎂 Birthday');
  assert.equal(kdRun([{ ...abu, title: '' }], '2026-11-02T09:00:00Z')[0].title, '🎂 Cumpleaños');

  const [i] = kd([itv], '2026-10-22T07:10:00Z');
  assert.equal(i.key, 'kd_itv_2026-10-29_7');
  assert.equal(i.title, '🚗 ITV coche');
  assert.equal(i.body, 'Due in 7 days (Thu 29 Oct) · €45.90');
  assert.equal(kd([itv], '2026-10-29T08:30:00Z')[0].body, 'Due today · €45.90');
  assert.equal(kd([{ ...itv, remindDays: 1 }], '2026-10-28T08:30:00Z')[0].body, 'Due tomorrow · €45.90');
  assert.equal(kd([rent], '2026-10-29T08:30:00Z')[0].body, 'Due in 2 days (Sat 31 Oct) · €850.00');

  const vac: KeyDate = { id: 'vac', title: 'Flu jab', kind: 'health', date: '2026-10-24', repeat: 'none', remindDays: 2 };
  assert.equal(kd([vac], '2026-10-22T07:10:00Z')[0].body, 'In 2 days (Sat 24 Oct)');
  const ny: KeyDate = { id: 'seg', title: 'Home insurance', kind: 'insurance', date: '2021-01-03', repeat: 'yearly', remindDays: 7 };
  assert.equal(kd([ny], '2026-12-27T09:00:00Z')[0].body, 'Due in 7 days (Sun 3 Jan 2027)');
});

test('en: activity digest', () => {
  const r = run({ activity, now: NOW, lastRunAt: NOW - 600_000 }, 'en');
  const ms = ofKind(r.messages, 'activity');
  const alex = ms.find((m) => m.title === 'Alex')!;
  assert.equal(alex.body, 'Added to the shopping list: leche, pan and huevos');
  assert.equal(alex.url, '/#/shopping');
  assert.deepEqual(alex.toUids, { excludeUid: 'u1' });
  const sam = ms.find((m) => m.title === 'Sam')!;
  assert.equal(sam.body, 'New event: Dentista\nNew task: Comprar regalo\nUpdated the menu');
  assert.equal(sam.url, '/#/calendar');
  const mixed = run({ now: NOW, activity: [
    act('b1', 'u2', 'Sam', 'event', 'Cinema', 3),
    act('b2', 'u2', 'Sam', 'task', 'Laundry', 2),
    act('b3', 'u2', 'Sam', 'task', 'Go to the bank', 1),
    act('b4', 'u2', 'Sam', 'expense', 'Groceries', 1),
    act('b5', 'u2', 'Sam', 'date', 'MOT', 1),
    act('b6', 'u2', 'Sam', 'note', 'Wifi password', 1),
    act('b7', 'u2', 'Sam', 'shopping', '', 1),
  ] }, 'en');
  assert.equal(ofKind(mixed.messages, 'activity')[0].body,
    'New tasks: Laundry and Go to the bank\nUpdated the shopping list\nNew event: Cinema\nNew key date: MOT\n' +
    'New expense: Groceries\nNew note: Wifi password');
  const many = Array.from({ length: 10 }, (_, k) => act(`c${k}`, 'u1', 'Alex', 'shopping', `thing ${k + 1}`, 10 - k));
  assert.equal(ofKind(run({ now: NOW, activity: many }, 'en').messages, 'activity')[0].body,
    'Added to the shopping list: thing 1, thing 2, thing 3, thing 4, thing 5, thing 6, thing 7, thing 8 and 2 more');
  const anon = run({ now: NOW, activity: [act('z', '', ' ', 'note', 'Wifi', 1)] }, 'en');
  assert.equal(ofKind(anon.messages, 'activity')[0].title, 'Someone at home');
});

test('every language yields the same messages (keys, tags, URLs, audiences)', () => {
  const input = {
    events: [...dayEvents, dentista], tasks, menuToday: menu, keyDates: [noaBirthday, itv, bday], activity,
    now: Z('2026-10-22T07:05:00Z'), lastRunAt: Z('2026-10-22T06:55:00Z'),
  };
  const shape = (lang?: Lang) => {
    const r = run(input, lang);
    return { marks: r.activityIdsToMark, ms: r.messages.map(({ key, kind, url, tag, urgency, toUids }) => ({ key, kind, url, tag, urgency, toUids })) };
  };
  assert.deepEqual(shape('en'), shape('es'));
  assert.deepEqual(shape(), shape('es'));
  // …but the text differs
  assert.notEqual(run(input, 'en').messages[0].body, run(input, 'es').messages[0].body);
});

test('listEn, toLang and deviceLang', () => {
  assert.equal(listEn([]), '');
  assert.equal(listEn(['bread']), 'bread');
  assert.equal(listEn(['Lía', 'Iker']), 'Lía and Iker');
  assert.equal(listEn(['milk', 'bread', 'eggs']), 'milk, bread and eggs');
  assert.equal(listEn(['a', 'b', 'c', 'd'], 2), 'a, b and 2 more');
  assert.equal(toLang('en'), 'en');
  assert.equal(toLang('es'), 'es');
  for (const x of [undefined, null, '', 'fr', 'EN', 1]) assert.equal(toLang(x), 'es');
  assert.equal(deviceLang({}), 'es');
  assert.equal(deviceLang({ lang: 'en' }), 'en');
});
