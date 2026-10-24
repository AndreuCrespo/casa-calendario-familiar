// Shared setup and fixtures for the Firestore rules tests.
// Run with the emulator: see vitest.rules.config.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, type Firestore, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { LIMITS } from '../../src/shared/limits';

export { LIMITS };

export const PROJECT_ID = 'demo-casa';

/** Household ids and invite codes are Firestore auto ids: 20 alphanumerics. */
export const autoId = (prefix: string) => prefix.padEnd(20, '0');
export const HID = autoId('Household');
export const OTHER_HID = autoId('Otherhouse');
export const NEW_HID = autoId('Newhouse');
export const CODE = autoId('Invite');

/** alice and bob are members of HID; carol wants to join; eve is a stranger. */
export const ALICE = 'alice';
export const BOB = 'bob';
export const CAROL = 'carol';
export const EVE = 'eve';

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export type Data = Record<string, unknown>;

let env: RulesTestEnvironment;

/** Registers the emulator lifecycle hooks for the calling test file. */
export function setupRulesEnv() {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(fileURLToPath(new URL('../../firestore.rules', import.meta.url)), 'utf8'),
      },
    });
  });
  beforeEach(async () => {
    await env.clearFirestore();
  });
  afterAll(async () => {
    await env?.cleanup();
  });
}

// The test contexts hand out compat instances; the modular API accepts them.
export const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
export const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

/** Writes with the rules disabled (test setup). */
export async function seed(path: string, data: Data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), data);
  });
}

export const str = (n: number, ch = 'x') => ch.repeat(n);

// ---------------------------------------------------------------- fixtures

export function household(over: Data = {}): Data {
  return {
    name: 'Casa',
    memberUids: [ALICE, BOB],
    members: [
      { id: 'm1', name: 'Alice', color: '#4C7DF0', kind: 'adult', uid: ALICE },
      { id: 'm2', name: 'Bob', color: '#E2558A', kind: 'adult', uid: BOB },
      { id: 'm3', name: 'Sam', color: '#22A06B', kind: 'adult', uid: null },
      { id: 'k1', name: 'Noa', color: '#8B5CF6', kind: 'child' },
    ],
    timezone: 'Europe/Madrid',
    location: { name: 'Madrid', lat: 40.4165, lon: -3.7026 },
    notify: { dailySummary: true, dailyHour: 8, activity: true },
    createdAt: Date.now(),
    ...over,
  };
}

/** What Onboarding writes for a brand new household. */
export function newHousehold(uid: string, over: Data = {}): Data {
  return household({
    memberUids: [uid],
    members: [
      { id: 'm1', name: 'Me', color: '#4C7DF0', kind: 'adult', uid },
      { id: 'm2', name: 'Partner', color: '#E2558A', kind: 'adult', uid: null },
      { id: 'k1', name: 'Kid', color: '#8B5CF6', kind: 'child' },
    ],
    ...over,
  });
}

export function members(n: number): Data[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    name: `Member ${i}`,
    color: '#4C7DF0',
    kind: i === 0 ? 'adult' : 'child',
    ...(i === 0 ? { uid: ALICE } : {}),
  }));
}

export function invite(over: Data = {}): Data {
  return {
    householdName: 'Casa',
    createdBy: ALICE,
    createdByName: 'Alice',
    createdAt: Date.now(),
    expiresAt: Date.now() + 2 * DAY,
    ...over,
  };
}

export function event(over: Data = {}): Data {
  return {
    title: 'Pediatra',
    date: '2026-10-30',
    endDate: null,
    startTime: '17:30',
    endTime: '18:00',
    memberIds: ['k1'],
    recurrence: null,
    exdates: [],
    reminderMins: 60,
    location: 'Centro de salud',
    notes: '',
    createdBy: 'm1',
    updatedAt: Date.now(),
    ...over,
  };
}

export function shoppingItem(over: Data = {}): Data {
  return { name: 'Leche', done: false, addedBy: 'm1', createdAt: Date.now(), ...over };
}

export function task(over: Data = {}): Data {
  return {
    title: 'Sacar la basura',
    memberIds: ['m1'],
    due: '2026-10-24',
    repeat: { every: 1, unit: 'week' },
    notes: '',
    done: false,
    createdAt: Date.now(),
    ...over,
  };
}

export function keyDate(over: Data = {}): Data {
  return {
    title: 'Seguro del coche',
    kind: 'insurance',
    date: '2027-03-01',
    repeat: 'yearly',
    remindDays: 7,
    memberIds: [],
    amount: 45_990,
    notes: '',
    ...over,
  };
}

export function expense(over: Data = {}): Data {
  return {
    description: 'Supermercado',
    amount: 4_590,
    paidBy: 'm1',
    splitAmong: ['m1', 'm2'],
    date: '2026-10-24',
    category: 'groceries',
    kind: 'expense',
    createdBy: ALICE,
    createdAt: Date.now(),
    ...over,
  };
}

export function note(over: Data = {}): Data {
  return {
    title: 'Wifi',
    body: 'Clave: …',
    pinned: false,
    color: '#FDE9A9',
    updatedAt: Date.now(),
    updatedBy: 'm1',
    ...over,
  };
}

export function prefs(over: Data = {}): Data {
  return { dashboard: { order: ['agenda', 'menu'], hidden: [] }, updatedAt: Date.now(), ...over };
}

export function device(uid: string, over: Data = {}): Data {
  return {
    uid,
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: str(87, 'B'), auth: str(22, 'A') },
    },
    ua: 'Mozilla/5.0',
    createdAt: Date.now(),
    lang: 'es',
    ...over,
  };
}

export function activity(uid: string, over: Data = {}): Data {
  return {
    actorUid: uid,
    actorName: 'Alice',
    kind: 'shopping',
    text: 'leche',
    createdAt: Date.now(),
    notified: false,
    ...over,
  };
}

/** Seeds HID (alice and bob as members). */
export const seedHousehold = (over: Data = {}) => seed(`households/${HID}`, household(over));
