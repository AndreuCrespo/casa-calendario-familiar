// App frame: navigation (bottom bar on phones, side rail on large screens) and
// the current section.
import { WifiOff } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useApp, useCollection, useDataFailing, useTime, useToday } from '../core/app';
import { expiredDoneTasks } from '../features/tasks/tasks';
import { t } from '../i18n';
import { Spinner } from '../ui/primitives';
import { ErrorBoundary } from './ErrorBoundary';
import { href, type Route, useRoute } from './router';
import { IN_MORE, SECTIONS, section } from './sections';

function RailClock() {
  const [h, m] = useTime().split(':');
  return (
    <div className="nav-clock num" aria-hidden="true">
      <span>{h}</span>
      <br />
      <span>{m}</span>
    </div>
  );
}

/** Deletes one-off tasks completed long ago, once per session. */
function useTaskCleanup() {
  const { backend } = useApp();
  const tasks = useCollection('tasks');
  const done = useRef(false);
  useEffect(() => {
    if (!tasks || done.current) return;
    done.current = true;
    for (const x of expiredDoneTasks(tasks)) backend.remove('tasks', x.id);
  }, [tasks, backend]);
}

export function Shell() {
  const { route } = useRoute();
  const today = useToday();
  const shopping = useCollection('shopping');
  const tasks = useCollection('tasks');
  const failing = useDataFailing();
  useTaskCleanup();

  const badges = useMemo<Partial<Record<Route, number>>>(
    () => ({
      shopping: shopping?.filter((s) => !s.done).length ?? 0,
      tasks: tasks?.filter((x) => !x.done && x.due && x.due <= today).length ?? 0,
    }),
    [shopping, tasks, today],
  );

  const current = section(route);
  const Page = current.page;

  return (
    <>
      <nav className="nav" aria-label={t('nav.main')}>
        {SECTIONS.map((s) => {
          const active = s.route === route || (s.route === 'more' && IN_MORE.includes(route));
          const where = s.nav === 'narrow' ? ' hide-wide' : s.nav === 'wide' ? ' hide-narrow' : '';
          const badge = badges[s.route];
          return (
            <a
              key={s.route}
              href={href(s.route)}
              className={`nav-item${active ? ' active' : ''}${where}`}
              aria-current={s.route === route ? 'page' : undefined}
              onClick={(e) => {
                // Like native apps: switching tabs doesn't pile up history, so Android's
                // back gesture returns to Home, and from Home it leaves the app.
                if (s.route === route) {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (route !== 'home') {
                  e.preventDefault();
                  location.replace(href(s.route));
                }
              }}
            >
              <span className="nav-ic" aria-hidden="true">
                <s.icon size={22} strokeWidth={active ? 2.3 : 1.9} />
              </span>
              <span className="nav-label">{t(s.label)}</span>
              {!!badge && (
                <span className="nav-badge">
                  {badge}
                  <span className="sr-only"> {t('nav.pending')}</span>
                </span>
              )}
            </a>
          );
        })}
        <RailClock />
      </nav>
      <main className={`main${current.wide ? '' : ' narrow'}`}>
        {failing && (
          <div className="banner warn" role="status">
            <WifiOff size={20} aria-hidden="true" />
            <div>{t('error.loading')}</div>
          </div>
        )}
        <ErrorBoundary key={route}>
          <Suspense
            fallback={
              <div className="center pad-60">
                <Spinner />
              </div>
            }
          >
            <Page />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
