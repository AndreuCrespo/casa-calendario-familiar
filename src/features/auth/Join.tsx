import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { firebase } from '../../core/firebase';
import { getInvite, joinHousehold, type PendingInvite } from '../../core/households';
import { t } from '../../i18n';
import type { Invite } from '../../shared/types';
import { AuthScreen } from './AuthScreen';

/** Opened from an invite link: join that household (or create another one). */
export default function Join({ invite, user, onCancel }: { invite: PendingInvite; user: User; onCancel: () => void }) {
  const [found, setFound] = useState<Invite | null | undefined>(invite.code ? undefined : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!invite.code) return;
    let alive = true;
    getInvite(firebase().db, invite.hid, invite.code).then((inv) => alive && setFound(inv));
    return () => {
      alive = false;
    };
  }, [invite]);

  const join = async () => {
    if (!invite.code) return;
    setBusy(true);
    try {
      // Entering happens when the server confirms it (see HouseholdGate).
      await joinHousehold(firebase().db, invite.hid, invite.code, user.uid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      {found === undefined && <p className="muted">{t('join.looking')}</p>}
      {found === null && (
        <>
          <div>
            <h1>{t('join.invalidTitle')}</h1>
            <p className="muted mt-6">{t('join.invalidText')}</p>
          </div>
          <button type="button" className="btn soft block" onClick={onCancel}>
            {t('join.createInstead')}
          </button>
        </>
      )}
      {found && (
        <>
          <div>
            <h1>{t('join.title', { name: found.householdName })}</h1>
            <p className="muted mt-6">{t('join.invitedBy', { name: found.createdByName })}</p>
          </div>
          {err && (
            <div className="error" role="alert">
              {err}
            </div>
          )}
          <button type="button" className="btn accent block" onClick={join} disabled={busy}>
            {t('join.join')}
          </button>
          <button type="button" className="btn ghost block" onClick={onCancel}>
            {t('join.noCreateOther')}
          </button>
        </>
      )}
    </AuthScreen>
  );
}
