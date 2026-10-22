import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Backend } from './backend';
import type { ActivityKind, Household, Member } from '../shared/types';
import { todayIn } from '../shared/dates';

export interface AppUser {
  uid: string;
  name: string;
  email: string | null;
}

/** Mantiene vivas las suscripciones a cada colección para cambiar de pestaña sin esperas. */
export class CollectionCache {
  private data = new Map<string, unknown[]>();
  private subs = new Map<string, Set<() => void>>();
  private started = new Set<string>();

  constructor(private backend: Backend) {}

  subscribe = (coll: string, fn: () => void) => {
    if (!this.subs.has(coll)) this.subs.set(coll, new Set());
    this.subs.get(coll)!.add(fn);
    if (!this.started.has(coll)) {
      this.started.add(coll);
      this.backend.watch(coll, (items) => {
        this.data.set(coll, items);
        this.subs.get(coll)?.forEach((f) => f());
      });
    }
    return () => { this.subs.get(coll)?.delete(fn); };
  };

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
  if (!v) throw new Error('useApp fuera de AppProvider');
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

/** Hora actual, refrescada cada `ms`. */
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
