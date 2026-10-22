// Tests de run.ts (lectura, envío y estado) con un Firestore en memoria.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import type { Firestore } from 'firebase-admin/firestore';
import { FakeFirestore } from './fake-firestore';
import { processActivity, processAllHouseholds } from './run';
import { zonedToUtc } from '../../src/shared/dates';

interface Sent { endpoint: string; payload: { title: string; body: string; url: string; tag: string } }
let sent: Sent[] = [];
let goneEndpoints = new Set<string>();

// Sustituye el envío real por uno que apunta lo que se habría mandado.
(webpush as unknown as { sendNotification: unknown }).sendNotification = async (sub: { endpoint: string }, payload: string) => {
  if (goneEndpoints.has(sub.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 });
  sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  return {};
};

const H = 'households/h1';
const TZ = 'Europe/Madrid';

function seedHousehold(db: FakeFirestore) {
  db.seed(H, {
    name: 'Casa', timezone: TZ, memberUids: ['uA', 'uB'],
    members: [
      { id: 'a', name: 'Alex', color: '#000', kind: 'adult', uid: 'uA' },
      { id: 'b', name: 'Sam', color: '#000', kind: 'adult', uid: 'uB' },
      { id: 'k', name: 'Lía', color: '#000', kind: 'child' },
    ],
    notify: { dailySummary: true, dailyHour: 8, activity: true },
  });
  const sub = (ep: string) => ({ endpoint: ep, keys: { p256dh: 'p', auth: 'a' } });
  db.seed(`${H}/devices/dA`, { uid: 'uA', subscription: sub('https://push.example/A'), ua: '', createdAt: 0 });
  db.seed(`${H}/devices/dB`, { uid: 'uB', subscription: sub('https://push.example/B'), ua: '', createdAt: 0 });
}

const asDb = (db: FakeFirestore) => db as unknown as Firestore;

beforeEach(() => { sent = []; goneEndpoints = new Set(); });

test('tarea programada: recordatorio de evento una sola vez y estado guardado', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.seed(`${H}/events/dent`, {
    title: 'Dentista', date: '2026-10-22', startTime: '17:00', endTime: '18:00',
    memberIds: ['k'], reminderMins: 60, recurrence: null, exdates: [], location: 'Clínica',
  });
  const fire = zonedToUtc('2026-10-22', '16:00', TZ);
  db.seed(`${H}/meta/notifier`, { lastRunAt: fire - 5 * 60_000 });

  await processAllHouseholds(asDb(db), fire + 60_000);
  assert.equal(sent.length, 2, 'a los dos móviles');
  assert.equal(sent[0].payload.title, 'Dentista');
  assert.match(sent[0].payload.body, /17:00/);
  assert.ok(db.get(`${H}/notifyLog/ev_dent_2026-10-22_60`), 'queda apuntado');
  assert.equal(db.get(`${H}/meta/notifier`)!.lastRunAt, fire + 60_000);

  // La siguiente ejecución no lo repite
  sent = [];
  await processAllHouseholds(asDb(db), fire + 6 * 60_000);
  assert.equal(sent.length, 0);
});

test('tarea programada: borra dispositivos caducados (410)', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.seed(`${H}/events/e`, { title: 'Algo', date: '2026-10-22', startTime: '12:00', memberIds: [], reminderMins: 0, recurrence: null });
  const fire = zonedToUtc('2026-10-22', '12:00', TZ);
  goneEndpoints.add('https://push.example/B');
  await processAllHouseholds(asDb(db), fire + 60_000);
  assert.equal(sent.length, 1);
  assert.equal(db.get(`${H}/devices/dB`), undefined);
  assert.ok(db.get(`${H}/devices/dA`));
});

test('tarea programada: la actividad reciente la deja para la función instantánea', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  const now = zonedToUtc('2026-10-22', '12:00', TZ);
  db.seed(`${H}/activity/x1`, { actorUid: 'uA', actorName: 'Alex', kind: 'shopping', text: 'leche', createdAt: now - 30_000, notified: false });
  db.seed(`${H}/activity/x2`, { actorUid: 'uA', actorName: 'Alex', kind: 'shopping', text: 'pan', createdAt: now - 10 * 60_000, notified: false });
  await processAllHouseholds(asDb(db), now);
  assert.equal(sent.length, 1, 'solo la antigua (pan), al otro móvil');
  assert.equal(sent[0].endpoint, 'https://push.example/B');
  assert.match(sent[0].payload.body, /pan/);
  assert.equal(db.get(`${H}/activity/x1`)!.notified, false);
  assert.equal(db.get(`${H}/activity/x2`)!.notified, true);
});

test('al momento: una ráfaga de la misma persona llega en un solo aviso', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  const now = Date.now();
  db.seed(`${H}/activity/a1`, { actorUid: 'uB', actorName: 'Sam', kind: 'shopping', text: 'leche', createdAt: now - 3000, notified: false });
  db.seed(`${H}/activity/a2`, { actorUid: 'uB', actorName: 'Sam', kind: 'shopping', text: 'pan', createdAt: now - 2000, notified: false });
  db.seed(`${H}/activity/a3`, { actorUid: 'uB', actorName: 'Sam', kind: 'shopping', text: 'huevos', createdAt: now - 1000, notified: false });
  const ref = asDb(db).collection('households').doc('h1');

  // Los disparadores de a1 y a2 ven que hay uno más nuevo y no envían nada
  await processActivity(asDb(db), ref, 'a1', 0);
  await processActivity(asDb(db), ref, 'a2', 0);
  assert.equal(sent.length, 0);

  await processActivity(asDb(db), ref, 'a3', 0);
  assert.equal(sent.length, 1, 'un aviso, solo al móvil de Alex');
  assert.equal(sent[0].endpoint, 'https://push.example/A');
  assert.equal(sent[0].payload.title, 'Sam');
  assert.match(sent[0].payload.body, /leche, pan y huevos/);
  assert.equal(sent[0].payload.url, '/#/compra');
  for (const id of ['a1', 'a2', 'a3']) assert.equal(db.get(`${H}/activity/${id}`)!.notified, true);

  // Un disparador repetido no vuelve a avisar
  await processActivity(asDb(db), ref, 'a3', 0);
  assert.equal(sent.length, 1);
});

test('al momento: con los avisos de actividad desactivados solo se marca', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.write(H, { notify: { dailySummary: true, dailyHour: 8, activity: false } }, true);
  db.seed(`${H}/activity/z`, { actorUid: 'uA', actorName: 'Alex', kind: 'note', text: 'Wifi', createdAt: Date.now(), notified: false });
  await processActivity(asDb(db), asDb(db).collection('households').doc('h1'), 'z', 0);
  assert.equal(sent.length, 0);
  assert.equal(db.get(`${H}/activity/z`)!.notified, true);
});
