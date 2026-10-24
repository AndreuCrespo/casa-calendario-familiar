import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  anon,
  as,
  BOB,
  EVE,
  HID,
  household,
  LIMITS,
  members,
  NEW_HID,
  newHousehold,
  seed,
  seedHousehold,
  setupRulesEnv,
  str,
} from './helpers';

setupRulesEnv();

const ref = (db: ReturnType<typeof as>, hid = HID) => doc(db, 'households', hid);

describe('household: reading', () => {
  beforeEach(() => seedHousehold());

  it('members can read their household', async () => {
    await assertSucceeds(getDoc(ref(as(ALICE))));
  });

  it('signed-in non-members cannot read it, even knowing the id', async () => {
    await assertFails(getDoc(ref(as(EVE))));
  });

  it('signed-out users cannot read it', async () => {
    await assertFails(getDoc(ref(anon())));
  });

  it('members can list the households they belong to', async () => {
    await assertSucceeds(
      getDocs(query(collection(as(ALICE), 'households'), where('memberUids', 'array-contains', ALICE))),
    );
  });

  it('nobody can list every household', async () => {
    await assertFails(getDocs(collection(as(ALICE), 'households')));
  });

  it("nobody can list someone else's households", async () => {
    await assertFails(getDocs(query(collection(as(EVE), 'households'), where('memberUids', 'array-contains', ALICE))));
  });
});

describe('household: creating', () => {
  const create = (data: Record<string, unknown>, hid = NEW_HID, uid = EVE) => setDoc(ref(as(uid), hid), data);

  it('any signed-in user can create a household with only themselves as member', async () => {
    await assertSucceeds(create(newHousehold(EVE)));
  });

  it('accepts a household without location or notify settings', async () => {
    const { location: _l, notify: _n, ...rest } = newHousehold(EVE);
    await assertSucceeds(create(rest));
  });

  it('accepts a null location', async () => {
    await assertSucceeds(create(newHousehold(EVE, { location: null })));
  });

  it('signed-out users cannot create one', async () => {
    await assertFails(setDoc(ref(anon(), NEW_HID), newHousehold(EVE)));
  });

  it('cannot enrol other accounts at creation', async () => {
    await assertFails(create(newHousehold(EVE, { memberUids: [EVE, ALICE] })));
    await assertFails(create(newHousehold(EVE, { memberUids: [ALICE] })));
  });

  it('the id must be a Firestore auto id', async () => {
    await assertFails(create(newHousehold(EVE), '0'));
    await assertFails(create(newHousehold(EVE), 'my-household-id-0001'));
  });

  it('cannot carry joinedWith entries', async () => {
    await assertFails(create(newHousehold(EVE, { joinedWith: {} })));
    await assertFails(
      create(newHousehold(EVE, { joinedWith: { [EVE]: 'Invite00000000000000' } }), 'Newhouse000000000002'),
    );
  });

  it('rejects unknown fields', async () => {
    await assertFails(create(newHousehold(EVE, { owner: EVE })));
  });

  it('validates the name', async () => {
    await assertSucceeds(create(newHousehold(EVE, { name: str(LIMITS.householdName) })));
    await assertFails(create(newHousehold(EVE, { name: str(LIMITS.householdName + 1) }), 'Newhouse000000000002'));
    await assertFails(create(newHousehold(EVE, { name: '' }), 'Newhouse000000000003'));
    await assertFails(create(newHousehold(EVE, { name: 42 }), 'Newhouse000000000004'));
  });

  it('validates the members list size', async () => {
    const twelve = members(LIMITS.members).map((m, i) => (i === 0 ? { ...m, uid: EVE } : m));
    await assertSucceeds(create(newHousehold(EVE, { members: twelve })));
    const thirteen = [...twelve, { id: 'x', name: 'X', color: '#000000', kind: 'child' }];
    await assertFails(create(newHousehold(EVE, { members: thirteen }), 'Newhouse000000000002'));
    await assertFails(create(newHousehold(EVE, { members: [] }), 'Newhouse000000000003'));
    await assertFails(create(newHousehold(EVE, { members: 'everyone' }), 'Newhouse000000000004'));
  });

  it('validates every member entry', async () => {
    const withMember = (m: Record<string, unknown>) => {
      const list = newHousehold(EVE).members as Record<string, unknown>[];
      return newHousehold(EVE, { members: [...list, m] });
    };
    const ok = { id: 'k2', name: 'Lía', color: '#22A06B', kind: 'child' };
    await assertSucceeds(create(withMember(ok)));
    const bad: Record<string, unknown>[] = [
      { ...ok, name: str(LIMITS.memberName + 1) },
      { ...ok, name: '' },
      { ...ok, color: 'url(https://evil.example/x)' },
      { ...ok, color: 'red' },
      { ...ok, kind: 'pet' },
      { ...ok, uid: 42 },
      { ...ok, admin: true },
      { name: 'No id', color: '#22A06B', kind: 'child' },
    ];
    for (const [i, m] of bad.entries()) {
      await assertFails(create(withMember(m), `Badmember${String(i).padStart(11, '0')}`));
    }
  });

  it('validates timezone, location, notify and createdAt', async () => {
    const bad: Record<string, unknown>[] = [
      { timezone: str(65, 'A') },
      { timezone: 'Europe/Madrid; drop' },
      { timezone: 42 },
      { location: { name: 'Madrid', lat: '40.4', lon: -3.7 } },
      { location: { name: 'Madrid', lat: 91, lon: -3.7 } },
      { location: { name: str(LIMITS.place + 1), lat: 40.4, lon: -3.7 } },
      { location: { name: 'Madrid', lat: 40.4, lon: -3.7, extra: 1 } },
      { notify: { dailySummary: true, dailyHour: 24, activity: true } },
      { notify: { dailySummary: true, dailyHour: 8.5, activity: true } },
      { notify: { dailySummary: 'yes', dailyHour: 8, activity: true } },
      { notify: { dailySummary: true, dailyHour: 8 } },
      { createdAt: 'yesterday' },
    ];
    for (const [i, over] of bad.entries()) {
      await assertFails(create(newHousehold(EVE, over), `Badfield${String(i).padStart(12, '0')}`));
    }
  });
});

