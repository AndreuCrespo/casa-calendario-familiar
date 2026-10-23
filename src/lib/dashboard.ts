// Home dashboard settings: which cards are shown and in what order (per person).
import { useMemo } from 'react';
import {
  CalendarClock, CalendarDays, CloudSun, ListChecks, ListTodo, ShoppingCart, Sparkles, StickyNote,
  UtensilsCrossed, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { useApp, useCollection } from './app';
import type { MessageKey } from '../i18n';

export type WidgetId =
  | 'hero' | 'next' | 'agenda' | 'week' | 'menu'
  | 'shopping' | 'tasks' | 'energy' | 'dates' | 'expenses' | 'notes';

/** hero/wide: full row on phones, 2/3 on large screens · half: half row / 1/3 · full: always a full row */
export type WidgetSize = 'hero' | 'next' | 'wide' | 'full' | 'half';

export interface WidgetMeta { id: WidgetId; label: MessageKey; sub: MessageKey; icon: LucideIcon; size: WidgetSize }

/** In default order. */
export const WIDGETS: WidgetMeta[] = [
  { id: 'hero', label: 'widget.hero', sub: 'widget.hero.sub', icon: CloudSun, size: 'hero' },
  { id: 'next', label: 'widget.next', sub: 'widget.next.sub', icon: Sparkles, size: 'next' },
  { id: 'agenda', label: 'widget.agenda', sub: 'widget.agenda.sub', icon: ListTodo, size: 'wide' },
  { id: 'menu', label: 'widget.menu', sub: 'widget.menu.sub', icon: UtensilsCrossed, size: 'half' },
  { id: 'week', label: 'widget.week', sub: 'widget.week.sub', icon: CalendarDays, size: 'full' },
  { id: 'shopping', label: 'widget.shopping', sub: 'widget.shopping.sub', icon: ShoppingCart, size: 'half' },
  { id: 'tasks', label: 'widget.tasks', sub: 'widget.tasks.sub', icon: ListChecks, size: 'half' },
  { id: 'energy', label: 'widget.energy', sub: 'widget.energy.sub', icon: Zap, size: 'half' },
  { id: 'dates', label: 'widget.dates', sub: 'widget.dates.sub', icon: CalendarClock, size: 'half' },
  { id: 'expenses', label: 'widget.expenses', sub: 'widget.expenses.sub', icon: Wallet, size: 'half' },
  { id: 'notes', label: 'widget.notes', sub: 'widget.notes.sub', icon: StickyNote, size: 'half' },
];

export const DEFAULT_ORDER = WIDGETS.map((w) => w.id);
export const widgetMeta = (id: WidgetId) => WIDGETS.find((w) => w.id === id)!;

/** Columns each size takes: phone (row of 2) and large screen (row of 3 blocks). */
const UNITS: Record<WidgetSize, { m: number; d: number }> = {
  hero: { m: 2, d: 2 }, wide: { m: 2, d: 2 }, next: { m: 2, d: 1 }, half: { m: 1, d: 1 }, full: { m: 2, d: 3 },
};

function packRows(ids: WidgetId[], units: (id: WidgetId) => number, cols: number) {
  const out = new Map<WidgetId, number>();
  let used = 0;
  let last: WidgetId | null = null;
  const closeRow = () => {
    if (last && used < cols) out.set(last, out.get(last)! + cols - used);
    used = 0;
    last = null;
  };
  for (const id of ids) {
    const u = Math.min(units(id), cols);
    if (used + u > cols) closeRow();
    out.set(id, u);
    used += u;
    last = id;
    if (used === cols) { used = 0; last = null; }
  }
  closeRow();
  return out;
}

/**
 * Width of each card, keeping the chosen order: a card left alone at the end of
 * a row is stretched so there are no gaps.
 */
export function packSpans(ids: WidgetId[]) {
  const size = (id: WidgetId) => UNITS[widgetMeta(id).size];
  const m = packRows(ids, (id) => size(id).m, 2);
  const d = packRows(ids, (id) => size(id).d, 3);
  return new Map(ids.map((id) => [id, { m: m.get(id)!, d: d.get(id)! }]));
}

export interface DashboardPrefs { order?: string[]; hidden?: string[] }
interface PrefsDoc { id: string; dashboard?: DashboardPrefs }

/**
 * Merges saved settings with the defaults: ignores unknown ids and places new
 * cards (added after the settings were saved) next to their default neighbour.
 */
export function resolveLayout(prefs?: DashboardPrefs): { order: WidgetId[]; hidden: Set<WidgetId> } {
  const known = new Set<string>(DEFAULT_ORDER);
  const order = (prefs?.order ?? []).filter((id): id is WidgetId => known.has(id));
  const unique = order.filter((id, i) => order.indexOf(id) === i);
  DEFAULT_ORDER.forEach((id, i) => {
    if (unique.includes(id)) return;
    const prev = DEFAULT_ORDER.slice(0, i).reverse().find((p) => unique.includes(p));
    unique.splice(prev ? unique.indexOf(prev) + 1 : 0, 0, id);
  });
  return { order: unique, hidden: new Set((prefs?.hidden ?? []).filter((id): id is WidgetId => known.has(id))) };
}

export function useDashboardLayout() {
  const { backend, user } = useApp();
  const prefs = useCollection<PrefsDoc>('prefs');
  const mine = prefs?.find((p) => p.id === user.uid)?.dashboard;
  const layout = useMemo(() => resolveLayout(mine), [mine]);
  const save = (order: WidgetId[], hidden: Set<WidgetId>) =>
    backend.set('prefs', user.uid, { dashboard: { order, hidden: [...hidden] }, updatedAt: Date.now() }, true);
  const reset = () => backend.set('prefs', user.uid, { dashboard: { order: DEFAULT_ORDER, hidden: [] }, updatedAt: Date.now() }, true);
  return { ...layout, loaded: prefs !== undefined, save, reset };
}

