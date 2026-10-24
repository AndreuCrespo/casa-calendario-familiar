import { describe, expect, it } from 'vitest';
import { ROUTES } from '../shared/routes';
import { href, parseHash } from './router';

describe('router', () => {
  it('parses routes and their parameter', () => {
    expect(parseHash('')).toEqual({ route: 'home', param: null });
    expect(parseHash('#/')).toEqual({ route: 'home', param: null });
    expect(parseHash('#/calendar/2026-10-20')).toEqual({ route: 'calendar', param: '2026-10-20' });
  });

  it('keeps the Spanish routes of earlier versions working', () => {
    expect(parseHash('#/compra').route).toBe('shopping');
    expect(parseHash('#/calendario/2026-10-20')).toEqual({ route: 'calendar', param: '2026-10-20' });
    expect(parseHash('#/ajustes').route).toBe('settings');
  });

  it('sends unknown routes home', () => {
    expect(parseHash('#/nope').route).toBe('home');
  });

  it('builds links that parse back to the same route', () => {
    for (const route of ROUTES) expect(parseHash(href(route)).route).toBe(route);
    expect(parseHash(href('calendar', '2026-10-20')).param).toBe('2026-10-20');
  });
});
