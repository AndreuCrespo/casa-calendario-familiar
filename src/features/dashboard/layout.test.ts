import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER, moveWidget, packSpans, resolveLayout, type WidgetId } from './layout';

const spans = (ids: WidgetId[]) => Object.fromEntries([...packSpans(ids)].map(([id, s]) => [id, `${s.m}/${s.d}`]));

describe('packSpans', () => {
  it('fills full rows with the default layout', () => {
    expect(spans(['hero', 'next'])).toEqual({ hero: '2/2', next: '2/1' });
    expect(spans(['shopping', 'tasks', 'energy'])).toEqual({ shopping: '1/1', tasks: '1/1', energy: '2/1' });
  });

  it('stretches a card left alone at the end of a row', () => {
    // Phones: rows of 2. Large screens: rows of 3.
    expect(spans(['shopping'])).toEqual({ shopping: '2/3' });
    expect(spans(['shopping', 'tasks', 'energy', 'dates'])).toEqual({
      shopping: '1/1',
      tasks: '1/1',
      energy: '1/1',
      dates: '1/3',
    });
  });

  it('closes a row before a card that does not fit', () => {
    // agenda is 2 wide on large screens: the half card before it takes the whole row.
    expect(spans(['menu', 'week', 'agenda'])).toEqual({ menu: '2/3', week: '2/3', agenda: '2/3' });
  });
});

describe('resolveLayout', () => {
  it('uses the defaults without saved settings', () => {
    const l = resolveLayout(undefined);
    expect(l.order).toEqual(DEFAULT_ORDER);
    expect(l.hidden.size).toBe(0);
  });

  it('ignores unknown ids and duplicates', () => {
    const l = resolveLayout({ order: ['tasks', 'nope', 'tasks', 'hero'], hidden: ['nope', 'notes'] });
    expect(l.order.filter((id) => id === 'tasks')).toHaveLength(1);
    expect(l.order).not.toContain('nope');
    expect([...l.hidden]).toEqual(['notes']);
  });

  it('keeps the saved order and puts new cards next to their default neighbour', () => {
    const l = resolveLayout({ order: ['tasks', 'hero'] });
    expect(l.order[0]).toBe('tasks');
    expect(l.order.indexOf('tasks')).toBeLessThan(l.order.indexOf('hero'));
    // Missing cards follow their default predecessor: 'energy' after 'tasks', 'next' after 'hero'.
    expect(l.order[1]).toBe('energy');
    expect(l.order[l.order.indexOf('hero') + 1]).toBe('next');
    expect(new Set(l.order)).toEqual(new Set(DEFAULT_ORDER));
  });
});

describe('moveWidget', () => {
  it('moves a card and keeps the rest in order', () => {
    expect(moveWidget(['hero', 'next', 'agenda'], 0, 2)).toEqual(['next', 'agenda', 'hero']);
    expect(moveWidget(['hero', 'next', 'agenda'], 2, 0)).toEqual(['agenda', 'hero', 'next']);
    expect(moveWidget(['hero', 'next'], 1, 9)).toEqual(['hero', 'next']);
  });
});
