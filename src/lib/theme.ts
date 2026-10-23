export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'casa-theme';

export function getTheme(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: ThemePref = getTheme()) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', dark ? '#141519' : '#F4EEE5');
  });
}

export function setTheme(t: ThemePref) {
  try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
  applyTheme(t);
}
