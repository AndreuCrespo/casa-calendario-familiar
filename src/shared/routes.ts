// Screens of the app (hash routing). Shared so that notifications only link to
// screens that exist.
export const ROUTES = [
  'home',
  'calendar',
  'shopping',
  'tasks',
  'more',
  'menu',
  'expenses',
  'notes',
  'dates',
  'weather',
  'energy',
  'settings',
] as const;

export type Route = (typeof ROUTES)[number];

/** Path that opens a screen, e.g. '/#/calendar' ('/#/' for home). */
export const routePath = (route: Route): string => `/#/${route === 'home' ? '' : route}`;
