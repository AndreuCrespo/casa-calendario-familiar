import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { applyTheme } from './lib/theme';
import Root from './Root';

// Enlace de invitación: /?join=<id de la casa>
const join = new URLSearchParams(location.search).get('join');
if (join) {
  localStorage.setItem('casa-join', join);
  history.replaceState(null, '', location.pathname + location.hash);
}

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
