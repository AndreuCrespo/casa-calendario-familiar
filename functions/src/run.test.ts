// Tests of run.ts (reading, delivery and state) with an in-memory Firestore.
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
let failingEndpoints = new Set<string>();

// Replaces real delivery with one that records what would have been sent.
(webpush as unknown as { sendNotification: unknown }).sendNotification = async (sub: { endpoint: string }, payload: string) => {
  if (goneEndpoints.has(sub.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 });
  if (failingEndpoints.has(sub.endpoint)) throw Object.assign(new Error('Server error'), { statusCode: 500 });
  sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  return {};
};

const H = 'households/h1';
const TZ = 'Europe/Madrid';
const EP_A = 'https://push.example/A';
const EP_B = 'https://push.example/B';

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
  db.seed(`${H}/devices/dA`, { uid: 'uA', subscription: sub(EP_A), ua: '', createdAt: 0 });
  db.seed(`${H}/devices/dB`, { uid: 'uB', subscription: sub(EP_B), ua: '', createdAt: 0 });
}

const asDb = (db: FakeFirestore) => db as unknown as Firestore;
const to = (endpoint: string) => sent.find((s) => s.endpoint === endpoint)?.payload;
const logKeys = (db: FakeFirestore) =>
  [...db.store.keys()].filter((p) => p.startsWith(`${H}/notifyLog/`)).map((p) => p.split('/').pop());

beforeEach(() => { sent = []; goneEndpoints = new Set(); failingEndpoints = new Set(); });

test('scheduled job: event reminder sent once and state saved', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.seed(`${H}/events/dent`, {
    title: 'Dentista', date: '2026-10-22', startTime: '17:00', endTime: '18:00',
    memberIds: ['k'], reminderMins: 60, recurrence: null, exdates: [], location: 'Clínica',
  });
  const fire = zonedToUtc('2026-10-22', '16:00', TZ);
  db.seed(`${H}/meta/notifier`, { lastRunAt: fire - 5 * 60_000 });

  await processAllHouseholds(asDb(db), fire + 60_000);
  assert.equal(sent.length, 2, 'to both phones');
  assert.equal(sent[0].payload.title, 'Dentista');
  assert.match(sent[0].payload.body, /17:00/);
  assert.ok(db.get(`${H}/notifyLog/ev_dent_2026-10-22_60`), 'logged');
  assert.equal(db.get(`${H}/meta/notifier`)!.lastRunAt, fire + 60_000);

  // The next run doesn't repeat it
  sent = [];
  await processAllHouseholds(asDb(db), fire + 6 * 60_000);
  assert.equal(sent.length, 0);
});

test('scheduled job: each device gets its own language, the key is logged once', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.write(`${H}/devices/dB`, { lang: 'en' }, true); // dA has no lang ⇒ Spanish
  db.seed(`${H}/events/dent`, {
    title: 'Dentista', date: '2026-10-22', startTime: '17:00', memberIds: ['k'], reminderMins: 60,
    recurrence: null, location: 'Clínica',
  });
  const fire = zonedToUtc('2026-10-22', '16:00', TZ);
  db.seed(`${H}/meta/notifier`, { lastRunAt: fire - 5 * 60_000 });

  await processAllHouseholds(asDb(db), fire + 60_000);
  assert.equal(sent.length, 2);
  assert.deepEqual(to(EP_A), { title: 'Dentista', body: 'Hoy a las 17:00 · Lía · Clínica', url: '/#/calendar', tag: 'ev_dent_2026-10-22' });
  assert.deepEqual(to(EP_B), { title: 'Dentista', body: 'Today at 17:00 · Lía · Clínica', url: '/#/calendar', tag: 'ev_dent_2026-10-22' });
  assert.deepEqual(logKeys(db), ['ev_dent_2026-10-22_60']);

  sent = [];
  await processAllHouseholds(asDb(db), fire + 6 * 60_000);
  assert.equal(sent.length, 0, 'not repeated in any language');
});

test('scheduled job: logged if any language got it, not if every target failed temporarily', async () => {
  const birthday = { title: 'Lía', kind: 'birthday', date: '2020-10-29', repeat: 'yearly', remindDays: 0 };
  const now = zonedToUtc('2026-10-29', '12:00', TZ);

  const db = new FakeFirestore();
  seedHousehold(db);
  db.write(`${H}/devices/dB`, { lang: 'en' }, true);
  db.seed(`${H}/dates/blia`, birthday);
  failingEndpoints.add(EP_A);
  await processAllHouseholds(asDb(db), now);
  assert.equal(sent.length, 1);
  assert.equal(to(EP_B)?.title, "🎂 Lía's birthday");
  assert.equal(to(EP_B)?.body, 'Turns 6 today!');
  assert.deepEqual(logKeys(db), ['kd_blia_2026-10-29_0']);

  const db2 = new FakeFirestore();
  seedHousehold(db2);
  db2.write(`${H}/devices/dB`, { lang: 'en' }, true);
  db2.seed(`${H}/dates/blia`, birthday);
  failingEndpoints.add(EP_B);
  sent = [];
  await processAllHouseholds(asDb(db2), now);
  assert.equal(sent.length, 0);
  assert.deepEqual(logKeys(db2), [], 'retried on the next run');
  failingEndpoints.clear();
  await processAllHouseholds(asDb(db2), now + 5 * 60_000);
  assert.equal(to(EP_A)?.body, '¡Hoy cumple 6 años!');
  assert.equal(to(EP_B)?.body, 'Turns 6 today!');
  assert.deepEqual(logKeys(db2), ['kd_blia_2026-10-29_0']);
});

