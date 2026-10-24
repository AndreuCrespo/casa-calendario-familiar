// Shared household data: events, shopping, tasks, menu, key dates, expenses, notes.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, type Firestore, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  anon,
  as,
  BOB,
  type Data,
  EVE,
  event,
  expense,
  HID,
  keyDate,
  LIMITS,
  note,
  seed,
  seedHousehold,
  setupRulesEnv,
  shoppingItem,
  str,
  task,
} from './helpers';

setupRulesEnv();

const sub = (db: Firestore, coll: string, id: string) => doc(db, 'households', HID, coll, id);

/** Valid docs are accepted for members; each bad variant is rejected. */
async function checkShape(coll: string, valid: Data, bad: Data[]) {
  await assertSucceeds(setDoc(sub(as(ALICE), coll, 'ok'), valid));
  for (const [i, data] of bad.entries()) {
    await assertFails(setDoc(sub(as(ALICE), coll, `bad${i}`), data));
  }
}

/** Members read, write and delete; strangers and signed-out users can't. */
function accessSuite(coll: string, make: () => Data) {
  it('members can create, read, list and delete', async () => {
    const db = as(ALICE);
    await assertSucceeds(setDoc(sub(db, coll, 'x1'), make()));
    await assertSucceeds(getDoc(sub(as(BOB), coll, 'x1')));
    await assertSucceeds(getDocs(collection(as(BOB), 'households', HID, coll)));
    await assertSucceeds(deleteDoc(sub(as(BOB), coll, 'x1')));
  });

  it('non-members and signed-out users have no access', async () => {
    await seed(`households/${HID}/${coll}/x1`, make());
    await assertFails(getDoc(sub(as(EVE), coll, 'x1')));
    await assertFails(getDocs(collection(as(EVE), 'households', HID, coll)));
    await assertFails(setDoc(sub(as(EVE), coll, 'x2'), make()));
    await assertFails(deleteDoc(sub(as(EVE), coll, 'x1')));
    await assertFails(getDoc(sub(anon(), coll, 'x1')));
  });
}

beforeEach(() => seedHousehold());

describe('events', () => {
  accessSuite('events', () => event());

  it('accepts the shapes the editor writes', async () => {
    const db = as(ALICE);
    await assertSucceeds(setDoc(sub(db, 'events', 'a'), event({ startTime: null, endTime: null })));
    await assertSucceeds(
      setDoc(
        sub(db, 'events', 'b'),
        event({
          endDate: '2026-11-02',
          recurrence: { freq: 'weekly', interval: 2, byWeekday: [0, 2, 4], until: '2027-06-30' },
        }),
      ),
    );
    await assertSucceeds(
      setDoc(sub(db, 'events', 'c'), event({ recurrence: { freq: 'monthly', interval: 1, until: null } })),
    );
    const {
      endDate: _e,
      startTime: _s,
      endTime: _t,
      recurrence: _r,
      exdates: _x,
      reminderMins: _m,
      location: _l,
      notes: _n,
      createdBy: _c,
      updatedAt: _u,
      ...minimal
    } = event();
    await assertSucceeds(setDoc(sub(db, 'events', 'd'), minimal));
    await assertSucceeds(setDoc(sub(db, 'events', 'e'), event({ title: str(LIMITS.title), notes: str(LIMITS.notes) })));
  });

  it('allows deleting one occurrence (update of exdates)', async () => {
    await seed(`households/${HID}/events/r1`, event({ recurrence: { freq: 'daily', interval: 1 } }));
    await assertSucceeds(updateDoc(sub(as(ALICE), 'events', 'r1'), { exdates: ['2026-10-31'] }));
    await assertFails(
      updateDoc(sub(as(ALICE), 'events', 'r1'), { exdates: Array(LIMITS.exdates + 1).fill('2026-10-31') }),
    );
  });

  it('rejects malformed events', async () => {
    await checkShape('events', event(), [
      event({ title: '' }),
      event({ title: str(LIMITS.title + 1) }),
      event({ date: '30/10/2026' }),
      event({ date: 20261030 }),
      event({ endDate: '2026-13-01' }),
      event({ startTime: '25:00' }),
      event({ endTime: '9:00' }),
      event({ memberIds: Array(LIMITS.members + 1).fill('k1') }),
      event({ memberIds: 'k1' }),
      event({ recurrence: { freq: 'hourly', interval: 1 } }),
      event({ recurrence: { freq: 'daily', interval: 0 } }),
      event({ recurrence: { freq: 'daily', interval: 100 } }),
      event({ recurrence: { freq: 'daily', interval: 1.5 } }),
      event({ recurrence: { freq: 'weekly', interval: 1, byWeekday: [7] } }),
      event({ recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 1, 2, 3, 4, 5, 6, 0] } }),
      event({ recurrence: { freq: 'daily', interval: 1, until: 'never' } }),
      event({ recurrence: { freq: 'daily', interval: 1, count: 3 } }),
      event({ exdates: Array(LIMITS.exdates + 1).fill('2026-10-31') }),
      event({ reminderMins: '60' }),
      event({ reminderMins: 1.5 }),
      event({ location: str(LIMITS.place + 1) }),
      event({ notes: str(LIMITS.notes + 1) }),
      event({ createdBy: 42 }),
      event({ updatedAt: 'now' }),
      event({ color: '#000000' }),
    ]);
  });
});

