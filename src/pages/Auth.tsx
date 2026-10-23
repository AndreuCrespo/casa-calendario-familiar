import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, getRedirectResult, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, updateProfile, type User,
} from 'firebase/auth';
import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { MapPin, Minus, Plus, UserRound } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { isIOS, isStandalone } from '../lib/push';
import { MEMBER_COLORS, newMemberId } from '../lib/members';
import { LocationSearch } from '../components/LocationSearch';
import { LangSwitch } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import type { Household, Member } from '../shared/types';

const AUTH_ERRORS: Record<string, MessageKey> = {
  'auth/invalid-credential': 'auth.err.invalidCredential',
  'auth/invalid-email': 'auth.err.invalidEmail',
  'auth/user-not-found': 'auth.err.userNotFound',
  'auth/wrong-password': 'auth.err.wrongPassword',
  'auth/email-already-in-use': 'auth.err.emailInUse',
  'auth/weak-password': 'auth.err.weakPassword',
  'auth/too-many-requests': 'auth.err.tooManyRequests',
  'auth/popup-closed-by-user': 'auth.err.popupClosed',
  'auth/network-request-failed': 'auth.err.network',
  'auth/operation-not-allowed': 'auth.err.notAllowed',
  'auth/unauthorized-domain': 'auth.err.unauthorizedDomain',
};

function authError(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  return AUTH_ERRORS[code] ? t(AUTH_ERRORS[code]) : t('auth.err.generic', { code: code || String(e) });
}

/** Common frame of the sign-in screens: app icon plus the language switch. */
function AuthScreen({ children, top }: { children: ReactNode; top?: boolean }) {
  return (
    <div className="auth" style={top ? { justifyContent: 'flex-start' } : undefined}>
      <div className="auth-top">
        <img className="auth-logo" src="/favicon.svg" alt="Casa" width={72} height={72} />
        <LangSwitch />
      </div>
      {children}
    </div>
  );
}

export function Welcome({ onDemo }: { onDemo: () => void }) {
  return (
    <AuthScreen>
      <div>
        <h1>Casa</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t('app.tagline')}</p>
      </div>
      <div className="card flat stack" style={{ gap: 8 }}>
        <b>{t('welcome.notConfigured')}</b>
        <p className="small muted">{t('welcome.help')}</p>
      </div>
      <button className="btn accent block" onClick={onDemo}>{t('welcome.tryDemo')}</button>
    </AuthScreen>
  );
}

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRedirectResult(auth!).catch((e) => setErr(authError(e)));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'in') {
        await signInWithEmailAndPassword(auth!, email.trim(), pass);
      } else {
        const cred = await createUserWithEmailAndPassword(auth!, email.trim(), pass);
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
      if (isStandalone() || isIOS()) await signInWithRedirect(auth!, provider);
      else await signInWithPopup(auth!, provider);
    } catch (e2) {
      setErr(authError(e2));
    }
  };

  const reset = async () => {
    if (!email.trim()) { setErr(t('auth.resetNeedEmail')); return; }
    try {
      await sendPasswordResetEmail(auth!, email.trim());
      setInfo(t('auth.resetSent'));
    } catch (e2) {
      setErr(authError(e2));
    }
  };

  return (
    <AuthScreen>
      <div>
        <h1>{mode === 'in' ? t('auth.welcomeBack') : t('auth.createAccountTitle')}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t('app.tagline')}</p>
      </div>
      <form className="stack" onSubmit={submit}>
        {mode === 'up' && (
          <label className="field"><span>{t('auth.yourName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
          </label>
        )}
        <label className="field"><span>{t('auth.email')}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field"><span>{t('auth.password')}</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
        </label>
        {err && <div className="error">{err}</div>}
        {info && <div className="small" style={{ color: 'var(--green)', fontWeight: 650 }}>{info}</div>}
        <button className="btn accent block" disabled={busy}>{mode === 'in' ? t('auth.signIn') : t('auth.createAccount')}</button>
      </form>
      <div className="divider">{t('auth.or')}</div>
      <button className="btn soft block" onClick={google}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {t('auth.google')}
      </button>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 4, margin: '0 -8px' }}>
        <button className="btn ghost sm" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
          {mode === 'in' ? t('auth.newAccount') : t('auth.haveAccount')}
        </button>
        {mode === 'in' && <button className="btn ghost sm" onClick={reset}>{t('auth.forgot')}</button>}
      </div>
    </AuthScreen>
  );
}

