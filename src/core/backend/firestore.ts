import {
  collection,
  deleteDoc,
  doc,
  documentId,
  type Firestore,
  onSnapshot,
  type Query,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Household } from '../../shared/types';
import { reportError } from '../errors';
import type { Backend, CollectionName, Collections, DocData, IdRange, ListedCollection } from './types';

/** Reports a failed write and still lets the caller await (and catch) it. */
export function reported(p: Promise<void>): Promise<void> {
  const out = p.catch((e: unknown) => {
    reportError(e);
    throw e;
  });
  out.catch(() => {}); // callers that don't await don't need to handle it
  return out;
}

export class FirestoreBackend implements Backend {
  constructor(
    private readonly db: Firestore,
    readonly householdId: string,
  ) {}

  private col(coll: string) {
    return collection(this.db, 'households', this.householdId, coll);
  }

  private ref(coll: CollectionName, id: string) {
    return doc(this.col(coll), id);
  }

  watch<K extends ListedCollection>(
    coll: K,
    cb: (items: Collections[K][]) => void,
    onError: (e: Error) => void,
    range?: IdRange,
  ) {
    let q: Query = this.col(coll);
    if (range?.from) q = query(q, where(documentId(), '>=', range.from));
    if (range?.to) q = query(q, where(documentId(), '<=', range.to));
    let prev = new Map<string, Collections[K]>();
    return onSnapshot(
      q,
      (snap) => {
        // Unchanged documents keep their object, so memoized rows don't re-render.
        const changed = new Set(snap.docChanges().map((c) => c.doc.id));
        const next = new Map<string, Collections[K]>();
        const items = snap.docs.map((d) => {
          const old = prev.get(d.id);
          const item = old && !changed.has(d.id) ? old : ({ ...d.data(), id: d.id } as Collections[K]);
          next.set(d.id, item);
          return item;
        });
        prev = next;
        cb(items);
      },
      onError,
    );
  }

  watchDoc<K extends CollectionName>(
    coll: K,
    id: string,
    cb: (doc: Collections[K] | null) => void,
    onError: (e: Error) => void,
  ) {
    return onSnapshot(
      this.ref(coll, id),
      (d) => cb(d.exists() ? ({ ...d.data(), id: d.id } as Collections[K]) : null),
      onError,
    );
  }

  watchHousehold(cb: (h: Household | null) => void, onError: (e: Error) => void) {
    return onSnapshot(
      doc(this.db, 'households', this.householdId),
      (d) => cb(d.exists() ? ({ ...d.data(), id: d.id } as Household) : null),
      onError,
    );
  }

  updateHousehold(data: Partial<Omit<Household, 'id'>>) {
    return reported(updateDoc(doc(this.db, 'households', this.householdId), data));
  }

  newId() {
    return doc(this.col('_')).id;
  }

  add<K extends CollectionName>(coll: K, data: DocData<K>, opts?: { quiet?: boolean }) {
    const ref = doc(this.col(coll));
    const write = setDoc(ref, data);
    if (opts?.quiet) write.catch((e: unknown) => console.warn(`add ${coll}:`, e));
    else reported(write);
    return ref.id;
  }

  set<K extends CollectionName>(coll: K, id: string, data: DocData<K>) {
    return reported(setDoc(this.ref(coll, id), data));
  }

  merge<K extends CollectionName>(coll: K, id: string, data: Partial<DocData<K>>) {
    return reported(setDoc(this.ref(coll, id), data, { merge: true }));
  }

  update<K extends CollectionName>(coll: K, id: string, data: Partial<DocData<K>>) {
    return reported(updateDoc(this.ref(coll, id), data));
  }

  remove(coll: CollectionName, id: string) {
    return reported(deleteDoc(this.ref(coll, id)));
  }
}
