// Minimal hash router: #/calendar, #/calendar/2026-10-20, …
import { useEffect, useState } from 'react';
import { ROUTES, type Route } from '../shared/routes';

export type { Route };

/** Spanish routes from earlier versions (old links and notifications keep working). */
const LEGACY: Record<string, Route> = {
  inicio: 'home',
  calendario: 'calendar',
  compra: 'shopping',
  tareas: 'tasks',
  mas: 'more',
  gastos: 'expenses',
  notas: 'notes',
  fechas: 'dates',
  tiempo: 'weather',
  luz: 'energy',
  ajustes: 'settings',
};

const isRoute = (s: string): s is Route => (ROUTES as readonly string[]).includes(s);

export interface Location {
  route: Route;
  param: string | null;
}

export function parseHash(hash: string): Location {
  const [, seg = '', param = null] = hash.replace(/^#/, '').split('/');
  return { route: isRoute(seg) ? seg : (LEGACY[seg] ?? 'home'), param: param || null };
}

export function href(route: Route, param?: string) {
  return `#/${route === 'home' ? '' : route}${param ? `/${param}` : ''}`;
}

export function useRoute(): Location {
  const [loc, setLoc] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => {
      setLoc(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}