describe('shopping', () => {
  accessSuite('shopping', () => shoppingItem());

  it('allows the partial updates the list makes', async () => {
    await seed(`households/${HID}/shopping/s1`, shoppingItem());
    const db = as(BOB);
    await assertSucceeds(updateDoc(sub(db, 'shopping', 's1'), { done: true, doneAt: Date.now() }));
    await assertSucceeds(
      updateDoc(sub(db, 'shopping', 's1'), { done: false, doneAt: null, createdAt: Date.now(), addedBy: 'm2' }),
    );
    await assertFails(updateDoc(sub(db, 'shopping', 's1'), { done: 'yes' }));
  });

  it('rejects malformed items', async () => {
    await checkShape('shopping', shoppingItem({ name: str(LIMITS.shoppingItem), addedBy: null }), [
      shoppingItem({ name: '' }),
      shoppingItem({ name: str(LIMITS.shoppingItem + 1) }),
      shoppingItem({ done: 0 }),
      shoppingItem({ createdAt: '2026-10-24' }),
      shoppingItem({ doneAt: 'today' }),
      shoppingItem({ addedBy: 7 }),
      shoppingItem({ qty: 2 }),
    ]);
  });
});

describe('tasks', () => {
  accessSuite('tasks', () => task());

  it('allows the partial updates the task list makes', async () => {
    await seed(`households/${HID}/tasks/t1`, task());
    const db = as(ALICE);
    await assertSucceeds(
      updateDoc(sub(db, 'tasks', 't1'), { due: '2026-10-31', lastDoneAt: Date.now(), lastDoneBy: 'm1' }),
    );
    await assertSucceeds(updateDoc(sub(db, 'tasks', 't1'), { done: true, lastDoneAt: Date.now(), lastDoneBy: null }));
    await assertSucceeds(
      updateDoc(sub(db, 'tasks', 't1'), { due: null, done: false, lastDoneAt: null, lastDoneBy: null }),
    );
    await assertSucceeds(
      updateDoc(sub(db, 'tasks', 't1'), { title: 'Otra', memberIds: [], due: null, repeat: null, notes: '' }),
    );
    await assertFails(updateDoc(sub(db, 'tasks', 't1'), { done: 'no' }));
  });

  it('rejects malformed tasks', async () => {
    await checkShape('tasks', task({ title: str(LIMITS.title), repeat: { every: 365, unit: 'day' } }), [
      task({ title: '' }),
      task({ title: str(LIMITS.title + 1) }),
      task({ memberIds: Array(LIMITS.members + 1).fill('m1') }),
      task({ due: 'tomorrow' }),
      task({ repeat: { every: 0, unit: 'week' } }),
      task({ repeat: { every: 366, unit: 'day' } }),
      task({ repeat: { every: 1, unit: 'year' } }),
      task({ repeat: { every: 1 } }),
      task({ done: null }),
      task({ notes: str(LIMITS.notes + 1) }),
      task({ lastDoneAt: 'yesterday' }),
      task({ priority: 'high' }),
    ]);
  });
});

describe('menu', () => {
  const day = (db: Firestore, id: string) => sub(db, 'menu', id);

  it('members can write a day with merge, and read the week', async () => {
    const db = as(ALICE);
    await assertSucceeds(setDoc(day(db, '2026-10-26'), { lunch: 'Lentejas' }, { merge: true }));
    await assertSucceeds(setDoc(day(db, '2026-10-26'), { dinner: str(LIMITS.dish) }, { merge: true }));
    await assertSucceeds(setDoc(day(db, '2026-10-27'), { lunch: '', dinner: '' }, { merge: true }));
    await assertSucceeds(getDocs(collection(as(BOB), 'households', HID, 'menu')));
  });

  it('the document id must be a date', async () => {
    await assertFails(setDoc(day(as(ALICE), 'monday'), { lunch: 'Lentejas' }, { merge: true }));
  });

  it('rejects malformed days', async () => {
    const db = as(ALICE);
    await assertFails(setDoc(day(db, '2026-10-26'), { lunch: str(LIMITS.dish + 1) }, { merge: true }));
    await assertFails(setDoc(day(db, '2026-10-26'), { lunch: 3 }, { merge: true }));
    await assertFails(setDoc(day(db, '2026-10-26'), { breakfast: 'Tostadas' }, { merge: true }));
  });

  it('non-members have no access', async () => {
    await assertFails(setDoc(day(as(EVE), '2026-10-26'), { lunch: 'x' }, { merge: true }));
    await assertFails(getDocs(collection(as(EVE), 'households', HID, 'menu')));
  });
});

