// Household operations that happen before being inside one: finding yours,
// creating one, and joining one with an invite.
import {
  arrayUnion,
  collection,
  doc,
  type Firestore,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { LIMITS } from '../shared/limits';
import type { Household, Invite } from '../shared/types';
import { KEYS, readJSON, removeKey, writeJSON } from './storage';

/** Firestore auto ids: household ids and invite codes. */
export const AUTO_ID = /^[A-Za-z0-9]{20}$/;

export const INVITE_TTL_MS = LIMITS.inviteDays * 86_400_000;

/** An invite link opened on this device: /?join=<household>&code=<invite>. */
export interface PendingInvite {
  hid: string;
  /** null for links from before invites expired (they only had the household id). */
  code: string | null;
}

/** Remembers an invite link from the URL (it's used after signing in) and cleans the URL. */
export function captureInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  const hid = params.get('join');
  if (hid === null) return;
  const code = params.get('code');
  if (AUTO_ID.test(hid)) {
    writeJSON(KEYS.invite, { hid, code: code && AUTO_ID.test(code) ? code : null } satisfies PendingInvite);
  }
  history.replaceState(null, '', location.pathname + location.hash);
}

export function readPendingInvite(): PendingInvite | null {
  const v = readJSON<PendingInvite>(KEYS.invite);
  return v && AUTO_ID.test(v.hid) && (v.code === null || AUTO_ID.test(v.code)) ? v : null;
}

export const clearPendingInvite = () => removeKey(KEYS.invite);

export function inviteLink(hid: string, code: string) {
  return `${location.origin}/?join=${hid}&code=${code}`;
}

/** Ids of the households the user belongs to, as confirmed by the server. */
export function watchMyHouseholds(
  db: Firestore,
  uid: string,
  cb: (ids: string[]) => void,
  onError: (e: Error) => void,
) {
  const q = query(collection(db, 'households'), where('memberUids', 'array-contains', uid));
  // Right after creating or joining a household, Firestore shows it locally
  // before saving it. Entering then would fail (the rules don't see us as a
  // member yet), so only server-confirmed households count.
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.docs.length && snap.docs.every((d) => d.metadata.hasPendingWrites)) return;
      cb(snap.docs.filter((d) => !d.metadata.hasPendingWrites).map((d) => d.id));
    },
    onError,
  );
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz.length <= 64;
  } catch {
    return false;
  }
}

export function deviceTimezone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz && isValidTimezone(tz) ? tz : 'Europe/Madrid';
}

export async function createHousehold(db: Firestore, data: Omit<Household, 'id'>) {
  const ref = doc(collection(db, 'households'));
  await setDoc(ref, data);
  return ref.id;
}

/** The invite, or null if it doesn't exist or has expired. */
export async function getInvite(db: Firestore, hid: string, code: string): Promise<Invite | null> {
  try {
    const d = await getDoc(doc(db, 'households', hid, 'invites', code));
    if (!d.exists()) return null;
    const invite = { ...d.data(), id: d.id } as Invite;
    return invite.expiresAt > Date.now() ? invite : null;
  } catch {
    return null;
  }
}

/**
 * Adds the user to the household. Each joiner records the code they used under
 * their own uid, so the rules can check that this join has a valid invite.
 */
export function joinHousehold(db: Firestore, hid: string, code: string, uid: string) {
  return updateDoc(doc(db, 'households', hid), { memberUids: arrayUnion(uid), [`joinedWith.${uid}`]: code });
}
