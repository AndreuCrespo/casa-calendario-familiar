// Minimal hash router: #/calendar, #/shopping, …
import { useEffect, useState } from 'react';

export type Route =
  | 'home' | 'calendar' | 'shopping' | 'tasks' | 'more'
  | 'menu' | 'expenses' | 'notes' | 'dates' | 'weather' | 'energy' | 'settings';

const ROUTES: Route[] = ['home', 'calendar', 'shopping', 'tasks', 'more', 'menu', 'expenses', 'notes', 'dates', 'weather', 'energy', 'settings'];

/** Spanish routes from earlier versions (old links and notifications keep working). */
const LEGACY: Record<string, Route> = {
  inicio: 'home', calendario: 'calendar', compra: 'shopping', tareas: 'tasks', mas: 'more',
  gastos: 'expenses', notas: 'notes', fechas: 'dates', tiempo: 'weather', luz: 'energy', ajustes: 'settings',
};

function parse(): { route: Route; param: string | null } {
  const [, seg = '', param = null] = location.hash.replace(/^#/, '').split('/');
  const route = (ROUTES as string[]).includes(seg) ? (seg as Route) : LEGACY[seg] ?? 'home';
  return { route, param };
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function href(route: Route, param?: string) {
  return `#/${route === 'home' ? '' : route}${param ? `/${param}` : ''}`;
}
