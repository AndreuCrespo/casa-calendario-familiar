import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  anon,
  as,
  autoId,
  BOB,
  CAROL,
  CODE,
  DAY,
  EVE,
  event,
  HID,
  household,
  invite,
  LIMITS,
  members,
  OTHER_HID,
  seed,
  seedHousehold,
  setupRulesEnv,
  str,
} from './helpers';

setupRulesEnv();

const inviteRef = (db: ReturnType<typeof as>, code = CODE, hid = HID) => doc(db, 'households', hid, 'invites', code);
const householdRef = (db: ReturnType<typeof as>, hid = HID) => doc(db, 'households', hid);

describe('invites: creating and managing', () => {
  beforeEach(() => seedHousehold());

  it('members can create an invite', async () => {
    await assertSucceeds(setDoc(inviteRef(as(ALICE)), invite()));
  });

  it('an invite can last up to the configured number of days', async () => {
    const max = Date.now() + LIMITS.inviteDays * DAY;
    await assertSucceeds(setDoc(inviteRef(as(ALICE)), invite({ expiresAt: max })));
    await assertFails(setDoc(inviteRef(as(ALICE), autoId('Invite2')), invite({ expiresAt: max + 10 * 60_000 })));
  });

  it('rejects invites that are already expired', async () => {
    await assertFails(setDoc(inviteRef(as(ALICE)), invite({ expiresAt: Date.now() - 1000 })));
  });

  it('createdBy must be the author', async () => {
    await assertFails(setDoc(inviteRef(as(ALICE)), invite({ createdBy: BOB })));
  });

  it('validates the fields', async () => {
    const db = as(ALICE);
    await assertFails(setDoc(inviteRef(db), invite({ householdName: str(LIMITS.householdName + 1) })));
    await assertFails(setDoc(inviteRef(db), invite({ createdByName: str(LIMITS.memberName + 1) })));
    await assertFails(setDoc(inviteRef(db), invite({ createdAt: 'now' })));
    await assertFails(setDoc(inviteRef(db), invite({ expiresAt: String(Date.now() + DAY) })));
    await assertFails(setDoc(inviteRef(db), invite({ uses: 5 })));
    const { createdByName: _c, ...missing } = invite();
    await assertFails(setDoc(inviteRef(db), missing));
  });

  it('the code must be a Firestore auto id', async () => {
    await assertFails(setDoc(inviteRef(as(ALICE), 'abc'), invite()));
  });

  it('non-members cannot create invites', async () => {
    await assertFails(setDoc(inviteRef(as(EVE)), invite({ createdBy: EVE })));
    await assertFails(setDoc(inviteRef(anon()), invite()));
  });

  it('invites can never be edited', async () => {
    await seed(`households/${HID}/invites/${CODE}`, invite());
    await assertFails(updateDoc(inviteRef(as(ALICE)), { expiresAt: Date.now() + 3 * DAY }));
  });

  it('any signed-in user can read an invite by its code', async () => {
    await seed(`households/${HID}/invites/${CODE}`, invite());
    await assertSucceeds(getDoc(inviteRef(as(EVE))));
    await assertSucceeds(getDoc(inviteRef(as(EVE), autoId('Missing'))));
    await assertFails(getDoc(inviteRef(anon())));
  });

  it('only members can list or delete invites', async () => {
    await seed(`households/${HID}/invites/${CODE}`, invite());
    await assertSucceeds(getDocs(collection(as(BOB), 'households', HID, 'invites')));
    await assertFails(getDocs(collection(as(EVE), 'households', HID, 'invites')));
    await assertFails(deleteDoc(inviteRef(as(EVE))));
    await assertSucceeds(deleteDoc(inviteRef(as(BOB))));
  });
});

