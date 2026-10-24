// What every screen of a household needs: its data access, the household,
// who is signed in, and hooks to read live data.
import { createContext, type ReactNode, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ActivityKind, Household, Member } from '../shared/types';
import type { Backend, Collections, IdRange, ListedCollection } from './backend/types';
import { useTimeIn, useTodayIn } from './clock';
import type { LiveStore } from './store';

export interface AppUser {
  uid: string;
  name: string;
  email: string | null;
}

export interface AppState {
  backend: Backend;
  store: LiveStore;
  household: Household;
  user: AppUser;
  /** The member linked to the signed-in account. */
  me: Member | undefined;
  members: Member[];
  membersById: ReadonlyMap<string, Member>;
  adults: Member[];
  tz: string;
  demo: boolean;
  /** Records an action for the other members' notifications ("Sam added milk"). */
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

/** Live documents of a collection (undefined while loading). */
export function useCollection<K extends ListedCollection>(coll: K, range?: IdRange): Collections[K][] | undefined {
  const { store } = useApp();
  const from = range?.from;
  const to = range?.to;
  const entry = useMemo(() => store.collection(coll, from || to ? { from, to } : undefined), [store, coll, from, to]);
  const subscribe = useCallback((fn: () => void) => store.subscribe(entry, fn), [store, entry]);
  return useSyncExternalStore(subscribe, () => entry.value as Collections[K][] | undefined);
}

/** One live document: undefined while loading, null if it doesn't exist. */
export function useDoc<K extends keyof Collections>(coll: K, id: string): Collections[K] | null | undefined {
  const { store } = useApp();
  const entry = useMemo(() => store.doc(coll, id), [store, coll, id]);
  const subscribe = useCallback((fn: () => void) => store.subscribe(entry, fn), [store, entry]);
  return useSyncExternalStore(subscribe, () => entry.value as Collections[K] | null | undefined);
}

/** Whether some data can't be loaded right now. */
export function useDataFailing() {
  const { store } = useApp();
  return useSyncExternalStore(store.subscribeHealth, () => store.failing);
}

/** Today in the household's time zone. */
export const useToday = () => useTodayIn(useApp().tz);

/** Current local time ('HH:mm') in the household's time zone. */
export const useTime = () => useTimeIn(useApp().tz);
