// Lightweight i18n: two flat dictionaries (Spanish defines the keys), loaded on
// demand, and a module-level current language. Changing the language remounts
// the app (see app/App.tsx), so plain t() calls are enough everywhere.
import { useSyncExternalStore } from 'react';
import { KEYS, readString, writeString } from '../core/storage';
import { LOCALE, toLang } from '../shared/locale';
import type { Lang } from '../shared/types';
import type { es } from './es';

export type { Lang };
export type MessageKey = keyof typeof es;
type Dict = Record<MessageKey, string>;
type Params = Record<string, string | number>;

/** Keys that have plural forms, without the `_one` / `_other` suffix. */
export type PluralKey = { [K in MessageKey]: K extends `${infer B}_one` ? B : never }[MessageKey];

export const LANGS: readonly { id: Lang; label: string; short: string }[] = [
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'en', label: 'English', short: 'EN' },
];

const loaders: Record<Lang, () => Promise<Dict>> = {
  es: () => import('./es').then((m) => m.es),
  en: () => import('./en').then((m) => m.en),
};

const dicts: Partial<Record<Lang, Dict>> = {};
const listeners = new Set<() => void>();
let current: Lang = 'es';

/** Saved choice, or the device language (Spanish for Spanish devices, English otherwise). */
export function detectLang(): Lang {
  const saved = readString(KEYS.lang);
  if (saved) return toLang(saved);
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

async function load(lang: Lang) {
  dicts[lang] ??= await loaders[lang]();
}

function apply(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  for (const fn of listeners) fn();
}

/** Loads the saved (or device) language. Runs once, before the first render. */
export async function initI18n() {
  const lang = detectLang();
  await load(lang);
  apply(lang);
}

export async function setLang(lang: Lang) {
  await load(lang);
  writeString(KEYS.lang, lang);
  if (lang !== current) apply(lang);
}

export const getLang = () => current;

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(onLangChange, getLang);
}

function fill(s: string, params?: Params) {
  return params ? s.replace(/\{(\w+)\}/g, (match, k: string) => String(params[k] ?? match)) : s;
}

/** Translated message, with `{name}` placeholders filled from params. */
export function t(key: MessageKey, params?: Params): string {
  return fill(dicts[current]?.[key] ?? key, params);
}

/** Plural message: `<base>_one` when n is 1, `<base>_other` otherwise ({n} is filled in). */
export function tn(base: PluralKey, n: number, params?: Params): string {
  return t(`${base}_${n === 1 ? 'one' : 'other'}` as MessageKey, { n, ...params });
}

/** BCP 47 locale for Intl formatting. */
export const locale = () => LOCALE[current];
