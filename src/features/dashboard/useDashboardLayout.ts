// The signed-in person's home screen layout, saved in prefs/{uid}.
import { useMemo } from 'react';
import { useApp, useDoc } from '../../core/app';
import { DEFAULT_ORDER, type Layout, resolveLayout, type WidgetId } from './layout';

export interface DashboardLayout extends Layout {
  /** False until the saved settings have loaded. */
  loaded: boolean;
  save: (order: readonly WidgetId[], hidden: ReadonlySet<WidgetId>) => void;
  reset: () => void;
}

export function useDashboardLayout(): DashboardLayout {
  const { backend, user } = useApp();
  const prefs = useDoc('prefs', user.uid);
  const saved = prefs?.dashboard;
  const layout = useMemo(() => resolveLayout(saved), [saved]);
  const write = (order: readonly WidgetId[], hidden: readonly WidgetId[]) =>
    backend.merge('prefs', user.uid, { dashboard: { order: [...order], hidden: [...hidden] }, updatedAt: Date.now() });
  return {
    ...layout,
    loaded: prefs !== undefined,
    save: (order, hidden) => write(order, [...hidden]),
    reset: () => write(DEFAULT_ORDER, []),
  };
}
