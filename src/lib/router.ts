// Router mínimo por hash: #/calendario, #/compra, …
import { useEffect, useState } from 'react';

export type Route =
  | 'inicio' | 'calendario' | 'compra' | 'tareas' | 'mas'
  | 'menu' | 'gastos' | 'notas' | 'fechas' | 'tiempo' | 'luz' | 'ajustes';

const ROUTES: Route[] = ['inicio', 'calendario', 'compra', 'tareas', 'mas', 'menu', 'gastos', 'notas', 'fechas', 'tiempo', 'luz', 'ajustes'];

function parse(): { route: Route; param: string | null } {
  const [, seg = '', param = null] = location.hash.replace(/^#/, '').split('/');
  const route = (ROUTES as string[]).includes(seg) ? (seg as Route) : 'inicio';
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

export function go(route: Route, param?: string) {
  location.hash = `/${route === 'inicio' ? '' : route}${param ? `/${param}` : ''}`;
}

export function href(route: Route, param?: string) {
  return `#/${route === 'inicio' ? '' : route}${param ? `/${param}` : ''}`;
}
