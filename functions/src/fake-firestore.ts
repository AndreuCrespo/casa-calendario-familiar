// In-memory Firestore with just what the notifier uses, for tests without the
// emulator. Like the real one: range filters only match values of the same
// type, documents carry a server createTime, and a failed BulkWriter operation
// rejects its own promise (an unhandled rejection if nobody catches it).
type Data = Record<string, unknown>;
type Op = '==' | '<' | '<=' | '>' | '>=' | 'in';

interface Stored {
  data: Data;
  createTime: number;
}

class Timestamp {
  constructor(private readonly ms: number) {}
  toMillis() {
    return this.ms;
  }
}

const getPath = (d: Data, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (typeof o === 'object' && o !== null ? (o as Data)[k] : undefined), d);

function compare(x: unknown, v: unknown): number | null {
  if (typeof x === 'number' && typeof v === 'number') return x - v;
  if (typeof x === 'string' && typeof v === 'string') return x < v ? -1 : x > v ? 1 : 0;
  return null;
}

function matches(x: unknown, op: Op, v: unknown): boolean {
  if (op === '==') return x === v;
  if (op === 'in') return Array.isArray(v) && v.includes(x);
  const c = compare(x, v);
  if (c === null) return false;
  return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
}

class DocSnap {
  constructor(
    readonly ref: DocRef,
    private readonly stored: Stored | undefined,
  ) {}
  get id() {
    return this.ref.id;
  }
  get exists() {
    return this.stored !== undefined;
  }
  get createTime() {
    return this.stored ? new Timestamp(this.stored.createTime) : undefined;
  }
  data() {
    return this.stored ? structuredClone(this.stored.data) : undefined;
  }
  get(field: string) {
    return this.stored ? getPath(this.stored.data, field) : undefined;
  }
}

class DocRef {
  constructor(
    readonly db: FakeFirestore,
    readonly path: string,
  ) {}
  get id() {
    return this.path.slice(this.path.lastIndexOf('/') + 1);
  }
  get parent() {
    return new CollRef(this.db, this.path.slice(0, this.path.lastIndexOf('/')));
  }
  collection(name: string) {
    return new CollRef(this.db, `${this.path}/${name}`);
  }
  async get() {
    this.db.touch(this.path, 1);
    return new DocSnap(this, this.db.store.get(this.path));
  }
  async set(data: Data, opts?: { merge?: boolean }) {
    this.db.write(this.path, data, opts?.merge);
  }
  async update(data: Data) {
    if (!this.db.store.has(this.path))
      throw Object.assign(new Error(`No document to update: ${this.path}`), { code: 5 });
    this.db.write(this.path, data, true);
  }
  async delete() {
    this.db.store.delete(this.path);
  }
}

class QueryImpl {
  constructor(
    readonly db: FakeFirestore,
    readonly path: string,
    readonly filters: [string, Op, unknown][] = [],
    readonly max = Number.POSITIVE_INFINITY,
  ) {}
  where(field: string, op: Op, value: unknown) {
    return new QueryImpl(this.db, this.path, [...this.filters, [field, op, value]], this.max);
  }
  limit(n: number) {
    return new QueryImpl(this.db, this.path, this.filters, n);
  }
  select(..._fields: string[]) {
    return this;
  }
  async get() {
    const prefix = `${this.path}/`;
    const docs = [...this.db.store.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .filter(([, s]) => this.filters.every(([f, op, v]) => matches(getPath(s.data, f), op, v)))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, this.max)
      .map(([p, s]) => new DocSnap(new DocRef(this.db, p), s));
    this.db.touch(this.path, Math.max(1, docs.length));
    return { docs, size: docs.length, empty: !docs.length };
  }
}

class CollRef extends QueryImpl {
  get id() {
    return this.path.slice(this.path.lastIndexOf('/') + 1);
  }
  doc(id: string) {
    return new DocRef(this.db, `${this.path}/${id}`);
  }
}

interface WriteError extends Error {
  code?: number;
  failedAttempts: number;
}

export class FakeFirestore {
  readonly store = new Map<string, Stored>();
  /** Documents read (a query that returns nothing counts as one, as in Firestore), by collection path. */
  readonly reads = new Map<string, number>();
  private failing: string[] = [];

  /** Reads of paths starting with `prefix` will throw (to test error handling). */
  failReadsUnder(prefix: string) {
    this.failing.push(prefix);
  }
  touch(path: string, n: number) {
    if (this.failing.some((p) => path.startsWith(p))) throw new Error(`Read failed: ${path}`);
    const col = path.split('/').length % 2 ? path : path.slice(0, path.lastIndexOf('/'));
    this.reads.set(col, (this.reads.get(col) ?? 0) + n);
  }
  /** Total reads under a path prefix (e.g. 'households/h1/dates'). */
  readsUnder(prefix: string) {
    let n = 0;
    for (const [p, c] of this.reads) if (p.startsWith(prefix)) n += c;
    return n;
  }
  write(path: string, data: Data, merge?: boolean) {
    const cur = this.store.get(path);
    const base = merge && cur ? cur.data : {};
    this.store.set(path, { data: { ...base, ...structuredClone(data) }, createTime: cur?.createTime ?? Date.now() });
  }
  collection(name: string) {
    return new CollRef(this, name);
  }
  doc(path: string) {
    return new DocRef(this, path);
  }
  async getAll(...refs: DocRef[]) {
    return Promise.all(refs.map((r) => r.get()));
  }
  batch() {
    const ops: (() => Promise<void>)[] = [];
    return {
      update: (r: DocRef, d: Data) => void ops.push(() => r.update(d)),
      set: (r: DocRef, d: Data, o?: { merge?: boolean }) => void ops.push(() => r.set(d, o)),
      delete: (r: DocRef) => void ops.push(() => r.delete()),
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }
  bulkWriter() {
    const ops: (() => Promise<void>)[] = [];
    let onError: ((e: WriteError) => boolean) | null = null;
    const enqueue = (run: () => Promise<void>) =>
      new Promise<void>((resolve, reject) => {
        ops.push(async () => {
          try {
            await run();
            resolve();
          } catch (e) {
            const err = Object.assign(e as Error, { failedAttempts: 1 }) as WriteError;
            onError?.(err); // no retries here
            reject(err);
          }
        });
      });
    return {
      set: (r: DocRef, d: Data, o?: { merge?: boolean }) => enqueue(() => r.set(d, o)),
      update: (r: DocRef, d: Data) => enqueue(() => r.update(d)),
      delete: (r: DocRef) => enqueue(() => r.delete()),
      onWriteError: (fn: (e: WriteError) => boolean) => {
        onError = fn;
      },
      close: async () => {
        for (const op of ops) await op();
        await new Promise((r) => setImmediate(r)); // let rejection handlers run, as the real one does
      },
    };
  }
  /** To insert data: seed('households/h1/events/e1', {...}). createTime defaults to `createdAt` or now. */
  seed(path: string, data: Data, createTime?: number) {
    const ct = createTime ?? (typeof data.createdAt === 'number' ? data.createdAt : Date.now());
    this.store.set(path, { data: structuredClone(data), createTime: ct });
  }
  get(path: string): Data | undefined {
    return this.store.get(path)?.data;
  }
}
