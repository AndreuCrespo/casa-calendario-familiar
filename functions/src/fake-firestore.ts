// In-memory Firestore with just what run.ts uses, for tests without the emulator.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = Record<string, any>;
type Op = '==' | '>=' | '<=' | '<' | '>' | 'in';

const getPath = (d: Data, path: string) => path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), d);

class DocSnap {
  constructor(readonly ref: DocRef, private readonly d: Data | undefined) {}
  get id() { return this.ref.id; }
  get exists() { return this.d !== undefined; }
  data() { return this.d === undefined ? undefined : structuredClone(this.d); }
  get(field: string) { return this.d === undefined ? undefined : getPath(this.d, field); }
}

class DocRef {
  constructor(readonly db: FakeFirestore, readonly path: string) {}
  get id() { return this.path.split('/').pop()!; }
  collection(name: string) { return new CollRef(this.db, `${this.path}/${name}`); }
  async get() { return new DocSnap(this, this.db.store.get(this.path)); }
  async set(data: Data, opts?: { merge?: boolean }) { this.db.write(this.path, data, opts?.merge); }
  async update(data: Data) {
    if (!this.db.store.has(this.path)) throw Object.assign(new Error('NOT_FOUND'), { code: 5 });
    this.db.write(this.path, data, true);
  }
  async delete() { this.db.store.delete(this.path); }
}

class QueryImpl {
  constructor(readonly db: FakeFirestore, readonly path: string, readonly filters: [string, Op, any][] = []) {}
  where(field: string, op: Op, value: any) { return new QueryImpl(this.db, this.path, [...this.filters, [field, op, value]]); }
  select() { return this; }
  async get() {
    const prefix = `${this.path}/`;
    const docs = [...this.db.store.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .filter(([, d]) => this.filters.every(([f, op, v]) => {
        const x = getPath(d, f);
        switch (op) {
          case '==': return x === v;
          case '>=': return x != null && x >= v;
          case '<=': return x != null && x <= v;
          case '<': return x != null && x < v;
          case '>': return x != null && x > v;
          case 'in': return (v as any[]).includes(x);
        }
      }))
      .map(([p, d]) => new DocSnap(new DocRef(this.db, p), d));
    return { docs, size: docs.length, empty: !docs.length };
  }
}

class CollRef extends QueryImpl {
  doc(id: string) { return new DocRef(this.db, `${this.path}/${id}`); }
}

export class FakeFirestore {
  readonly store = new Map<string, Data>();
  write(path: string, data: Data, merge?: boolean) {
    const cur = merge ? this.store.get(path) ?? {} : {};
    this.store.set(path, { ...cur, ...structuredClone(data) });
  }
  collection(name: string) { return new CollRef(this, name); }
  doc(path: string) { return new DocRef(this, path); }
  async getAll(...refs: DocRef[]) { return Promise.all(refs.map((r) => r.get())); }
  batch() {
    const ops: (() => Promise<void>)[] = [];
    return {
      update: (r: DocRef, d: Data) => { ops.push(() => r.update(d)); },
      set: (r: DocRef, d: Data, o?: { merge?: boolean }) => { ops.push(() => r.set(d, o)); },
      delete: (r: DocRef) => { ops.push(() => r.delete()); },
      commit: async () => { for (const op of ops) await op(); },
    };
  }
  bulkWriter() {
    const b = this.batch();
    return { ...b, close: b.commit };
  }
  /** To insert data: seed('households/h1/events/e1', {...}) */
  seed(path: string, data: Data) { this.store.set(path, structuredClone(data)); }
  get(path: string) { return this.store.get(path); }
}
