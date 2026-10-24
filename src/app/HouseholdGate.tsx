// Signed in: find the user's household, or let them create or join one.
import type { User } from 'firebase/auth';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { FirestoreBackend } from '../core/backend/firestore';
import { firebase } from '../core/firebase';
import { clearPendingInvite, readPendingInvite, watchMyHouseholds } from '../core/households';
import { signOutAndClear } from '../core/session';
import { KEYS, readString, writeString } from '../core/storage';
import { disablePush } from '../features/notifications/push';
import { t } from '../i18n';
import { HouseholdRoot } from './HouseholdRoot';
import { ProblemScreen, Splash } from './Screens';

const Onboarding = lazy(() => import('../features/auth/Onboarding'));
const Join = lazy(() => import('../features/auth/Join'));

export function HouseholdGate({ user }: { user: User }) {
  const { db } = firebase();
  const [ids, setIds] = useState<string[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [invite, setInvite] = useState(readPendingInvite);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` restarts the listener after an error
  useEffect(
    () =>
      watchMyHouseholds(
        db,
        user.uid,
        (list) => {
          setFailed(false);
          setIds(list);
        },
        (e) => {
          console.error(e);
          setFailed(true);
        },
      ),
    [db, user.uid, attempt],
  );

  // With several households, the one used last.
  const hid = ids && (ids.find((id) => id === readString(KEYS.household)) ?? ids[0]);

  useEffect(() => {
    if (!hid) return;
    writeString(KEYS.household, hid);
    // Already in a household: an invite opened meanwhile no longer applies.
    clearPendingInvite();
    setInvite(null);
  }, [hid]);

  const backend = useMemo(() => (hid ? new FirestoreBackend(db, hid) : null), [db, hid]);
  const appUser = useMemo(
    () => ({ uid: user.uid, name: user.displayName ?? user.email ?? '', email: user.email }),
    [user],
  );
  const signOut = useCallback(
    () => signOutAndClear(firebase(), backend ? () => disablePush(backend) : undefined),
    [backend],
  );

  // An error before knowing the household: never assume there is none (that
  // would offer to create a second one).
  if (ids === undefined && failed) {
    return (
      <ProblemScreen title={t('gate.errorTitle')} text={t('gate.errorText')}>
        <button
          type="button"
          className="btn accent block"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          {t('common.retry')}
        </button>
        <button type="button" className="btn ghost block" onClick={signOut}>
          {t('settings.signOut')}
        </button>
      </ProblemScreen>
    );
  }
  if (ids === undefined) return <Splash />;
  if (!hid || !backend) {
    if (invite) {
      return (
        <Join
          invite={invite}
          user={user}
          onCancel={() => {
            clearPendingInvite();
            setInvite(null);
          }}
        />
      );
    }
    return <Onboarding user={user} />;
  }
  return <HouseholdRoot key={hid} backend={backend} user={appUser} onSignOut={signOut} />;
}
