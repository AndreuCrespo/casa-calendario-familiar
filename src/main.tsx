import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { captureInviteFromUrl } from './core/households';
import { captureInstallPrompt } from './core/platform';
import { initTheme } from './core/theme';
import { initI18n } from './i18n';
import './styles/index.css';

// Before anything else: these only happen once, early in the page load.
captureInstallPrompt();
captureInviteFromUrl();
initTheme();

// A new version is installed in the background and switched to the next time
// the app is hidden, so nobody loses what they're typing.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const apply = () => {
      if (document.visibilityState === 'hidden') updateSW(true);
    };
    apply();
    document.addEventListener('visibilitychange', apply);
  },
  // An always-open screen (a wall display) still checks for updates hourly.
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update().catch(() => {}), 3_600_000);
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

initI18n().then(() =>
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
