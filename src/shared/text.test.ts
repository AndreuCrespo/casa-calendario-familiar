import { describe, expect, it } from 'vitest';
import { clip, joinList } from './text';

describe('joinList', () => {
  it('joins in Spanish', () => {
    expect(joinList([], 'es')).toBe('');
    expect(joinList(['pan'], 'es')).toBe('pan');
    expect(joinList(['leche', 'pan', 'huevos'], 'es')).toBe('leche, pan y huevos');
    expect(joinList(['leche', '', ' ', 'pan'], 'es')).toBe('leche y pan');
  });

  it('uses "e" before an /i/ sound, but not before a diphthong', () => {
    expect(joinList(['Lía', 'Iker'], 'es')).toBe('Lía e Iker');
    expect(joinList(['pan', 'higos'], 'es')).toBe('pan e higos');
    expect(joinList(['Ana', 'Íñigo'], 'es')).toBe('Ana e Íñigo');
    expect(joinList(['madre', 'hija'], 'es')).toBe('madre e hija');
    expect(joinList(['agua', 'hielo'], 'es')).toBe('agua y hielo');
    expect(joinList(['cobre', 'hierro'], 'es')).toBe('cobre y hierro');
    expect(joinList(['Ana', 'Ian'], 'es')).toBe('Ana y Ian');
    expect(joinList(['pan', 'yogur'], 'es')).toBe('pan y yogur');
  });

  it('joins in English', () => {
    expect(joinList([], 'en')).toBe('');
    expect(joinList(['bread'], 'en')).toBe('bread');
    expect(joinList(['Lía', 'Iker'], 'en')).toBe('Lía and Iker');
    expect(joinList(['milk', 'bread', 'eggs'], 'en')).toBe('milk, bread and eggs');
  });
});

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('hola', 4)).toBe('hola');
    expect(clip('', 0)).toBe('');
    expect(clip('🎂🎂', 2)).toBe('🎂🎂'); // 4 UTF-16 units, 2 code points
  });

  it('cuts by code points and ends in an ellipsis', () => {
    expect(clip('abcdef', 4)).toBe('abc…');
    expect(clip('ab   cdef', 5)).toBe('ab…'); // no trailing spaces before the ellipsis
    expect(clip('🎂🎂🎂🎂', 3)).toBe('🎂🎂…');
    expect(clip('x', 0)).toBe('');
  });

  it('never leaves half of a character', () => {
    const out = clip('a🎂'.repeat(100), 50);
    expect(Array.from(out)).toHaveLength(50);
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
