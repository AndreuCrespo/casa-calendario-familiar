// Platform detection and Android's install prompt.
import { useSyncExternalStore } from 'react';

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const fn of listeners) fn();
};

/**
 * Chrome fires `beforeinstallprompt` once, early in the page load, so this has
 * to run at startup (not in a lazily loaded screen).
 */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Whether Android's install dialog can be shown right now. */
export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferred !== null);
}

export async function promptInstall() {
  const e = deferred;
  deferred = null;
  emit();
  await e?.prompt();
}
