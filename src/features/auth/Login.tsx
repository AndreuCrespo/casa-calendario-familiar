import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import { type FormEvent, useEffect, useState } from 'react';
import { firebase } from '../../core/firebase';
import { isIOS, isStandalone } from '../../core/platform';
import { t } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import { AuthScreen } from './AuthScreen';
import { authError } from './authErrors';

export default function Login() {
  const { auth } = firebase();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // Coming back from Google's sign-in page (installed app and iPhone).
  useEffect(() => {
    getRedirectResult(auth, browserPopupRedirectResolver).catch((e: unknown) => setErr(authError(e)));
  }, [auth]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'in') {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (e2) {
      setErr(authError(e2));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      // Popups fail in the installed app (especially on iPhone): use a redirect there.
      if (isStandalone() || isIOS()) await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
      else await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (e2) {
      setErr(authError(e2));
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      setErr(t('auth.resetNeedEmail'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      // The same message whether or not the account exists.
      setInfo(t('auth.resetSent'));
    } catch (e2) {
      setErr(authError(e2));
    }
  };

  return (
    <AuthScreen>
      <div>
        <h1>{mode === 'in' ? t('auth.welcomeBack') : t('auth.createAccountTitle')}</h1>
        <p className="muted mt-6">{t('app.tagline')}</p>
      </div>
      <form className="stack" onSubmit={submit}>
        {mode === 'up' && (
          <label className="field">
            <span>{t('auth.yourName')}</span>
            <input
              value={name}
              maxLength={LIMITS.memberName}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </label>
        )}
        <label className="field">
          <span>{t('auth.email')}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={mode === 'in' ? 6 : 8}
            required
          />
        </label>
        {err && (
          <div className="error" role="alert">
            {err}
          </div>
        )}
        {info && (
          <div className="info" role="status">
            {info}
          </div>
        )}
        <button type="submit" className="btn accent block" disabled={busy}>
          {mode === 'in' ? t('auth.signIn') : t('auth.createAccount')}
        </button>
      </form>
      <div className="divider">{t('auth.or')}</div>
      <button type="button" className="btn soft block" onClick={google}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
          />
        </svg>
        {t('auth.google')}
      </button>
      <div className="row wrap between auth-links">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setErr('');
          }}
        >
          {mode === 'in' ? t('auth.newAccount') : t('auth.haveAccount')}
        </button>
        {mode === 'in' && (
          <button type="button" className="btn ghost sm" onClick={reset}>
            {t('auth.forgot')}
          </button>
        )}
      </div>
    </AuthScreen>
  );
}
