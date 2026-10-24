import { type MessageKey, t } from '../../i18n';

const AUTH_ERRORS: Record<string, MessageKey> = {
  'auth/invalid-credential': 'auth.err.invalidCredential',
  'auth/invalid-email': 'auth.err.invalidEmail',
  'auth/user-not-found': 'auth.err.userNotFound',
  'auth/wrong-password': 'auth.err.wrongPassword',
  'auth/email-already-in-use': 'auth.err.emailInUse',
  'auth/weak-password': 'auth.err.weakPassword',
  'auth/password-does-not-meet-requirements': 'auth.err.weakPassword',
  'auth/too-many-requests': 'auth.err.tooManyRequests',
  'auth/popup-closed-by-user': 'auth.err.popupClosed',
  'auth/network-request-failed': 'auth.err.network',
  'auth/operation-not-allowed': 'auth.err.notAllowed',
  'auth/unauthorized-domain': 'auth.err.unauthorizedDomain',
};

/** Friendly message for a Firebase Auth error. */
export function authError(e: unknown) {
  const code = (e as { code?: string } | null)?.code ?? '';
  const key = AUTH_ERRORS[code];
  return key ? t(key) : t('auth.err.generic', { code: code || String(e) });
}