test('scheduled job: deletes expired devices (410)', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.seed(`${H}/events/e`, { title: 'Algo', date: '2026-10-22', startTime: '12:00', memberIds: [], reminderMins: 0, recurrence: null });
  const fire = zonedToUtc('2026-10-22', '12:00', TZ);
  goneEndpoints.add(EP_B);
  await processAllHouseholds(asDb(db), fire + 60_000);
  assert.equal(sent.length, 1);
  assert.equal(db.get(`${H}/devices/dB`), undefined);
  assert.ok(db.get(`${H}/devices/dA`));
});

test('scheduled job: leaves recent activity to the instant function', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  const now = zonedToUtc('2026-10-22', '12:00', TZ);
  db.seed(`${H}/activity/x1`, { actorUid: 'uA', actorName: 'Alex', kind: 'shopping', text: 'leche', createdAt: now - 30_000, notified: false });
  db.seed(`${H}/activity/x2`, { actorUid: 'uA', actorName: 'Alex', kind: 'shopping', text: 'pan', createdAt: now - 10 * 60_000, notified: false });
  await processAllHouseholds(asDb(db), now);
  assert.equal(sent.length, 1, 'only the old one (pan), to the other phone');
  assert.equal(sent[0].endpoint, EP_B);
  assert.match(sent[0].payload.body, /pan/);
  assert.equal(db.get(`${H}/activity/x1`)!.notified, false);
  assert.equal(db.get(`${H}/activity/x2`)!.notified, true);
});

test('instant: a burst from the same person arrives as a single notification', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  const now = Date.now();
  db.seed(`${H}/activity/a1`, { actorUid: 'uB', actorName: 'Sam', kind: 'shopping', text: 'leche', createdAt: now - 3000, notified: false });
  db.seed(`${H}/activity/a2`, { actorUid: 'uB', actorName: 'Sam', kind: 'shopping', text: 'pan', createdAt: now - 2000, notified: false });
  db.seed(`${H}/activity/a3`, { actorUid: 'uB', actorName: 'Sam', kind: 'shopping', text: 'huevos', createdAt: now - 1000, notified: false });
  const ref = asDb(db).collection('households').doc('h1');

  // The triggers for a1 and a2 see there's a newer one and send nothing
  await processActivity(asDb(db), ref, 'a1', 0);
  await processActivity(asDb(db), ref, 'a2', 0);
  assert.equal(sent.length, 0);

  await processActivity(asDb(db), ref, 'a3', 0);
  assert.equal(sent.length, 1, "one notification, only to Alex's phone");
  assert.equal(sent[0].endpoint, EP_A);
  assert.equal(sent[0].payload.title, 'Sam');
  assert.match(sent[0].payload.body, /leche, pan y huevos/);
  assert.equal(sent[0].payload.url, '/#/shopping');
  for (const id of ['a1', 'a2', 'a3']) assert.equal(db.get(`${H}/activity/${id}`)!.notified, true);

  // A repeated trigger doesn't notify again
  await processActivity(asDb(db), ref, 'a3', 0);
  assert.equal(sent.length, 1);
});

test('instant: each device in its own language, items marked once', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.write(`${H}/devices/dB`, { lang: 'en' }, true);
  const now = Date.now();
  db.seed(`${H}/activity/n1`, { actorUid: 'uC', actorName: 'Noa', kind: 'shopping', text: 'leche', createdAt: now - 2000, notified: false });
  db.seed(`${H}/activity/n2`, { actorUid: 'uC', actorName: 'Noa', kind: 'shopping', text: 'pan', createdAt: now - 1000, notified: false });
  await processActivity(asDb(db), asDb(db).collection('households').doc('h1'), 'n2', 0);
  assert.equal(sent.length, 2);
  assert.equal(to(EP_A)?.body, 'Ha añadido a la compra: leche y pan');
  assert.equal(to(EP_B)?.body, 'Added to the shopping list: leche and pan');
  assert.equal(to(EP_A)?.tag, to(EP_B)?.tag);
  for (const id of ['n1', 'n2']) assert.equal(db.get(`${H}/activity/${id}`)!.notified, true);
});

test('instant: with activity notifications off it only marks', async () => {
  const db = new FakeFirestore();
  seedHousehold(db);
  db.write(H, { notify: { dailySummary: true, dailyHour: 8, activity: false } }, true);
  db.seed(`${H}/activity/z`, { actorUid: 'uA', actorName: 'Alex', kind: 'note', text: 'Wifi', createdAt: Date.now(), notified: false });
  await processActivity(asDb(db), asDb(db).collection('households').doc('h1'), 'z', 0);
  assert.equal(sent.length, 0);
  assert.equal(db.get(`${H}/activity/z`)!.notified, true);
});
