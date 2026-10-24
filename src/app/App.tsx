import { Suspense } from 'react';
import { useLang } from '../i18n';
import { ToastHost } from '../ui/Toast';
import { ErrorBoundary } from './ErrorBoundary';
import { Root } from './Root';
import { Splash } from './Screens';

/** Remounts the app when the language changes, so every text is rendered again. */
export function App() {
  const lang = useLang();
  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<Splash />}>
          <Root key={lang} />
        </Suspense>
      </ErrorBoundary>
      <ToastHost />
    </>
  );
}
