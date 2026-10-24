// Inside a household: live data, the signed-in member and the app shell.
import { lazy, useEffect, useMemo, useState } from 'react';
import { AppProvider, type AppState, type AppUser } from '../core/app';
import type { Backend } from '../core/backend/types';
import { isValidTimezone } from '../core/households';
import { LiveStore } from '../core/store';
import { byId } from '../features/members/members';
import { t } from '../i18n';
import { LIMITS } from '../shared/limits';
import { clip } from '../shared/text';
import type { Household } from '../shared/types';
import { ProblemScreen, Splash } from './Screens';
import { Shell } from './Shell';

const ClaimMember = lazy(() => import('../features/auth/ClaimMember'));

export function HouseholdRoot({
  backend,
  user,
  demo = false,
  onSignOut,
}: {
  backend: Backend;
  user: AppUser;
  demo?: boolean;
  onSignOut: () => void;
}) {
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const store = useMemo(() => new LiveStore(backend), [backend]);

  // Every listener closes when leaving the household (sign-out, language change).
  useEffect(() => {
    store.resume();
    return () => store.stop();
  }, [store]);

  // If access is lost (removed from the household), the gate takes over.
  useEffect(() => backend.watchHousehold(setHousehold, () => setHousehold(null)), [backend]);

  const value = useMemo<AppState | null>(() => {
    if (!household) return null;
    const me = household.members.find((m) => m.uid === user.uid);
    return {
      backend,
      store,
      household,
      user,
      me,
      members: household.members,
      membersById: byId(household.members),
      adults: household.members.filter((m) => m.kind === 'adult'),
      tz: isValidTimezone(household.timezone) ? household.timezone : 'Europe/Madrid',
      demo,
      log: (kind, text) => {
        if (demo) return;
        // Only feeds notifications: a failure isn't worth bothering anyone.
        backend.add(
          'activity',
          {
            actorUid: user.uid,
            actorName: clip(me?.name ?? user.name, LIMITS.memberName),
            kind,
            text: clip(text, LIMITS.activityText),
            createdAt: Date.now(),
            notified: false,
          },
          { quiet: true },
        );
      },
      signOut: onSignOut,
    };
  }, [household, backend, store, user, demo, onSignOut]);

  if (household === undefined) return <Splash />;
  if (!household || !value) {
    return (
      <ProblemScreen title={t('gate.missingTitle')} text={t('gate.missingText')}>
        <button type="button" className="btn ghost block" onClick={onSignOut}>
          {t('settings.signOut')}
        </button>
      </ProblemScreen>
    );
  }
  if (!value.me) {
    return (
      <ClaimMember household={household} user={user} onClaim={(members) => backend.updateHousehold({ members })} />
    );
  }
  return (
    <AppProvider value={value}>
      <Shell />
    </AppProvider>
  );
}
