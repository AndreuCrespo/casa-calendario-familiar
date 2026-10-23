import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import {
  CalendarClock, CalendarDays, CloudSun, Ellipsis, House, ListChecks, Settings, ShoppingCart, StickyNote,
  UtensilsCrossed, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { useApp, useCollection, useNow, useToday } from './lib/app';
import { href, useRoute, type Route } from './lib/router';
import { expiredDoneTasks } from './lib/tasks';
import { zonedParts } from './shared/dates';
import type { ShoppingItem, Task } from './shared/types';
import { t, type MessageKey } from './i18n';
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

interface NavDef { route: Route; label: MessageKey; icon: LucideIcon; where: 'both' | 'narrow' | 'wide' }

const NAV: NavDef[] = [
  { route: 'home', label: 'nav.home', icon: House, where: 'both' },
  { route: 'calendar', label: 'nav.calendar', icon: CalendarDays, where: 'both' },
  { route: 'shopping', label: 'nav.shopping', icon: ShoppingCart, where: 'both' },
  { route: 'tasks', label: 'nav.tasks', icon: ListChecks, where: 'both' },
  { route: 'menu', label: 'nav.menu', icon: UtensilsCrossed, where: 'wide' },
  { route: 'dates', label: 'nav.dates', icon: CalendarClock, where: 'wide' },
  { route: 'expenses', label: 'nav.expenses', icon: Wallet, where: 'wide' },
  { route: 'notes', label: 'nav.notes', icon: StickyNote, where: 'wide' },
  { route: 'weather', label: 'nav.weather', icon: CloudSun, where: 'wide' },
  { route: 'energy', label: 'nav.energy', icon: Zap, where: 'wide' },
  { route: 'settings', label: 'nav.settings', icon: Settings, where: 'wide' },
  { route: 'more', label: 'nav.more', icon: Ellipsis, where: 'narrow' },
];

const IN_MORE: Route[] = ['more', 'menu', 'expenses', 'notes', 'dates', 'weather', 'energy', 'settings'];

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
  const { backend } = useApp();
  const { route } = useRoute();
  const today = useToday();
  const shopping = useCollection<ShoppingItem>('shopping');
  const tasks = useCollection<Task>('tasks');

  const badges = useMemo<Partial<Record<Route, number>>>(() => ({
    shopping: shopping?.filter((s) => !s.done).length ?? 0,
    tasks: tasks?.filter((x) => !x.done && x.due && x.due <= today).length ?? 0,
  }), [shopping, tasks, today]);

  // One-off tasks done more than 30 days ago are deleted once per session.
  const cleaned = useRef(false);
  useEffect(() => {
    if (!tasks || cleaned.current) return;
    cleaned.current = true;
    expiredDoneTasks(tasks).forEach((x) => backend.remove('tasks', x.id));
  }, [tasks, backend]);

  const wide = route === 'home' || route === 'calendar';

  return (
    <>
      <nav className="nav">
        {NAV.map((n) => {
          const active = n.route === route || (n.route === 'more' && IN_MORE.includes(route));
          const cls = n.where === 'narrow' ? ' hide-wide' : n.where === 'wide' ? ' hide-narrow' : '';
          const badge = badges[n.route];
          return (
            <a
              key={n.route}
              href={href(n.route)}
              className={`nav-item${active ? ' active' : ''}${cls}`}
              aria-label={t(n.label)}
              onClick={(e) => {
                // Like native apps: switching tabs doesn't pile up history, so Android's
                // back gesture returns to Home, and from Home it leaves the app.
                if (n.route === route) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
                if (route !== 'home') { e.preventDefault(); location.replace(href(n.route)); }
              }}
            >
              <span className="nav-ic"><n.icon size={22} strokeWidth={active ? 2.3 : 1.9} /></span>
              <span className="nav-label">{t(n.label)}</span>
              {!!badge && <span className="nav-badge">{badge}</span>}
            </a>
          );
        })}
        <RailClock />
      </nav>
      <main className={`main${wide ? '' : ' narrow'}`}>
        <Suspense fallback={<div className="center" style={{ padding: 60 }}><Spinner /></div>}>
          {route === 'home' && <Dashboard />}
          {route === 'calendar' && <Calendar />}
          {route === 'shopping' && <Shopping />}
          {route === 'tasks' && <Tasks />}
          {route === 'more' && <More />}
          {route === 'menu' && <Menu />}
          {route === 'expenses' && <Expenses />}
          {route === 'notes' && <Notes />}
          {route === 'dates' && <KeyDates />}
          {route === 'weather' && <WeatherPage />}
          {route === 'energy' && <Energy />}
          {route === 'settings' && <SettingsPage />}
        </Suspense>
      </main>
      <ToastHost />
    </>
  );
}
