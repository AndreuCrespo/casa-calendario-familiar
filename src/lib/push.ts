// Suscripción Web Push (VAPID). El envío lo hace notifier/ desde GitHub Actions.
import type { Backend } from './backend';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export type PushStatus = 'unsupported' | 'needs-install' | 'no-key' | 'denied' | 'off' | 'on';

export async function pushStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY) return 'no-key';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function deviceId(endpoint: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function enablePush(backend: Backend, uid: string) {
  if (!VAPID_PUBLIC_KEY) throw new Error('Falta VITE_VAPID_PUBLIC_KEY');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  await backend.set('devices', await deviceId(sub.endpoint), {
    uid,
    subscription: { endpoint: json.endpoint, keys: json.keys },
    ua: navigator.userAgent.slice(0, 200),
    createdAt: Date.now(),
  });
}

export async function disablePush(backend: Backend) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await backend.remove('devices', await deviceId(sub.endpoint));
  await sub.unsubscribe();
}
