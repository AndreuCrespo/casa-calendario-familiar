/// <reference lib="webworker" />
// Service worker: offline app shell (precache) and push notifications.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// A new version waits until the page asks for it (see main.tsx), so it never
// replaces the app while someone is using it.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/__\//], // Firebase's reserved URLs (sign-in handler)
  }),
);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Casa', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

/** Notification links only ever open pages of this app. */
function appUrl(raw: unknown) {
  try {
    const url = new URL(typeof raw === 'string' ? raw : '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin;
  } catch {
    return self.location.origin;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = appUrl(event.notification.data?.url);
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if (!w.url.startsWith(self.location.origin)) continue;
        try {
          await w.focus();
          await w.navigate(url);
          return;
        } catch {
          // A window this worker doesn't control can't be navigated: open a new one.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