describe('key dates', () => {
  accessSuite('dates', () => keyDate());

  it('accepts the shapes the editor writes', async () => {
    const db = as(ALICE);
    await assertSucceeds(setDoc(sub(db, 'dates', 'a'), keyDate({ amount: null })));
    await assertSucceeds(setDoc(sub(db, 'dates', 'b'), keyDate({ kind: 'birthday', amount: 0, remindDays: 365 })));
    await assertSucceeds(setDoc(sub(db, 'dates', 'c'), keyDate({ amount: LIMITS.amountCents })));
    const { memberIds: _m, amount: _a, notes: _n, ...minimal } = keyDate();
    await assertSucceeds(setDoc(sub(db, 'dates', 'd'), minimal));
  });

  it('rejects malformed key dates', async () => {
    await checkShape('dates', keyDate(), [
      keyDate({ title: '' }),
      keyDate({ title: str(LIMITS.title + 1) }),
      keyDate({ kind: str(21) }),
      keyDate({ date: '2027-02-30x' }),
      keyDate({ repeat: 'weekly' }),
      keyDate({ remindDays: -1 }),
      keyDate({ remindDays: 366 }),
      keyDate({ remindDays: '7' }),
      keyDate({ amount: LIMITS.amountCents + 1 }),
      keyDate({ amount: -5 }),
      keyDate({ amount: 12.5 }),
      keyDate({ memberIds: Array(LIMITS.members + 1).fill('m1') }),
      keyDate({ notes: str(LIMITS.notes + 1) }),
      keyDate({ done: true }),
    ]);
  });
});

describe('expenses', () => {
  accessSuite('expenses', () => expense());

  it('accepts expenses, settle-ups and legacy categories', async () => {
    const db = as(ALICE);
    await assertSucceeds(
      setDoc(sub(db, 'expenses', 'a'), expense({ kind: 'settle', description: '', splitAmong: ['m2'] })),
    );
    await assertSucceeds(setDoc(sub(db, 'expenses', 'b'), expense({ category: 'otros', createdBy: null })));
    await assertSucceeds(
      setDoc(sub(db, 'expenses', 'c'), expense({ amount: LIMITS.amountCents, description: str(LIMITS.title) })),
    );
    const { createdBy: _c, ...noAuthor } = expense();
    await assertSucceeds(setDoc(sub(db, 'expenses', 'd'), noAuthor));
  });

  it('rejects malformed expenses', async () => {
    await checkShape('expenses', expense(), [
      expense({ amount: 0 }),
      expense({ amount: -100 }),
      expense({ amount: 10.5 }),
      expense({ amount: LIMITS.amountCents + 1 }),
      expense({ description: str(LIMITS.title + 1) }),
      expense({ paidBy: '' }),
      expense({ splitAmong: [] }),
      expense({ splitAmong: Array(LIMITS.members + 1).fill('m1') }),
      expense({ date: 'today' }),
      expense({ category: str(21) }),
      expense({ kind: 'refund' }),
      expense({ createdAt: null }),
      expense({ receipt: 'https://example.com/r.jpg' }),
    ]);
  });
});

describe('notes', () => {
  accessSuite('notes', () => note());

  it('accepts notes with an empty title or body', async () => {
    const db = as(ALICE);
    await assertSucceeds(setDoc(sub(db, 'notes', 'a'), note({ title: '', body: str(LIMITS.noteBody) })));
    await assertSucceeds(setDoc(sub(db, 'notes', 'b'), note({ body: '', updatedBy: null })));
  });

  it('rejects malformed notes', async () => {
    await checkShape('notes', note(), [
      note({ title: str(LIMITS.title + 1) }),
      note({ body: str(LIMITS.noteBody + 1) }),
      note({ pinned: 'yes' }),
      note({ color: 'url(https://evil.example/pixel)' }),
      note({ color: '#FFF' }),
      note({ updatedAt: '2026-10-24' }),
      note({ updatedBy: 3 }),
      note({ archived: false }),
    ]);
  });
});
