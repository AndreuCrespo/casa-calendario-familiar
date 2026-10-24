// Demo mode: the same Backend on top of localStorage, with no account.
import type { Household } from '../../shared/types';
import { KEYS, keysWithPrefix, readJSON, removeKey, writeJSON } from '../storage';
import type { Backend, CollectionName, Collections, DocData, IdRange, ListedCollection } from './types';

type Data = Record<string, unknown>;
const HOUSEHOLD = '_household';

const isMap = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(a: Data, b: Data): Data {
  const out: Data = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = isMap(v) && isMap(cur) ? deepMerge(cur, v) : v;
  }
  return out;
}

const inRange = (id: string, r?: IdRange) => (!r?.from || id >= r.from) && (!r?.to || id <= r.to);

export class LocalBackend implements Backend {
  readonly householdId = 'demo';
  private listeners = new Map<string, Set<() => void>>();

  // Other tabs with the demo open write to the same storage.
  private onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(KEYS.demoPrefix)) this.emit(e.key.slice(KEYS.demoPrefix.length));
  };

  private read(coll: string): Record<string, Data> {
    return readJSON<Record<string, Data>>(KEYS.demoPrefix + coll) ?? {};
  }

  private write(coll: string, map: Record<string, Data>) {
    writeJSON(KEYS.demoPrefix + coll, map);
    this.emit(coll);
  }

  private emit(coll: string) {
    for (const fn of this.listeners.get(coll) ?? []) fn();
  }

  private listen(coll: string, fn: () => void) {
    if (this.listeners.size === 0) window.addEventListener('storage', this.onStorage);
    let set = this.listeners.get(coll);
    if (!set) {
      set = new Set();
      this.listeners.set(coll, set);
    }
    set.add(fn);
    queueMicrotask(fn);
    return () => {
      set.delete(fn);
      if (set.size === 0) this.listeners.delete(coll);
      if (this.listeners.size === 0) window.removeEventListener('storage', this.onStorage);
    };
  }

  watch<K extends ListedCollection>(
    coll: K,
    cb: (items: Collections[K][]) => void,
    _onError: (e: Error) => void,
    range?: IdRange,
  ) {
    return this.listen(coll, () => {
      const items = Object.entries(this.read(coll))
        .filter(([id]) => inRange(id, range))
        .map(([id, d]) => ({ ...d, id }) as Collections[K]);
      cb(items);
    });
  }

  watchDoc<K extends CollectionName>(
    coll: K,
    id: string,
    cb: (doc: Collections[K] | null) => void,
    _onError: (e: Error) => void,
  ) {
    return this.listen(coll, () => {
      const d = this.read(coll)[id];
      cb(d ? ({ ...d, id } as Collections[K]) : null);
    });
  }

  watchHousehold(cb: (h: Household | null) => void, _onError: (e: Error) => void) {
    return this.listen(HOUSEHOLD, () => {
      const h = this.read(HOUSEHOLD)[this.householdId];
      cb(h ? ({ ...h, id: this.householdId } as Household) : null);
    });
  }

  async updateHousehold(data: Partial<Omit<Household, 'id'>>) {
    const map = this.read(HOUSEHOLD);
    map[this.householdId] = { ...map[this.householdId], ...data };
    this.write(HOUSEHOLD, map);
  }

  newId() {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }

  add<K extends CollectionName>(coll: K, data: DocData<K>) {
    const id = this.newId();
    const map = this.read(coll);
    map[id] = data as Data;
    this.write(coll, map);
    return id;
  }

  async set<K extends CollectionName>(coll: K, id: string, data: DocData<K>) {
    const map = this.read(coll);
    map[id] = data as Data;
    this.write(coll, map);
  }

  async merge<K extends CollectionName>(coll: K, id: string, data: Partial<DocData<K>>) {
    const map = this.read(coll);
    map[id] = deepMerge(map[id] ?? {}, data as Data);
    this.write(coll, map);
  }

  async update<K extends CollectionName>(coll: K, id: string, data: Partial<DocData<K>>) {
    const map = this.read(coll);
    const cur = map[id];
    if (!cur) return;
    map[id] = { ...cur, ...(data as Data) };
    this.write(coll, map);
  }

  async remove(coll: CollectionName, id: string) {
    const map = this.read(coll);
    delete map[id];
    this.write(coll, map);
  }

  static hasData() {
    return readJSON(KEYS.demoPrefix + HOUSEHOLD) !== null;
  }

  static reset() {
    for (const k of keysWithPrefix(KEYS.demoPrefix)) removeKey(k);
  }
}
