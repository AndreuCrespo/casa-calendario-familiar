// Every section of the app in one place: route, name, icon, where it appears in
// the navigation and the page that shows it (loaded when first opened).
import {
  CalendarClock,
  CalendarDays,
  CloudSun,
  Ellipsis,
  House,
  ListChecks,
  type LucideIcon,
  Settings,
  ShoppingCart,
  StickyNote,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';
import { type ComponentType, lazy } from 'react';
import DashboardPage from '../features/dashboard/DashboardPage';
import type { MessageKey } from '../i18n';
import type { Route } from './router';

export interface Section {
  route: Route;
  label: MessageKey;
  icon: LucideIcon;
  /** Navigation bar: on every screen, only on phones (bottom bar) or only on large screens (side rail). */
  nav: 'both' | 'narrow' | 'wide';
  /** Tile in "More" on phones. */
  tile?: { sub: MessageKey; color: string };
  /** Full width on large screens. */
  wide?: boolean;
  page: ComponentType;
}

const HOME: Section = { route: 'home', label: 'nav.home', icon: House, nav: 'both', wide: true, page: DashboardPage };

export const SECTIONS: readonly Section[] = [
  HOME,
  {
    route: 'calendar',
    label: 'nav.calendar',
    icon: CalendarDays,
    nav: 'both',
    wide: true,
    page: lazy(() => import('../features/calendar/CalendarPage')),
  },
  {
    route: 'shopping',
    label: 'nav.shopping',
    icon: ShoppingCart,
    nav: 'both',
    page: lazy(() => import('../features/shopping/ShoppingPage')),
  },
  {
    route: 'tasks',
    label: 'nav.tasks',
    icon: ListChecks,
    nav: 'both',
    page: lazy(() => import('../features/tasks/TasksPage')),
  },
  {
    route: 'menu',
    label: 'nav.menu',
    icon: UtensilsCrossed,
    nav: 'wide',
    tile: { sub: 'more.menu.sub', color: '#F08C2E' },
    page: lazy(() => import('../features/menu/MenuPage')),
  },
  {
    route: 'dates',
    label: 'nav.dates',
    icon: CalendarClock,
    nav: 'wide',
    tile: { sub: 'more.dates.sub', color: '#D9483B' },
    page: lazy(() => import('../features/keyDates/KeyDatesPage')),
  },
  {
    route: 'expenses',
    label: 'nav.expenses',
    icon: Wallet,
    nav: 'wide',
    tile: { sub: 'more.expenses.sub', color: '#4C7DF0' },
    page: lazy(() => import('../features/expenses/ExpensesPage')),
  },
  {
    route: 'notes',
    label: 'nav.notes',
    icon: StickyNote,
    nav: 'wide',
    tile: { sub: 'more.notes.sub', color: '#C99A1E' },
    page: lazy(() => import('../features/notes/NotesPage')),
  },
  {
    route: 'weather',
    label: 'nav.weather',
    icon: CloudSun,
    nav: 'wide',
    tile: { sub: 'more.weather.sub', color: '#14A3B8' },
    page: lazy(() => import('../features/weather/WeatherPage')),
  },
  {
    route: 'energy',
    label: 'nav.energy',
    icon: Zap,
    nav: 'wide',
    tile: { sub: 'more.energy.sub', color: '#22A06B' },
    page: lazy(() => import('../features/energy/EnergyPage')),
  },
  {
    route: 'settings',
    label: 'nav.settings',
    icon: Settings,
    nav: 'wide',
    page: lazy(() => import('../features/settings/SettingsPage')),
  },
  {
    route: 'more',
    label: 'nav.more',
    icon: Ellipsis,
    nav: 'narrow',
    page: lazy(() => import('../features/more/MorePage')),
  },
];

/** Sections reached through "More" on phones (they keep "More" highlighted). */
export const IN_MORE: readonly Route[] = ['more', 'settings', ...SECTIONS.filter((s) => s.tile).map((s) => s.route)];

export const section = (route: Route): Section => SECTIONS.find((s) => s.route === route) ?? HOME;