describe('household: members editing it', () => {
  beforeEach(() => seedHousehold());

  it('can rename it and change settings, location, timezone and members', async () => {
    const db = as(ALICE);
    await assertSucceeds(updateDoc(ref(db), { name: 'Casa nueva' }));
    await assertSucceeds(updateDoc(ref(db), { notify: { dailySummary: false, dailyHour: 7, activity: true } }));
    await assertSucceeds(updateDoc(ref(db), { location: { name: 'Valencia', lat: 39.47, lon: -0.38 } }));
    await assertSucceeds(updateDoc(ref(db), { location: null }));
    await assertSucceeds(updateDoc(ref(db), { timezone: 'Atlantic/Canary' }));
    const next = [...(household().members as unknown[]), { id: 'k2', name: 'Lía', color: '#22A06B', kind: 'child' }];
    await assertSucceeds(updateDoc(ref(db), { members: next }));
  });

  it('can remove another account (and its member entry)', async () => {
    const remaining = (household().members as { uid?: string }[]).filter((m) => m.uid !== BOB);
    await assertSucceeds(updateDoc(ref(as(ALICE)), { members: remaining, memberUids: [ALICE] }));
  });

  it('can remove an account with arrayRemove', async () => {
    await assertSucceeds(updateDoc(ref(as(ALICE)), { memberUids: arrayRemove(BOB) }));
  });

  it('can leave the household', async () => {
    await assertSucceeds(updateDoc(ref(as(BOB)), { memberUids: arrayRemove(BOB) }));
  });

  it('the last account cannot leave (no orphan households)', async () => {
    await seedHousehold({ memberUids: [ALICE] });
    await assertFails(updateDoc(ref(as(ALICE)), { memberUids: [] }));
  });

  it('cannot add other accounts', async () => {
    const db = as(ALICE);
    await assertFails(updateDoc(ref(db), { memberUids: arrayUnion(EVE) }));
    await assertFails(updateDoc(ref(db), { memberUids: [ALICE, EVE] }));
    await assertFails(updateDoc(ref(db), { memberUids: [ALICE, BOB, ALICE] }));
  });

  it('cannot change createdAt or joinedWith', async () => {
    await seedHousehold({ joinedWith: { [BOB]: 'Invite00000000000000' } });
    const db = as(ALICE);
    await assertFails(updateDoc(ref(db), { createdAt: 1 }));
    await assertFails(updateDoc(ref(db), { [`joinedWith.${ALICE}`]: 'Invite00000000000000' }));
    await assertFails(updateDoc(ref(db), { [`joinedWith.${BOB}`]: 'Invite00000000000001' }));
    await assertFails(updateDoc(ref(db), { joinedWith: {} }));
    // ...while ordinary edits keep working on a household that has entries.
    await assertSucceeds(updateDoc(ref(db), { name: 'Casa' }));
  });

  it('cannot store malformed data', async () => {
    const db = as(ALICE);
    await assertFails(updateDoc(ref(db), { members: 'x' }));
    await assertFails(updateDoc(ref(db), { members: [{ id: 'm1', name: 'A', color: '#000', kind: 'adult' }] }));
    await assertFails(updateDoc(ref(db), { location: { name: 'X', lat: 'north', lon: 0 } }));
    await assertFails(updateDoc(ref(db), { timezone: 7 }));
    await assertFails(updateDoc(ref(db), { name: str(LIMITS.householdName + 1) }));
    await assertFails(updateDoc(ref(db), { extra: true }));
  });

  it('nobody can delete a household', async () => {
    await assertFails(deleteDoc(ref(as(ALICE))));
  });

  it('non-members cannot edit it', async () => {
    await assertFails(updateDoc(ref(as(EVE)), { name: 'Mine now' }));
    await assertFails(updateDoc(ref(as(EVE)), { memberUids: [EVE] }));
  });

  it('a household at the maximum size can be edited (rules expression budget)', async () => {
    const full = members(LIMITS.members);
    await seedHousehold({ members: full });
    const renamed = full.map((m, i) => (i === 11 ? { ...m, name: str(LIMITS.memberName) } : m));
    await assertSucceeds(updateDoc(ref(as(ALICE)), { members: renamed, name: str(LIMITS.householdName) }));
    await assertSucceeds(
      updateDoc(ref(as(ALICE)), {
        members: full,
        name: 'Casa',
        timezone: 'America/Argentina/Buenos_Aires',
        location: { name: str(LIMITS.place), lat: -34.6, lon: -58.4 },
        notify: { dailySummary: true, dailyHour: 23, activity: false },
        memberUids: [ALICE],
      }),
    );
  });

  it('a household seeded without optional fields can still be edited', async () => {
    const { location: _l, notify: _n, ...rest } = household();
    await seed(`households/${HID}`, rest);
    await assertSucceeds(updateDoc(ref(as(ALICE)), { name: 'Otra' }));
  });
});
