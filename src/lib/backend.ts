// Acceso a datos de una casa. Dos implementaciones con la misma interfaz:
// Firestore (real, sincronizado) y localStorage (modo demo).
import {
  collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, type Firestore,
} from 'firebase/firestore';
import type { Household } from '../shared/types';

type Data = Record<string, unknown>;
type Listener<T> = (v: T) => void;

export interface Backend {
  readonly householdId: string;
  watch<T>(coll: string, cb: Listener<T[]>, onError?: (e: Error) => void): () => void;
  watchHousehold(cb: Listener<Household | null>): () => void;
  updateHousehold(data: Partial<Household>): Promise<void>;
  newId(): string;
  /** Crea un documento y devuelve su id (la escritura sigue en segundo plano). */
  add(coll: string, data: Data): string;
  set(coll: string, id: string, data: Data, merge?: boolean): Promise<void>;
  update(coll: string, id: string, data: Data): Promise<void>;
  remove(coll: string, id: string): Promise<void>;
}

function report(e: unknown) {
  console.error(e);
  window.dispatchEvent(new CustomEvent('casa:error', { detail: String((e as Error)?.message ?? e) }));
}

function stripId(data: Data): Data {
  const { id: _id, ...rest } = data;
  return rest;
}

export class FirestoreBackend implements Backend {
  constructor(private db: Firestore, readonly householdId: string) {}

  private col(coll: string) {
    return collection(this.db, 'households', this.householdId, coll);
  }

  watch<T>(coll: string, cb: Listener<T[]>, onError?: (e: Error) => void) {
    return onSnapshot(
      this.col(coll),
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T)),
      (e) => { report(e); onError?.(e); },
    );
  }

  watchHousehold(cb: Listener<Household | null>) {
    return onSnapshot(
      doc(this.db, 'households', this.householdId),
      (d) => cb(d.exists() ? ({ ...d.data(), id: d.id } as Household) : null),
      report,
    );
  }

  updateHousehold(data: Partial<Household>) {
    return updateDoc(doc(this.db, 'households', this.householdId), stripId(data)).catch(report);
  }

  newId() {
    return doc(this.col('_')).id;
  }

  add(coll: string, data: Data) {
    const ref = doc(this.col(coll));
    setDoc(ref, stripId(data)).catch(report);
    return ref.id;
  }

  set(coll: string, id: string, data: Data, merge = false) {
    return setDoc(doc(this.col(coll), id), stripId(data), { merge }).catch(report);
  }

  update(coll: string, id: string, data: Data) {
    return updateDoc(doc(this.col(coll), id), stripId(data)).catch(report);
  }

  remove(coll: string, id: string) {
    return deleteDoc(doc(this.col(coll), id)).catch(report);
  }
}

// ---------------- modo demo ----------------

const PREFIX = 'casa-demo:';

function deepMerge(a: Data, b: Data): Data {
  const out: Data = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)
      ? deepMerge(cur as Data, v as Data)
      : v;
  }
  return out;
}

export class LocalBackend implements Backend {
  readonly householdId = 'demo';
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith(PREFIX)) this.emit(e.key.slice(PREFIX.length));
    });
  }

  private read(coll: string): Record<string, Data> {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + coll) || '{}');
    } catch {
      return {};
    }
  }

  private write(coll: string, map: Record<string, Data>) {
    localStorage.setItem(PREFIX + coll, JSON.stringify(map));
    this.emit(coll);
  }

  private emit(coll: string) {
    this.listeners.get(coll)?.forEach((fn) => fn());
  }

  private listen(coll: string, fn: () => void) {
    if (!this.listeners.has(coll)) this.listeners.set(coll, new Set());
    this.listeners.get(coll)!.add(fn);
    queueMicrotask(fn);
    return () => { this.listeners.get(coll)?.delete(fn); };
  }

  watch<T>(coll: string, cb: Listener<T[]>) {
    return this.listen(coll, () => {
      cb(Object.entries(this.read(coll)).map(([id, d]) => ({ ...d, id }) as T));
    });
  }

  watchHousehold(cb: Listener<Household | null>) {
    return this.listen('_household', () => {
      const h = this.read('_household').demo;
      cb(h ? ({ ...h, id: 'demo' } as unknown as Household) : null);
    });
  }

  async updateHousehold(data: Partial<Household>) {
    const map = this.read('_household');
    map.demo = { ...(map.demo ?? {}), ...stripId(data as Data) };
    this.write('_household', map);
  }

  newId() {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }

  add(coll: string, data: Data) {
    const id = this.newId();
    const map = this.read(coll);
    map[id] = stripId(data);
    this.write(coll, map);
    return id;
  }

  async set(coll: string, id: string, data: Data, merge = false) {
    const map = this.read(coll);
    map[id] = merge ? deepMerge(map[id] ?? {}, stripId(data)) : stripId(data);
    this.write(coll, map);
  }

  async update(coll: string, id: string, data: Data) {
    const map = this.read(coll);
    if (!map[id]) return;
    map[id] = { ...map[id], ...stripId(data) };
    this.write(coll, map);
  }

  async remove(coll: string, id: string) {
    const map = this.read(coll);
    delete map[id];
    this.write(coll, map);
  }

  static hasData() {
    return localStorage.getItem(PREFIX + '_household') !== null;
  }

  static reset() {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  }
}