export function Onboarding({ user }: { user: User }) {
  const [houseName, setHouseName] = useState(t('onboarding.defaultHouse'));
  const [me, setMe] = useState(user.displayName?.split(' ')[0] ?? '');
  const [partner, setPartner] = useState('');
  const [kids, setKids] = useState<string[]>(['', '']);
  const [loc, setLoc] = useState<Household['location']>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    if (!me.trim()) { setErr(t('onboarding.needName')); return; }
    setBusy(true);
    const members: Member[] = [
      { id: newMemberId(), name: me.trim(), color: MEMBER_COLORS[0], kind: 'adult', uid: user.uid },
    ];
    if (partner.trim()) members.push({ id: newMemberId(), name: partner.trim(), color: MEMBER_COLORS[1], kind: 'adult', uid: null });
    kids.filter((k) => k.trim()).forEach((k, i) =>
      members.push({ id: newMemberId(), name: k.trim(), color: MEMBER_COLORS[2 + i] ?? MEMBER_COLORS[i], kind: 'child' }));
    const ref = doc(collection(db!, 'households'));
    const h: Omit<Household, 'id'> = {
      name: houseName.trim() || t('onboarding.defaultHouse'),
      memberUids: [user.uid],
      members,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
      location: loc,
      notify: { dailySummary: true, dailyHour: 8, activity: true },
      createdAt: Date.now(),
    };
    try {
      await setDoc(ref, h);
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <AuthScreen top>
      <div>
        <h1>{t('onboarding.title')}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t('onboarding.subtitle')}</p>
      </div>
      <label className="field"><span>{t('onboarding.houseName')}</span>
        <input value={houseName} onChange={(e) => setHouseName(e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field"><span>{t('auth.yourName')}</span>
          <input value={me} onChange={(e) => setMe(e.target.value)} />
        </label>
        <label className="field"><span>{t('onboarding.partner')}</span>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder={t('onboarding.namePlaceholder')} />
        </label>
      </div>
      <div className="field">
        <span>{t('onboarding.kids')}</span>
        <div className="stack" style={{ gap: 8 }}>
          {kids.map((k, i) => (
            <div className="row" key={i}>
              <span className="dot" style={{ background: MEMBER_COLORS[2 + i] ?? MEMBER_COLORS[i], width: 12, height: 12 }} />
              <input className="input grow" value={k} placeholder={t('onboarding.kidPlaceholder', { n: i + 1 })}
                onChange={(e) => setKids(kids.map((x, j) => (j === i ? e.target.value : x)))} />
              <button className="icon-btn" type="button" onClick={() => setKids(kids.filter((_, j) => j !== i))} aria-label={t('common.remove')}><Minus size={18} /></button>
            </div>
          ))}
          <button className="btn ghost sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setKids([...kids, ''])}>
            <Plus size={16} /> {t('common.add')}
          </button>
        </div>
      </div>
      <div className="field">
        <span>{t('onboarding.city')}</span>
        {loc ? (
          <div className="row card flat" style={{ padding: '10px 12px' }}>
            <MapPin size={18} /> <b className="grow">{loc.name}</b>
            <button className="btn ghost sm" onClick={() => setLoc(null)}>{t('common.change')}</button>
          </div>
        ) : (
          <LocationSearch onPick={(r) => setLoc({ name: r.name, lat: r.lat, lon: r.lon })} />
        )}
      </div>
      {err && <div className="error">{err}</div>}
      <button className="btn accent block" onClick={create} disabled={busy}>{t('onboarding.create')}</button>
    </AuthScreen>
  );
}

export function Join({ hid, user, onCancel }: { hid: string; user: User; onCancel: () => void }) {
  const [h, setH] = useState<Household | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getDoc(doc(db!, 'households', hid)).then(
      (d) => setH(d.exists() ? ({ ...d.data(), id: d.id } as Household) : null),
      () => setH(null),
    );
  }, [hid]);

  const join = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db!, 'households', hid), { memberUids: arrayUnion(user.uid) });
      localStorage.removeItem('casa-join');
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      {h === undefined && <p className="muted">{t('join.looking')}</p>}
      {h === null && (
        <>
          <h1>{t('join.invalidTitle')}</h1>
          <p className="muted">{t('join.invalidText')}</p>
          <button className="btn soft block" onClick={onCancel}>{t('join.createInstead')}</button>
        </>
      )}
      {h && (
        <>
          <div>
            <h1>{t('join.title', { name: h.name })}</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              {h.members.map((m) => m.name).join(', ')}
            </p>
          </div>
          {err && <div className="error">{err}</div>}
          <button className="btn accent block" onClick={join} disabled={busy}>{t('join.join')}</button>
          <button className="btn ghost block" onClick={onCancel}>{t('join.noCreateOther')}</button>
        </>
      )}
    </AuthScreen>
  );
}

/** After joining: pick which household member you are. */
export function ClaimMember({ household, user, onClaim }: {
  household: Household;
  user: User | { uid: string; displayName: string | null };
  onClaim: (members: Member[]) => void;
}) {
  const free = household.members.filter((m) => m.kind === 'adult' && !m.uid);
  const [name, setName] = useState(user.displayName?.split(' ')[0] ?? '');

  const claim = (id: string) => onClaim(household.members.map((m) => (m.id === id ? { ...m, uid: user.uid } : m)));
  const addNew = () => {
    if (!name.trim()) return;
    const used = new Set(household.members.map((m) => m.color));
    onClaim([...household.members, {
      id: newMemberId(), name: name.trim(), kind: 'adult', uid: user.uid,
      color: MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[0],
    }]);
  };

  return (
    <AuthScreen>
      <div>
        <h1>{t('claim.title')}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t('claim.subtitle')}</p>
      </div>
      {free.length > 0 && (
        <div className="list">
          {free.map((m) => (
            <button key={m.id} className="list-item clickable" style={{ width: '100%' }} onClick={() => claim(m.id)}>
              <span className="avatar" style={{ '--c': m.color } as CSSProperties}>{m.name[0]}</span>
              <b className="grow" style={{ textAlign: 'left' }}>{m.name}</b>
            </button>
          ))}
        </div>
      )}
      <div className="field">
        <span>{free.length ? t('claim.addNew') : t('auth.yourName')}</span>
        <div className="row">
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn soft" onClick={addNew}><UserRound size={18} /> {t('claim.itsMe')}</button>
        </div>
      </div>
    </AuthScreen>
  );
}
