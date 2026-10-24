// Tests of the notification texts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fmtTime, texts } from './i18n';

const es = texts('es');
const en = texts('en');

test('lists with a cap', () => {
  assert.equal(es.list(['a', 'b', 'c', 'd'], 2), 'a, b y 2 más');
  assert.equal(en.list(['a', 'b', 'c', 'd'], 2), 'a, b and 2 more');
  assert.equal(es.list(['Lía', 'Iker']), 'Lía e Iker');
  assert.equal(en.list(['milk', '', 'eggs']), 'milk and eggs');
  assert.equal(es.list(['a', 'b'], 2), 'a y b');
});

test('greetings change at the right hour', () => {
  assert.deepEqual(
    [12, 13, 19, 20].map((h) => es.greeting(h)),
    ['Buenos días', 'Buenas tardes', 'Buenas tardes', 'Buenas noches'],
  );
  assert.deepEqual(
    [11, 12, 17, 18].map((h) => en.greeting(h)),
    ['Good morning', 'Good afternoon', 'Good afternoon', 'Good evening'],
  );
});

test('relative days, near and far', () => {
  const today = '2026-10-22';
  assert.equal(es.relativeDay('2026-10-24', today), 'El sábado 24');
  assert.equal(en.relativeDay('2026-10-24', today), 'On Saturday 24');
  assert.equal(es.relativeDay('2026-10-29', today), 'El jueves 29 de octubre');
  assert.equal(en.relativeDay('2026-10-29', today), 'On Thursday 29 October');
  assert.equal(es.relativeDay('2027-01-05', today), 'El martes 5 de enero de 2027');
  assert.equal(es.reminderWhen('2026-10-29', '08:00', today), 'El jueves 29 de octubre a las 8:00');
  assert.equal(es.reminderWhen('2026-10-22', '13:30', today), 'Hoy a las 13:30');
  assert.equal(es.reminderWhen('2026-10-22', '01:30', today), 'Hoy a la 1:30');
});

test('times, money and unknown languages', () => {
  assert.equal(fmtTime('09:05'), '9:05');
  assert.equal(fmtTime('00:00'), '0:00');
  assert.equal(en.money(4590), '€45.90');
  assert.equal(es.money(4590).replace(/ /g, ' '), '45,90 €');
  assert.equal(texts('fr' as 'es'), es);
});

test('activity lines for unknown kinds', () => {
  assert.equal(es.activityLine('robot', ['x'], 8), 'Cambios: x');
  assert.equal(en.activityLine('robot', [], 8), 'Changes');
});
