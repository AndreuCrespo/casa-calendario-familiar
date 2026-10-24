import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../i18n';
import { centsToInput, countdown, dayLong, dayRelative, dayShort, hm, inDays, joinNames, parseEuros } from './format';

beforeAll(async () => {
  await setLang('es');
});

describe('parseEuros', () => {
  it.each([
    ['23,40', 'es', 2340],
    ['23.40', 'es', 2340],
    ['23.4', 'es', 2340],
    ['1.234,50', 'es', 123450],
    ['1.200', 'es', 120000],
    ['1.234.567', 'es', 123456700],
    ['1.005', 'es', 100500],
    ['€ 12', 'es', 1200],
    ['12 €', 'es', 1200],
    ['0,5', 'es', 50],
    ['12,', 'es', 1200],
    ['23.40', 'en', 2340],
    ['1,234.50', 'en', 123450],
    ['1,234', 'en', 123400],
    ['23,40', 'en', 2340],
  ] as const)('%s (%s) → %i cents', (input, lang, cents) => {
    expect(parseEuros(input, lang)).toBe(cents);
  });

  it.each(['', 'abc', '-5', '1,2,3.4.5x', '12,345,', '1.2.3', '12.34.56', '1,005'])('rejects %j', (input) => {
    expect(parseEuros(input, 'es')).toBeNull();
  });

  it('rejects more than two decimals', () => {
    expect(parseEuros('1.005', 'en')).toBeNull();
  });

  it('round-trips with centsToInput', () => {
    for (const lang of ['es', 'en'] as const) {
      for (const cents of [0, 5, 99, 2340, 123450, 100000000]) {
        expect(parseEuros(centsToInput(cents, lang), lang)).toBe(cents);
      }
    }
  });
});

describe('dates in Spanish', () => {
  it('formats long and short dates', () => {
    expect(dayLong('2026-10-20')).toBe('martes 20 de octubre');
    expect(dayShort('2026-10-20')).toBe('mar 20 oct');
  });

  it('describes days relative to today', () => {
    expect(dayRelative('2026-10-20', '2026-10-20')).toBe('Hoy');
    expect(dayRelative('2026-10-21', '2026-10-20')).toBe('Mañana');
    expect(dayRelative('2026-10-19', '2026-10-20')).toBe('Ayer');
    expect(dayRelative('2026-10-25', '2026-10-20')).toBe('dom 25 oct');
    expect(inDays('2026-10-23', '2026-10-20')).toContain('3');
    expect(inDays('2026-10-17', '2026-10-20')).toContain('3');
  });

  it('counts down at the boundaries', () => {
    expect(countdown(0)).toBe(countdown(-1));
    expect(countdown(59 * 60_000)).toContain('59');
    expect(countdown(60 * 60_000)).toContain('1');
    expect(countdown(36 * 3_600_000)).toContain('2');
  });
});

describe('dates in English', () => {
  it('formats long and short dates', async () => {
    await setLang('en');
    expect(dayLong('2026-10-20')).toBe('Tuesday 20 October');
    expect(dayShort('2026-10-20')).toBe('Tue 20 Oct');
    await setLang('es');
  });
});

describe('small helpers', () => {
  it('pads hours and minutes', () => {
    expect(hm(9)).toBe('09:00');
    expect(hm(23, 5)).toBe('23:05');
  });

  it('joins names in the current language', () => {
    expect(joinNames(['Alex'])).toBe('Alex');
    expect(joinNames(['Alex', 'Sam', 'Lía'])).toBe('Alex, Sam y Lía');
    expect(joinNames(['Lía', 'Iker'])).toBe('Lía e Iker');
  });
});
