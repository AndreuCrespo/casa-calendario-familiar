// Light/dark theme. The preference can be 'auto' (follow the system); the
// resolved theme is always written to <html data-theme>, which the CSS uses.
import { KEYS, readChoice, writeString } from './storage';

export const THEMES = ['auto', 'light', 'dark'] as const;
export type ThemePref = (typeof THEMES)[number];

const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

export const getTheme = (): ThemePref => readChoice(KEYS.theme, THEMES, 'auto');

export function applyTheme(pref: ThemePref = getTheme()) {
  const dark = pref === 'dark' || (pref === 'auto' && systemDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.setAttribute('content', dark ? '#141519' : '#F4EEE5');
  }
}

export function setTheme(pref: ThemePref) {
  writeString(KEYS.theme, pref);
  applyTheme(pref);
}

/** Applies the saved theme and follows system changes while it's 'auto'. */
export function initTheme() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
}