describe('joining a household', () => {
  const update = (uid: string, data: Record<string, unknown>) => updateDoc(householdRef(as(uid)), data);
  /** Exactly what the app writes to join. */
  const join = (uid: string, code = CODE) => update(uid, { memberUids: arrayUnion(uid), [`joinedWith.${uid}`]: code });

  beforeEach(async () => {
    await seedHousehold();
    await seed(`households/${HID}/invites/${CODE}`, invite());
  });

  it('a signed-in user with a valid invite can join', async () => {
    await assertSucceeds(join(CAROL));
    // ...and is a member from then on.
    await assertSucceeds(getDoc(householdRef(as(CAROL))));
    await seed(`households/${HID}/events/e1`, event());
    await assertSucceeds(getDoc(doc(as(CAROL), 'households', HID, 'events', 'e1')));
  });

  it('joining works for a household at the maximum size (rules expression budget)', async () => {
    const uids = Array.from({ length: LIMITS.members - 1 }, (_, i) => (i === 0 ? ALICE : `user${i}`));
    await seed(`households/${HID}`, household({ memberUids: uids, members: members(LIMITS.members) }));
    await assertSucceeds(join(CAROL));
    await assertFails(join(EVE));
  });

  it('a second person can join with the same invite', async () => {
    await assertSucceeds(join(CAROL));
    await assertSucceeds(join(EVE));
  });

  it('a removed member can join again with a valid invite', async () => {
    await assertSucceeds(join(CAROL));
    await assertSucceeds(update(ALICE, { memberUids: arrayRemove(CAROL) }));
    await assertSucceeds(join(CAROL));
  });

  it('the household id alone is not enough (old /?join=<hid> links)', async () => {
    await assertFails(update(CAROL, { memberUids: arrayUnion(CAROL) }));
  });

  it('the household id alone is not enough after someone joined with a valid invite', async () => {
    await assertSucceeds(join(CAROL));
    await assertFails(update(EVE, { memberUids: arrayUnion(EVE) }));
  });

  it("cannot reuse another joiner's entry", async () => {
    await assertSucceeds(join(CAROL));
    // Rewriting carol's entry (same value) instead of writing one's own.
    await assertFails(update(EVE, { memberUids: arrayUnion(EVE), [`joinedWith.${CAROL}`]: CODE }));
    // Replacing the whole map, which drops carol's entry.
    await assertFails(update(EVE, { memberUids: arrayUnion(EVE), joinedWith: { [EVE]: CODE } }));
  });

  it("cannot write someone else's entry", async () => {
    await assertFails(update(CAROL, { memberUids: arrayUnion(CAROL), [`joinedWith.${EVE}`]: CODE }));
    await assertFails(
      update(CAROL, {
        memberUids: arrayUnion(CAROL),
        [`joinedWith.${CAROL}`]: CODE,
        [`joinedWith.${EVE}`]: CODE,
      }),
    );
    await assertSucceeds(join(CAROL));
    await assertFails(
      update(EVE, {
        memberUids: arrayUnion(EVE),
        [`joinedWith.${EVE}`]: CODE,
        [`joinedWith.${CAROL}`]: autoId('Other'),
      }),
    );
  });

  it('rejects expired invites', async () => {
    await seed(`households/${HID}/invites/${CODE}`, invite({ expiresAt: Date.now() - 1000 }));
    await assertFails(join(CAROL));
  });

  it('rejects unknown codes', async () => {
    await assertFails(join(CAROL, autoId('Unknown')));
    await assertFails(join(CAROL, 'not-a-code'));
    await assertFails(update(CAROL, { memberUids: arrayUnion(CAROL), [`joinedWith.${CAROL}`]: 42 }));
  });

  it("rejects another household's invite", async () => {
    const otherCode = autoId('Otherinvite');
    await seed(`households/${OTHER_HID}`, household({ memberUids: [EVE] }));
    await seed(`households/${OTHER_HID}/invites/${otherCode}`, invite({ createdBy: EVE }));
    await assertFails(join(CAROL, otherCode));
  });

  it('a joiner can only add themselves', async () => {
    const entry = { [`joinedWith.${CAROL}`]: CODE };
    await assertFails(update(CAROL, { memberUids: arrayUnion(EVE), ...entry }));
    await assertFails(update(CAROL, { memberUids: arrayUnion(CAROL, EVE), ...entry }));
    await assertFails(update(CAROL, { memberUids: [CAROL], ...entry }));
    await assertFails(update(CAROL, { memberUids: [BOB, ALICE, CAROL], ...entry }));
  });

  it('joining cannot change anything else', async () => {
    const entry = { memberUids: arrayUnion(CAROL), [`joinedWith.${CAROL}`]: CODE };
    await assertFails(update(CAROL, { ...entry, name: 'Mine' }));
    await assertFails(update(CAROL, { ...entry, notify: { dailySummary: false, dailyHour: 8, activity: false } }));
  });

  it('the old { invite } join shape is rejected', async () => {
    await assertFails(update(CAROL, { memberUids: arrayUnion(CAROL), invite: CODE }));
  });

  it('signed-out users cannot join', async () => {
    await assertFails(updateDoc(householdRef(anon()), { memberUids: arrayUnion('nobody'), 'joinedWith.nobody': CODE }));
  });
});
