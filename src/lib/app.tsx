import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Backend } from './backend';
import type { ActivityKind, Household, Member } from '../shared/types';
import { todayIn } from '../shared/dates';

export interface AppUser {
  uid: string;
  name: string;
  email: string | null;
}

/** Keeps one live subscription per collection so switching tabs is instant. */
export class CollectionCache {
  private data = new Map<string, unknown[]>();
  private subs = new Map<string, Set<() => void>>();
  private started = new Set<string>();
  private failures = new Map<string, number>();

  constructor(private backend: Backend) {}

  subscribe = (coll: string, fn: () => void) => {
    if (!this.subs.has(coll)) this.subs.set(coll, new Set());
    this.subs.get(coll)!.add(fn);
    if (!this.started.has(coll)) this.start(coll);
    return () => { this.subs.get(coll)?.delete(fn); };
  };

  private start(coll: string) {
    this.started.add(coll);
    this.backend.watch(
      coll,
      (items) => {
        this.failures.delete(coll);
        this.data.set(coll, items);
        this.subs.get(coll)?.forEach((f) => f());
      },
      (e) => {
        // A failed subscription is closed: retry with growing delays (e.g. permissions
        // the server hasn't applied yet) and only tell the user if it keeps failing.
        this.started.delete(coll);
        const n = (this.failures.get(coll) ?? 0) + 1;
        this.failures.set(coll, n);
        if (n === 3) window.dispatchEvent(new CustomEvent('casa:error', { detail: e.message }));
        setTimeout(() => { if (!this.started.has(coll)) this.start(coll); }, Math.min(30_000, 1000 * 2 ** (n - 1)));
      },
    );
  }

  get = (coll: string) => this.data.get(coll);
}

export interface AppState {
  backend: Backend;
  cache: CollectionCache;
  household: Household;
  user: AppUser;
  me: Member | undefined;
  members: Member[];
  adults: Member[];
  tz: string;
  demo: boolean;
  log: (kind: ActivityKind, text: string) => void;
  signOut: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ value, children }: { value: AppState; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp used outside AppProvider');
  return v;
}

export function useCollection<T>(coll: string): T[] | undefined {
  const { cache } = useApp();
  return useSyncExternalStore(
    (fn) => cache.subscribe(coll, fn),
    () => cache.get(coll) as T[] | undefined,
  );
}

export function useMember(id: string | null | undefined) {
  const { members } = useApp();
  return members.find((m) => m.id === id);
}

/** Current time, refreshed every `ms`. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    const vis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ms]);
  return now;
}

export function useToday() {
  const { tz } = useApp();
  const now = useNow(60_000);
  return todayIn(tz, now);
}
