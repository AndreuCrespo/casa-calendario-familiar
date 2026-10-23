import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from './lib/firebase';
import { FirestoreBackend, LocalBackend, type Backend } from './lib/backend';
import { AppProvider, CollectionCache, type AppState, type AppUser } from './lib/app';
import { seedDemo } from './lib/demo';
import type { Household } from './shared/types';
import { ClaimMember, Join, Login, Onboarding, Welcome } from './pages/Auth';
import { Shell } from './Shell';
import { Spinner } from './components/ui';

function Splash() {
  return <div className="splash"><Spinner /></div>;
}

export default function Root() {
  const [demo, setDemo] = useState(() => !firebaseEnabled && LocalBackend.hasData());
  if (demo) return <DemoRoot onExit={() => { LocalBackend.reset(); setDemo(false); }} />;
  if (!firebaseEnabled) return <Welcome onDemo={() => { seedDemo(); setDemo(true); }} />;
  return <FirebaseRoot />;
}

function DemoRoot({ onExit }: { onExit: () => void }) {
  const backend = useMemo(() => new LocalBackend(), []);
  return (
    <HouseholdRoot
      backend={backend}
      user={{ uid: 'demo-user', name: 'Alex', email: null }}
      demo
      onSignOut={onExit}
    />
  );
}

function FirebaseRoot() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth!, setUser), []);
  if (user === undefined) return <Splash />;
  if (!user) return <Login />;
  return <HouseholdGate key={user.uid} user={user} />;
}

function HouseholdGate({ user }: { user: User }) {
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [pendingJoin, setPendingJoin] = useState(() => localStorage.getItem('casa-join'));

  useEffect(() => {
    const q = query(collection(db!, 'households'), where('memberUids', 'array-contains', user.uid));
    // Solo se entra en una casa ya confirmada por el servidor. Justo después de
    // crearla o de unirse, Firestore la muestra en local antes de guardarla, y
    // si entráramos ya, las reglas aún no nos verían como miembros (permiso denegado).
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const confirmed = snap.docs.find((d) => !d.metadata.hasPendingWrites);
      if (confirmed) setHid(confirmed.id);
      else if (!snap.docs.length) setHid(null);
    }, (e) => {
      console.error(e);
      setHid(null);
    });
  }, [user.uid]);

  useEffect(() => {
    if (hid && pendingJoin) { localStorage.removeItem('casa-join'); setPendingJoin(null); }
  }, [hid, pendingJoin]);

  const backend = useMemo(() => (hid ? new FirestoreBackend(db!, hid) : null), [hid]);

  if (hid === undefined) return <Splash />;
  if (!hid || !backend) {
    if (pendingJoin) {
      return <Join hid={pendingJoin} user={user} onCancel={() => { localStorage.removeItem('casa-join'); setPendingJoin(null); }} />;
    }
    return <Onboarding user={user} />;
  }
  return (
    <HouseholdRoot
      backend={backend}
      user={{ uid: user.uid, name: user.displayName ?? user.email ?? '', email: user.email }}
      onSignOut={() => signOut(auth!)}
    />
  );
}

function HouseholdRoot({ backend, user, demo = false, onSignOut }: {
  backend: Backend;
  user: AppUser;
  demo?: boolean;
  onSignOut: () => void;
}) {
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const cache = useMemo(() => new CollectionCache(backend), [backend]);

  useEffect(() => backend.watchHousehold(setHousehold), [backend]);

  const value = useMemo<AppState | null>(() => {
    if (!household) return null;
    const me = household.members.find((m) => m.uid === user.uid);
    return {
      backend,
      cache,
      household,
      user,
      me,
      members: household.members,
      adults: household.members.filter((m) => m.kind === 'adult'),
      tz: household.timezone || 'Europe/Madrid',
      demo,
      log: (kind, text) => {
        if (demo) return;
        backend.add('activity', {
          actorUid: user.uid, actorName: me?.name ?? user.name, kind, text, createdAt: Date.now(), notified: false,
        });
      },
      signOut: onSignOut,
    };
  }, [household, backend, cache, user, demo, onSignOut]);

  if (household === undefined) return <Splash />;
  if (!household || !value) return <Splash />;
  if (!value.me) {
    return (
      <ClaimMember
        household={household}
        user={{ uid: user.uid, displayName: user.name }}
        onClaim={(members) => backend.updateHousehold({ members })}
      />
    );
  }
  return (
    <AppProvider value={value}>
      <Shell />
    </AppProvider>
  );
}
