// Live data shared by every screen: one subscription per collection (or
// document), kept open while something shows it and a few minutes after, so
// switching tabs is instant without listening to everything forever.

import type { Backend, CollectionName, IdRange, ListedCollection, Unsubscribe } from './backend/types';
import { reportError } from './errors';

/** How long a subscription stays open after its last screen is gone. */
const IDLE_MS = 5 * 60_000;
/** Failures in a row before telling the user (earlier ones are often transient). */
const REPORT_AFTER = 3;

type Open = (onData: (value: unknown) => void, onError: (e: Error) => void) => Unsubscribe;

export interface LiveEntry {
  readonly key: string;
  /** undefined until the first snapshot arrives. */
  value: unknown;
  failing: boolean;
}

interface Entry extends LiveEntry {
  open: Open;
  subs: Set<() => void>;
  close?: Unsubscribe;
  failures: number;
  retry?: ReturnType<typeof setTimeout>;
  idle?: ReturnType<typeof setTimeout>;
}

export class LiveStore {
  private entries = new Map<string, Entry>();
  private healthSubs = new Set<() => void>();
  private stopped = false;

  constructor(private readonly backend: Backend) {}

  collection(coll: ListedCollection, range?: IdRange): LiveEntry {
    const key = range ? `${coll}|${range.from ?? ''}|${range.to ?? ''}` : coll;
    return this.entry(key, (ok, fail) => this.backend.watch(coll, ok, fail, range));
  }

  doc(coll: CollectionName, id: string): LiveEntry {
    return this.entry(`${coll}/${id}`, (ok, fail) => this.backend.watchDoc(coll, id, ok, fail));
  }

  private entry(key: string, open: Open): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = { key, value: undefined, failing: false, open, subs: new Set(), failures: 0 };
      this.entries.set(key, e);
    }
    return e;
  }

  subscribe(live: LiveEntry, fn: () => void): Unsubscribe {
    const e = this.entries.get(live.key);
    if (!e) return () => {};
    clearTimeout(e.idle);
    e.idle = undefined;
    e.subs.add(fn);
    if (!e.close && !e.retry) this.start(e);
    return () => {
      e.subs.delete(fn);
      if (e.subs.size === 0) e.idle = setTimeout(() => this.close(e), IDLE_MS);
    };
  }

  private start(e: Entry) {
    if (this.stopped) return;
    e.close = e.open(
      (value) => {
        const wasFailing = e.failing;
        e.failures = 0;
        e.failing = false;
        e.value = value;
        this.notify(e, wasFailing);
      },
      (err) => {
        // A failed listener is already closed: retry with growing delays (e.g.
        // permissions the server hasn't applied yet) and report it if it persists.
        e.close = undefined;
        e.failures++;
        if (e.failures === REPORT_AFTER) {
          e.failing = true;
          reportError(err);
          this.notify(e, true);
        }
        e.retry = setTimeout(
          () => {
            e.retry = undefined;
            if (e.subs.size) this.start(e);
          },
          Math.min(30_000, 1000 * 2 ** (e.failures - 1)),
        );
      },
    );
  }

  private close(e: Entry) {
    e.close?.();
    e.close = undefined;
    clearTimeout(e.retry);
    e.retry = undefined;
  }

  private notify(e: Entry, healthChanged: boolean) {
    for (const fn of e.subs) fn();
    if (healthChanged) for (const fn of this.healthSubs) fn();
  }

  /** Whether some data can't be loaded right now (it keeps retrying). */
  get failing() {
    for (const e of this.entries.values()) if (e.failing && e.subs.size) return true;
    return false;
  }

  subscribeHealth = (fn: () => void): Unsubscribe => {
    this.healthSubs.add(fn);
    return () => {
      this.healthSubs.delete(fn);
    };
  };

  /** Closes every subscription (sign-out, switching household or language). */
  stop() {
    this.stopped = true;
    for (const e of this.entries.values()) {
      clearTimeout(e.idle);
      this.close(e);
    }
  }

  /** Reopens what's still shown after stop() (React may remount in development). */
  resume() {
    if (!this.stopped) return;
    this.stopped = false;
    for (const e of this.entries.values()) if (e.subs.size && !e.close && !e.retry) this.start(e);
  }
}
