import { describe, expect, it } from 'vitest';
import { setLang, t, tn } from '.';
import { en } from './en';
import { es } from './es';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('define both plural forms', () => {
    for (const key of Object.keys(es)) {
      if (key.endsWith('_one')) expect(es, key).toHaveProperty(key.replace(/_one$/, '_other'));
    }
  });

  it('have no empty texts', () => {
    for (const [key, value] of [...Object.entries(es), ...Object.entries(en)]) expect(value.trim(), key).not.toBe('');
  });
});

describe('t and tn', () => {
  it('fill placeholders and pick the plural form', async () => {
    await setLang('en');
    expect(t('join.title', { name: 'Home' })).toBe('Join "Home"');
    expect(tn('shopping.items', 1)).not.toBe(tn('shopping.items', 2));
    expect(tn('shopping.items', 2)).toContain('2');
    await setLang('es');
    expect(t('join.title', { name: 'Casa' })).toBe('Únete a «Casa»');
  });

  it('leaves unknown placeholders as they are', async () => {
    await setLang('es');
    expect(t('join.title')).toBe('Únete a «{name}»');
  });
});
