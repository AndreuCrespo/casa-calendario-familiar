// Home screen layout: which cards there are, how wide each one is and how a
// person's saved choices (order, hidden cards) are applied. Pure functions.

export const WIDGET_IDS = [
  'hero',
  'next',
  'agenda',
  'menu',
  'week',
  'shopping',
  'tasks',
  'energy',
  'dates',
  'expenses',
  'notes',
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

/** In the default order. */
export const DEFAULT_ORDER: readonly WidgetId[] = WIDGET_IDS;

/** hero/wide: full row on phones, 2/3 on large screens · half: half row / 1/3 · full: always a full row */
export type WidgetSize = 'hero' | 'next' | 'wide' | 'full' | 'half';

export const WIDGET_SIZE: Record<WidgetId, WidgetSize> = {
  hero: 'hero',
  next: 'next',
  agenda: 'wide',
  menu: 'half',
  week: 'full',
  shopping: 'half',
  tasks: 'half',
  energy: 'half',
  dates: 'half',
  expenses: 'half',
  notes: 'half',
};

/** Columns each size takes: phone (row of 2) and large screen (row of 3 blocks). */
const UNITS: Record<WidgetSize, { m: number; d: number }> = {
  hero: { m: 2, d: 2 },
  wide: { m: 2, d: 2 },
  next: { m: 2, d: 1 },
  half: { m: 1, d: 1 },
  full: { m: 2, d: 3 },
};

function packRows(ids: readonly WidgetId[], units: (id: WidgetId) => number, cols: number) {
  const out = new Map<WidgetId, number>();
  let used = 0;
  let last: WidgetId | null = null;
  // A card left alone at the end of a row takes the rest of it.
  const closeRow = () => {
    if (last && used < cols) out.set(last, (out.get(last) ?? 0) + cols - used);
    used = 0;
    last = null;
  };
  for (const id of ids) {
    const u = Math.min(units(id), cols);
    if (used + u > cols) closeRow();
    out.set(id, u);
    used += u;
    last = id;
    if (used === cols) {
      used = 0;
      last = null;
    }
  }
  closeRow();
  return out;
}

export interface Span {
  /** Columns out of 2 on phones. */
  m: number;
  /** Blocks out of 3 on large screens. */
  d: number;
}

/** Width of each card, keeping the chosen order without leaving gaps. */
export function packSpans(ids: readonly WidgetId[]): Map<WidgetId, Span> {
  const size = (id: WidgetId) => UNITS[WIDGET_SIZE[id]];
  const m = packRows(ids, (id) => size(id).m, 2);
  const d = packRows(ids, (id) => size(id).d, 3);
  return new Map(ids.map((id) => [id, { m: m.get(id) ?? 2, d: d.get(id) ?? 3 }]));
}

export interface DashboardPrefs {
  order?: readonly string[];
  hidden?: readonly string[];
}

export interface Layout {
  order: WidgetId[];
  hidden: ReadonlySet<WidgetId>;
}

const isWidget = (id: string): id is WidgetId => (WIDGET_IDS as readonly string[]).includes(id);

/**
 * Merges saved settings with the defaults: ignores unknown ids and duplicates,
 * and places cards added after the settings were saved next to their default
 * neighbour.
 */
export function resolveLayout(prefs?: DashboardPrefs): Layout {
  const order = [...new Set((prefs?.order ?? []).filter(isWidget))];
  DEFAULT_ORDER.forEach((id, i) => {
    if (order.includes(id)) return;
    const prev = DEFAULT_ORDER.slice(0, i)
      .reverse()
      .find((p) => order.includes(p));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
  });
  return { order, hidden: new Set((prefs?.hidden ?? []).filter(isWidget)) };
}

/** Moves the card at `from` to position `to`. */
export function moveWidget(order: readonly WidgetId[], from: number, to: number): WidgetId[] {
  const next = [...order];
  const [id] = next.splice(from, 1);
  if (id) next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}
