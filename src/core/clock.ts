// One shared clock for the whole app. It ticks on minute boundaries (and when
// the app becomes visible again) and components select only what they show, so
// each one re-renders only when its own value changes.
import { useSyncExternalStore } from 'react';
import { todayIn, zonedParts } from '../shared/dates';

let now = Date.now();
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  for (const fn of listeners) fn();
  schedule();
}

function schedule() {
  clearTimeout(timer);
  // A few ms past the boundary so the new minute is already showing.
  timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 20);
}

function onVisibility() {
  if (document.visibilityState === 'visible') tick();
}

function subscribe(fn: () => void) {
  if (listeners.size === 0) {
    now = Date.now();
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

/** Current time, updated every minute. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now);
}

/** Today's date ('YYYY-MM-DD') in the time zone; changes once a day. */
export function useTodayIn(tz: string): string {
  return useSyncExternalStore(subscribe, () => todayIn(tz, now));
}

/** Local time ('HH:mm') in the time zone. */
export function useTimeIn(tz: string): string {
  return useSyncExternalStore(subscribe, () => zonedParts(now, tz).time);
}
