import { describe, expect, it } from 'vitest';
import { addDays, isDateStr, isTimeStr, timeToMinutes, todayIn, zonedParts, zonedToUtc } from './dates';

const Z = (iso: string) => Date.parse(iso);
const TZ = 'Europe/Madrid';

describe('zonedToUtc', () => {
  it('handles the spring DST change (Madrid, 2026-03-29)', () => {
    expect(zonedToUtc('2026-03-29', '01:30', TZ)).toBe(Z('2026-03-29T00:30:00Z')); // CET
    expect(zonedToUtc('2026-03-29', '03:30', TZ)).toBe(Z('2026-03-29T01:30:00Z')); // CEST
    // 02:30 doesn't exist: moved to 03:30 CEST
    expect(zonedToUtc('2026-03-29', '02:30', TZ)).toBe(Z('2026-03-29T01:30:00Z'));
    expect(zonedToUtc('2026-03-28', '20:00', TZ)).toBe(Z('2026-03-28T19:00:00Z'));
    expect(zonedToUtc('2026-03-30', '09:00', TZ)).toBe(Z('2026-03-30T07:00:00Z'));
  });

  it('handles the autumn DST change (Madrid, 2026-10-25)', () => {
    expect(zonedToUtc('2026-10-25', '01:30', TZ)).toBe(Z('2026-10-24T23:30:00Z')); // CEST
    expect(zonedToUtc('2026-10-25', '02:30', TZ)).toBe(Z('2026-10-25T00:30:00Z')); // repeated → the first one (CEST)
    expect(zonedToUtc('2026-10-25', '03:00', TZ)).toBe(Z('2026-10-25T02:00:00Z'));
    expect(zonedToUtc('2026-10-24', '09:00', TZ)).toBe(Z('2026-10-24T07:00:00Z'));
    expect(zonedToUtc('2026-10-26', '09:00', TZ)).toBe(Z('2026-10-26T08:00:00Z'));
  });

  it('round-trips with zonedParts every 15 min around DST changes', () => {
    const zones = ['Europe/Madrid', 'Atlantic/Canary', 'America/New_York', 'Australia/Sydney', 'Asia/Kolkata'];
    const days = [
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-11-01',
      '2026-04-05',
      '2026-10-04',
      '2026-03-08',
    ];
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
          expect(`${back.date} ${timeToMinutes(back.time) - m}`, `${tz} ${d} ${t}`).toBe(`${d} 60`);
        }
      }
    }
    // Madrid, Canaries, New York and Sydney have a 1 h gap (4 slots of 15 min) on these days.
    expect(gaps).toBe(4 * 4);
  });

  it('follows the same rules west of UTC (New York)', () => {
    const NY = 'America/New_York';
    expect(zonedToUtc('2026-03-08', '02:30', NY)).toBe(Z('2026-03-08T07:30:00Z')); // gap → 03:30 EDT
    expect(zonedToUtc('2026-11-01', '01:30', NY)).toBe(Z('2026-11-01T05:30:00Z')); // repeated → 01:30 EDT
    expect(zonedToUtc('2026-11-01', '09:00', NY)).toBe(Z('2026-11-01T14:00:00Z'));
  });
});

describe('dates', () => {
  it("todayIn uses the household's time zone", () => {
    expect(todayIn(TZ, Z('2026-10-22T22:30:00Z'))).toBe('2026-10-23');
    expect(todayIn(TZ, Z('2026-10-22T21:59:00Z'))).toBe('2026-10-22');
    expect(todayIn(TZ, Z('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  it('adds days across months, years and DST changes', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('recognizes well-formed dates and times', () => {
    for (const ok of ['2026-10-22', '2028-02-29', '0001-01-01']) expect(isDateStr(ok), ok).toBe(true);
    for (const bad of ['2026-13-01', '2026-10-32', '2026-1-5', '22/10/2026', '', null, 20261022, undefined]) {
      expect(isDateStr(bad), String(bad)).toBe(false);
    }
    for (const ok of ['00:00', '9:05', '23:59']) expect(isTimeStr(ok), ok).toBe(true);
    for (const bad of ['24:00', '12:60', '1200', '', null, 12]) expect(isTimeStr(bad), String(bad)).toBe(false);
  });
});
