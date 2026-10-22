// Configuración del inicio: qué tarjetas se ven y en qué orden (por persona).
import { useMemo } from 'react';
import {
  CalendarClock, CalendarDays, CloudSun, ListChecks, ListTodo, ShoppingCart, Sparkles, StickyNote,
  UtensilsCrossed, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { useApp, useCollection } from './app';

export type WidgetId =
  | 'hero' | 'next' | 'agenda' | 'week' | 'menu'
  | 'shopping' | 'tasks' | 'energy' | 'dates' | 'expenses' | 'notes';

/** hero/wide: fila entera en el móvil, 2/3 en pantalla grande · half: media fila / 1/3 · full: siempre entera */
export type WidgetSize = 'hero' | 'next' | 'wide' | 'full' | 'half';

export interface WidgetMeta { id: WidgetId; label: string; sub: string; icon: LucideIcon; size: WidgetSize }

/** En el orden por defecto. */
export const WIDGETS: WidgetMeta[] = [
  { id: 'hero', label: 'Reloj y tiempo', sub: 'Hora, fecha y previsión de 5 días', icon: CloudSun, size: 'hero' },
  { id: 'next', label: 'Lo próximo', sub: 'Siguiente evento con cuenta atrás', icon: Sparkles, size: 'next' },
  { id: 'agenda', label: 'Agenda', sub: 'Lo de hoy y mañana en lista', icon: ListTodo, size: 'wide' },
  { id: 'menu', label: 'Menú de hoy', sub: 'Comida y cena, con edición rápida', icon: UtensilsCrossed, size: 'half' },
  { id: 'week', label: 'Semana', sub: 'Los próximos 7 días en columnas', icon: CalendarDays, size: 'full' },
  { id: 'shopping', label: 'Compra', sub: 'Lo que falta por comprar', icon: ShoppingCart, size: 'half' },
  { id: 'tasks', label: 'Tareas de hoy', sub: 'Pendientes y atrasadas', icon: ListChecks, size: 'half' },
  { id: 'energy', label: 'Luz', sub: 'Precio ahora y horas baratas', icon: Zap, size: 'half' },
  { id: 'dates', label: 'Fechas', sub: 'Cumpleaños y vencimientos cercanos', icon: CalendarClock, size: 'half' },
  { id: 'expenses', label: 'Gastos', sub: 'Total del mes y quién debe a quién', icon: Wallet, size: 'half' },
  { id: 'notes', label: 'Notas', sub: 'La nota fijada más reciente', icon: StickyNote, size: 'half' },
];

export const DEFAULT_ORDER = WIDGETS.map((w) => w.id);
export const widgetMeta = (id: WidgetId) => WIDGETS.find((w) => w.id === id)!;

/** Columnas que ocupa cada tamaño: móvil (fila de 2) y pantalla grande (fila de 3 bloques). */
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
 * Anchura de cada tarjeta respetando el orden elegido: si una tarjeta se queda
 * sola al final de una fila, se estira para no dejar huecos.
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
 * Combina lo guardado con los valores por defecto: ignora ids desconocidos y
 * coloca las tarjetas nuevas (que no estaban al guardar) junto a su vecina por defecto.
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

