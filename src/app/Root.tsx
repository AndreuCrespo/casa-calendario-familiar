// Picks what to show: demo mode, the sign-in screens or the household.
import { onAuthStateChanged, type User } from 'firebase/auth';
import { lazy, useEffect, useState } from 'react';
import { LocalBackend } from '../core/backend/local';
import { firebase, firebaseEnabled } from '../core/firebase';
import { getLang } from '../i18n';
import { HouseholdGate } from './HouseholdGate';
import { HouseholdRoot } from './HouseholdRoot';
import { Splash } from './Screens';

const Welcome = lazy(() => import('../features/auth/Welcome'));
const Login = lazy(() => import('../features/auth/Login'));

const DEMO_USER = { uid: 'demo-user', name: 'Alex', email: null };

export function Root() {
  const [demo, setDemo] = useState(() => !firebaseEnabled && LocalBackend.hasData());
  if (demo) {
    return (
      <DemoRoot
        onExit={() => {
          LocalBackend.reset();
          setDemo(false);
        }}
      />
    );
  }
  if (!firebaseEnabled) {
    return (
      <Welcome
        onDemo={async () => {
          const { seedDemo } = await import('../features/demo/seed');
          seedDemo(getLang());
          setDemo(true);
        }}
      />
    );
  }
  return <FirebaseRoot />;
}

function DemoRoot({ onExit }: { onExit: () => void }) {
  const [backend] = useState(() => new LocalBackend());
  return <HouseholdRoot backend={backend} user={DEMO_USER} demo onSignOut={onExit} />;
}

function FirebaseRoot() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(firebase().auth, setUser), []);
  if (user === undefined) return <Splash />;
  if (!user) return <Login />;
  return <HouseholdGate key={user.uid} user={user} />;
}
