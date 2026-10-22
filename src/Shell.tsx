import { lazy, Suspense, useMemo } from 'react';
import {
  CalendarClock, CalendarDays, CloudSun, Ellipsis, House, ListChecks, Settings, ShoppingCart, StickyNote,
  UtensilsCrossed, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { useApp, useCollection, useNow, useToday } from './lib/app';
import { href, useRoute, type Route } from './lib/router';
import { zonedParts } from './shared/dates';
import type { ShoppingItem, Task } from './shared/types';
import { Spinner, ToastHost } from './components/ui';
import Dashboard from './pages/Dashboard';

const Calendar = lazy(() => import('./pages/Calendar'));
const Shopping = lazy(() => import('./pages/Shopping'));
const Tasks = lazy(() => import('./pages/Tasks'));
const More = lazy(() => import('./pages/More'));
const Menu = lazy(() => import('./pages/Menu'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Notes = lazy(() => import('./pages/Notes'));
const KeyDates = lazy(() => import('./pages/KeyDates'));
const WeatherPage = lazy(() => import('./pages/Weather'));
const Energy = lazy(() => import('./pages/Energy'));
const SettingsPage = lazy(() => import('./pages/Settings'));

interface NavDef { route: Route; label: string; icon: LucideIcon; where: 'both' | 'narrow' | 'wide' }

const NAV: NavDef[] = [
  { route: 'inicio', label: 'Inicio', icon: House, where: 'both' },
  { route: 'calendario', label: 'Calendario', icon: CalendarDays, where: 'both' },
  { route: 'compra', label: 'Compra', icon: ShoppingCart, where: 'both' },
  { route: 'tareas', label: 'Tareas', icon: ListChecks, where: 'both' },
  { route: 'menu', label: 'Menú', icon: UtensilsCrossed, where: 'wide' },
  { route: 'fechas', label: 'Fechas', icon: CalendarClock, where: 'wide' },
  { route: 'gastos', label: 'Gastos', icon: Wallet, where: 'wide' },
  { route: 'notas', label: 'Notas', icon: StickyNote, where: 'wide' },
  { route: 'tiempo', label: 'Tiempo', icon: CloudSun, where: 'wide' },
  { route: 'luz', label: 'Luz', icon: Zap, where: 'wide' },
  { route: 'ajustes', label: 'Ajustes', icon: Settings, where: 'wide' },
  { route: 'mas', label: 'Más', icon: Ellipsis, where: 'narrow' },
];

const IN_MORE: Route[] = ['mas', 'menu', 'gastos', 'notas', 'fechas', 'tiempo', 'luz', 'ajustes'];

function RailClock() {
  const { tz } = useApp();
  const now = useNow(10_000);
  const p = zonedParts(now, tz);
  return (
    <div className="nav-clock num">
      <span>{String(p.hour).padStart(2, '0')}</span><br />
      <span>{String(p.minute).padStart(2, '0')}</span>
    </div>
  );
}

export function Shell() {
  const { route } = useRoute();
  const today = useToday();
  const shopping = useCollection<ShoppingItem>('shopping');
  const tasks = useCollection<Task>('tasks');

  const badges = useMemo<Partial<Record<Route, number>>>(() => ({
    compra: shopping?.filter((s) => !s.done).length ?? 0,
    tareas: tasks?.filter((t) => !t.done && t.due && t.due <= today).length ?? 0,
  }), [shopping, tasks, today]);

  const wide = route === 'inicio' || route === 'calendario';

  return (
    <>
      <nav className="nav">
        {NAV.map((n) => {
          const active = n.route === route || (n.route === 'mas' && IN_MORE.includes(route));
          const cls = n.where === 'narrow' ? ' hide-wide' : n.where === 'wide' ? ' hide-narrow' : '';
          const badge = badges[n.route];
          return (
            <a key={n.route} href={href(n.route)} className={`nav-item${active ? ' active' : ''}${cls}`} aria-label={n.label}>
              <span className="nav-ic"><n.icon size={22} strokeWidth={active ? 2.3 : 1.9} /></span>
              <span className="nav-label">{n.label}</span>
              {!!badge && <span className="nav-badge">{badge}</span>}
            </a>
          );
        })}
        <RailClock />
      </nav>
      <main className={`main${wide ? '' : ' narrow'}`}>
        <Suspense fallback={<div className="center" style={{ padding: 60 }}><Spinner /></div>}>
          {route === 'inicio' && <Dashboard />}
          {route === 'calendario' && <Calendar />}
          {route === 'compra' && <Shopping />}
          {route === 'tareas' && <Tasks />}
          {route === 'mas' && <More />}
          {route === 'menu' && <Menu />}
          {route === 'gastos' && <Expenses />}
          {route === 'notas' && <Notes />}
          {route === 'fechas' && <KeyDates />}
          {route === 'tiempo' && <WeatherPage />}
          {route === 'luz' && <Energy />}
          {route === 'ajustes' && <SettingsPage />}
        </Suspense>
      </main>
      <ToastHost />
    </>
  );
}
