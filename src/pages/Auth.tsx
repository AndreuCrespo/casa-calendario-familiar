import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, getRedirectResult, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, updateProfile, type User,
} from 'firebase/auth';
import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { CalendarHeart, MapPin, Minus, Plus, UserRound } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { isIOS, isStandalone } from '../lib/push';
import { MEMBER_COLORS, newMemberId } from '../lib/members';
import { LocationSearch } from '../components/LocationSearch';
import type { Household, Member } from '../shared/types';

function authError(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/user-not-found': 'No existe ninguna cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Entra en lugar de crearla.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/popup-closed-by-user': 'Has cerrado la ventana de Google.',
    'auth/network-request-failed': 'Sin conexión a internet.',
    'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
  };
  return map[code] ?? `No se pudo entrar (${code || String(e)})`;
}

function Logo() {
  return <div className="auth-logo"><CalendarHeart size={36} /></div>;
}

export function Welcome({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="auth">
      <Logo />
      <div>
        <h1>Casa</h1>
        <p className="muted" style={{ marginTop: 6 }}>Calendario compartido y cosas de casa.</p>
      </div>
      <div className="card flat stack" style={{ gap: 8 }}>
        <b>Firebase aún no está configurado</b>
        <p className="small muted">
          Sigue la guía del README para crear el proyecto (gratis) y rellenar <code>.env.local</code>.
          Mientras tanto puedes probar la app con datos de ejemplo guardados solo en este navegador.
        </p>
      </div>
      <button className="btn accent block" onClick={onDemo}>Probar en modo demo</button>
    </div>
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

  const submit = async (e: React.FormEvent) => {
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
      // En la app instalada (sobre todo iPhone) las ventanas emergentes fallan: usamos redirección.
      if (isStandalone() || isIOS()) await signInWithRedirect(auth!, provider);
      else await signInWithPopup(auth!, provider);
    } catch (e2) {
      setErr(authError(e2));
    }
  };

  const reset = async () => {
    if (!email.trim()) { setErr('Escribe tu email y vuelve a pulsar.'); return; }
    try {
      await sendPasswordResetEmail(auth!, email.trim());
      setInfo('Te hemos enviado un email para cambiar la contraseña.');
    } catch (e2) {
      setErr(authError(e2));
    }
  };

  return (
    <div className="auth">
      <Logo />
      <div>
        <h1>{mode === 'in' ? 'Hola de nuevo' : 'Crea tu cuenta'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>Calendario compartido y cosas de casa.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        {mode === 'up' && (
          <label className="field"><span>Tu nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
          </label>
        )}
        <label className="field"><span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field"><span>Contraseña</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
        </label>
        {err && <div className="error">{err}</div>}
        {info && <div className="small" style={{ color: 'var(--green)', fontWeight: 650 }}>{info}</div>}
        <button className="btn accent block" disabled={busy}>{mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <div className="divider">o</div>
      <button className="btn soft block" onClick={google}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continuar con Google
      </button>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 4, margin: '0 -8px' }}>
        <button className="btn ghost sm" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
          {mode === 'in' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
        </button>
        {mode === 'in' && <button className="btn ghost sm" onClick={reset}>¿Olvidaste la contraseña?</button>}
      </div>
    </div>
  );
}

export function Onboarding({ user }: { user: User }) {
  const [houseName, setHouseName] = useState('Casa');
  const [me, setMe] = useState(user.displayName?.split(' ')[0] ?? '');
  const [partner, setPartner] = useState('');
  const [kids, setKids] = useState<string[]>(['', '']);
  const [loc, setLoc] = useState<Household['location']>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    if (!me.trim()) { setErr('Escribe tu nombre.'); return; }
    setBusy(true);
    const members: Member[] = [
      { id: newMemberId(), name: me.trim(), color: MEMBER_COLORS[0], kind: 'adult', uid: user.uid },
    ];
    if (partner.trim()) members.push({ id: newMemberId(), name: partner.trim(), color: MEMBER_COLORS[1], kind: 'adult', uid: null });
    kids.filter((k) => k.trim()).forEach((k, i) =>
      members.push({ id: newMemberId(), name: k.trim(), color: MEMBER_COLORS[2 + i] ?? MEMBER_COLORS[i], kind: 'child' }));
    const ref = doc(collection(db!, 'households'));
    const h: Omit<Household, 'id'> = {
      name: houseName.trim() || 'Casa',
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
    <div className="auth" style={{ justifyContent: 'flex-start' }}>
      <Logo />
      <div>
        <h1>Vamos a preparar tu casa</h1>
        <p className="muted" style={{ marginTop: 6 }}>Podrás cambiarlo todo después en Ajustes.</p>
      </div>
      <label className="field"><span>Nombre de la casa</span>
        <input value={houseName} onChange={(e) => setHouseName(e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field"><span>Tu nombre</span>
          <input value={me} onChange={(e) => setMe(e.target.value)} />
        </label>
        <label className="field"><span>Tu pareja</span>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Nombre" />
        </label>
      </div>
      <div className="field">
        <span>Hijos/as (sin cuenta, los gestionáis vosotros)</span>
        <div className="stack" style={{ gap: 8 }}>
          {kids.map((k, i) => (
            <div className="row" key={i}>
              <span className="dot" style={{ background: MEMBER_COLORS[2 + i] ?? MEMBER_COLORS[i], width: 12, height: 12 }} />
              <input className="input grow" value={k} placeholder={`Nombre ${i + 1}`}
                onChange={(e) => setKids(kids.map((x, j) => (j === i ? e.target.value : x)))} />
              <button className="icon-btn" type="button" onClick={() => setKids(kids.filter((_, j) => j !== i))} aria-label="Quitar"><Minus size={18} /></button>
            </div>
          ))}
          <button className="btn ghost sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setKids([...kids, ''])}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>
      <div className="field">
        <span>Ciudad (para el tiempo)</span>
        {loc ? (
          <div className="row card flat" style={{ padding: '10px 12px' }}>
            <MapPin size={18} /> <b className="grow">{loc.name}</b>
            <button className="btn ghost sm" onClick={() => setLoc(null)}>Cambiar</button>
          </div>
        ) : (
          <LocationSearch onPick={(r) => setLoc({ name: r.name, lat: r.lat, lon: r.lon })} />
        )}
      </div>
      {err && <div className="error">{err}</div>}
      <button className="btn accent block" onClick={create} disabled={busy}>Crear casa</button>
    </div>
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
    <div className="auth">
      <Logo />
      {h === undefined && <p className="muted">Buscando la casa…</p>}
      {h === null && (
        <>
          <h1>Invitación no válida</h1>
          <p className="muted">El enlace no corresponde a ninguna casa. Pide uno nuevo.</p>
          <button className="btn soft block" onClick={onCancel}>Crear una casa nueva</button>
        </>
      )}
      {h && (
        <>
          <div>
            <h1>Únete a «{h.name}»</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              {h.members.map((m) => m.name).join(', ')}
            </p>
          </div>
          {err && <div className="error">{err}</div>}
          <button className="btn accent block" onClick={join} disabled={busy}>Unirme</button>
          <button className="btn ghost block" onClick={onCancel}>No, crear otra casa</button>
        </>
      )}
    </div>
  );
}

/** Tras unirse: elegir qué miembro de la casa eres. */
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
    <div className="auth">
      <Logo />
      <div>
        <h1>¿Quién eres?</h1>
        <p className="muted" style={{ marginTop: 6 }}>Así sabremos qué cosas son tuyas.</p>
      </div>
      {free.length > 0 && (
        <div className="list">
          {free.map((m) => (
            <button key={m.id} className="list-item clickable" style={{ width: '100%' }} onClick={() => claim(m.id)}>
              <span className="avatar" style={{ '--c': m.color } as React.CSSProperties}>{m.name[0]}</span>
              <b className="grow" style={{ textAlign: 'left' }}>{m.name}</b>
            </button>
          ))}
        </div>
      )}
      <div className="field">
        <span>{free.length ? 'O añádete como alguien nuevo' : 'Tu nombre'}</span>
        <div className="row">
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn soft" onClick={addNew}><UserRound size={18} /> Soy yo</button>
        </div>
      </div>
    </div>
  );
}
