// Signing out leaves nothing of the household on the device: notifications off,
// Firestore's offline copy deleted and the app's own keys cleared.
import { signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import type { FirebaseServices } from './firebase';
import { KEYS, keysWithPrefix, removeKey } from './storage';

/** Device preferences that aren't tied to the account. */
const KEEP: readonly string[] = [KEYS.lang, KEYS.theme, KEYS.calendarView];

const atMost = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.catch(() => {}), new Promise((resolve) => setTimeout(resolve, ms))]);

export async function signOutAndClear({ auth, db }: FirebaseServices, beforeSignOut?: () => Promise<void>) {
  // Still signed in, so the device document can be deleted (if it's quick: offline it would wait forever).
  if (beforeSignOut) await atMost(beforeSignOut(), 4000);
  await signOut(auth);
  await terminate(db);
  await clearIndexedDbPersistence(db).catch((e: unknown) => console.warn('Could not clear the offline data', e));
  for (const k of keysWithPrefix('casa-')) if (!KEEP.includes(k)) removeKey(k);
  for (const k of keysWithPrefix('firestore_')) removeKey(k); // the offline cache's bookkeeping
  // Firestore can't be used after terminate(): start fresh.
  location.reload();
}
