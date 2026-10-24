import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/limits';
import type { ShoppingItem } from '../../shared/types';
import { nextFreq, splitItems, suggestions } from './shopping';

const item = (name: string): ShoppingItem => ({ id: name, name, done: false, createdAt: 0 });

describe('shopping helpers', () => {
  it('splits several items typed at once', () => {
    expect(splitItems(' milk, bread\neggs,, ')).toEqual(['milk', 'bread', 'eggs']);
  });

  it('suggests frequent items that are not on the list yet', () => {
    expect(suggestions({ milk: 5, bread: 9, eggs: 1 }, [item('Bread')])).toEqual(['Milk', 'Eggs']);
  });

  it('counts the items added', () => {
    expect(nextFreq({ milk: 2 }, ['Milk', 'Eggs'])).toEqual({ merge: { milk: 3, eggs: 1 } });
  });

  it('drops the rarest items when the map would grow too big', () => {
    const full = Object.fromEntries(Array.from({ length: LIMITS.shoppingFreq }, (_, i) => [`item${i}`, i + 1]));
    const next = nextFreq(full, ['New']);
    expect('replace' in next).toBe(true);
    if ('replace' in next) {
      expect(Object.keys(next.replace)).toHaveLength(LIMITS.shoppingFreq);
      expect(next.replace.new).toBe(1);
      expect(next.replace.item0).toBeUndefined(); // the rarest one
    }
  });
});
