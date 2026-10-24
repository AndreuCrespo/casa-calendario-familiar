// Web Push subscription (VAPID). The Cloud Functions in functions/ send the notifications.
import type { Backend } from '../../core/backend/types';
import { isIOS, isStandalone } from '../../core/platform';
import { getLang, t } from '../../i18n';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export type PushStatus = 'unsupported' | 'needs-install' | 'no-key' | 'denied' | 'off' | 'on';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY) return 'no-key';
  if (!supported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await currentSubscription()) ? 'on' : 'off';
}

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Device document id: derived from the subscription, so re-subscribing overwrites it. */
async function deviceId(endpoint: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function enablePush(backend: Backend, uid: string) {
  if (!VAPID_PUBLIC_KEY) throw new Error(t('push.noKey'));
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(t('push.permissionDenied'));
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY),
  });
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error(t('push.unsupported'));
  try {
    await backend.set('devices', await deviceId(sub.endpoint), {
      uid,
      subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      ua: navigator.userAgent.slice(0, 300),
      createdAt: Date.now(),
      lang: getLang(),
    });
  } catch (e) {
    // Without the device document nothing would arrive: don't leave it half on.
    await sub.unsubscribe();
    throw e;
  }
}

/** Updates the notification language of this device, if notifications are on here. */
export async function updatePushLang(backend: Backend) {
  const sub = await currentSubscription();
  if (sub) await backend.update('devices', await deviceId(sub.endpoint), { lang: getLang() });
}

export async function disablePush(backend: Backend) {
  const sub = await currentSubscription();
  if (!sub) return;
  await backend.remove('devices', await deviceId(sub.endpoint));
  await sub.unsubscribe();
}
