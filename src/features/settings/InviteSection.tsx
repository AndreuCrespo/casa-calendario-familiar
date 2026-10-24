import { Copy, Link2Off, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useApp, useCollection } from '../../core/app';
import { dayLong } from '../../core/format';
import { inviteLink } from '../../core/households';
import { copyText } from '../../core/share';
import { t } from '../../i18n';
import { todayIn } from '../../shared/dates';
import { toast } from '../../ui/Toast';
import { useActiveInvite, useInviteActions } from '../members/invite';

/** Invite link: create, copy, share and revoke. */
export function InviteSection() {
  const { household, tz } = useApp();
  const invites = useCollection('invites');
  const active = useActiveInvite();
  const { create, share, revokeAll } = useInviteActions();
  const [busy, setBusy] = useState(false);
  const link = active ? inviteLink(household.id, active.id) : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // the backend already told the user
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack gap-10">
      <p className="small muted">{t('settings.inviteText', { name: household.name })}</p>
      {link && active ? (
        <>
          <div className="row">
            <input
              className="input grow small"
              readOnly
              value={link}
              aria-label={t('settings.inviteLink')}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="icon-btn solid"
              aria-label={t('common.copy')}
              onClick={async () => toast((await copyText(link)) ? t('invite.copied') : t('common.copyFailed'))}
            >
              <Copy size={18} />
            </button>
          </div>
          <p className="tiny muted">{t('invite.expires', { day: dayLong(todayIn(tz, active.expiresAt)) })}</p>
          <div className="row wrap gap-8">
            <button type="button" className="btn soft grow" disabled={busy} onClick={() => run(() => share(active))}>
              <Share2 size={17} aria-hidden="true" /> {t('settings.shareLink')}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => run(() => revokeAll(invites ?? []))}
            >
              <Link2Off size={17} aria-hidden="true" /> {t('invite.revoke')}
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn soft" disabled={busy || active === undefined} onClick={() => run(create)}>
          <Share2 size={17} aria-hidden="true" /> {t('invite.create')}
        </button>
      )}
    </div>
  );
}
