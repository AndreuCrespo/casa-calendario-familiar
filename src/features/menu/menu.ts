// Weekly menu: one document per day (id 'YYYY-MM-DD'). Only recent and future
// days are kept in sync; older weeks are loaded when someone looks at them.
import { useMemo } from 'react';
import { useCollection, useToday } from '../../core/app';
import { addDays, type DateStr, startOfWeek } from '../../shared/dates';
import type { MenuDay } from '../../shared/types';

/** Weeks of past menus kept in sync (also the source of dish suggestions). */
const PAST_WEEKS = 8;

export const menuWindowStart = (today: DateStr) => addDays(startOfWeek(today), -PAST_WEEKS * 7);

/** Menu days between from and to (inclusive), or every synced day. */
export function useMenu(from?: DateStr, to?: DateStr): MenuDay[] | undefined {
  const today = useToday();
  const start = menuWindowStart(today);
  const inWindow = !from || from >= start;
  const menu = useCollection('menu', inWindow ? { from: start } : { from, to });
  return useMemo(
    () => (from || to ? menu?.filter((m) => (!from || m.id >= from) && (!to || m.id <= to)) : menu),
    [menu, from, to],
  );
}

/** Dishes already used, most frequent first (for suggestions while typing). */
export function dishSuggestions(menu: readonly MenuDay[] | undefined, limit = 200) {
  const count = new Map<string, number>();
  for (const m of menu ?? []) {
    for (const d of [m.lunch, m.dinner]) if (d) count.set(d, (count.get(d) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([d]) => d);
}

/** "Lentils · Omelette" */
export const mealsText = (m: MenuDay | undefined) => [m?.lunch, m?.dinner].filter(Boolean).join(' · ');
