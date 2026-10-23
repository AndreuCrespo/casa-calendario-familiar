// Lightweight i18n: two flat dictionaries (Spanish is the source of truth for
// keys) and a module-level current language. Changing the language remounts
// the app (see main.tsx), so plain t() calls are enough everywhere.
import { useSyncExternalStore } from 'react';
import type { Lang } from '../shared/types';
import { es } from './es';
import { en } from './en';

export type { Lang };
export type MessageKey = keyof typeof es;
type Params = Record<string, string | number>;

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'en', label: 'English', short: 'EN' },
];

const dicts: Record<Lang, Record<MessageKey, string>> = { es, en };
const STORAGE_KEY = 'casa-lang';
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = detect();
document.documentElement.lang = current;

export const getLang = () => current;

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage unavailable */ }
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => current,
  );
}

function fill(s: string, params?: Params) {
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : s;
}

/** Translated message, with `{name}` placeholders filled from params. */
export function t(key: MessageKey, params?: Params): string {
  return fill(dicts[current][key] ?? es[key] ?? key, params);
}

/** Pluralized message: uses `<base>_one` when n === 1 and `<base>_other` otherwise ({n} is filled in). */
export function tn(base: string, n: number, params?: Params): string {
  const key = `${base}_${n === 1 ? 'one' : 'other'}` as MessageKey;
  return t(key, { n, ...params });
}

/** BCP 47 locale for Intl formatting. */
export const locale = () => (current === 'es' ? 'es-ES' : 'en-GB');
