import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { applyTheme } from './lib/theme';
import { useLang } from './i18n';
import Root from './Root';

// Invite link: /?join=<household id>
const join = new URLSearchParams(location.search).get('join');
if (join) {
  localStorage.setItem('casa-join', join);
  history.replaceState(null, '', location.pathname + location.hash);
}

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
registerSW({ immediate: true });

/** Remounts the whole app when the language changes, so every text is re-rendered. */
function App() {
  const lang = useLang();
  return <Root key={lang} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
