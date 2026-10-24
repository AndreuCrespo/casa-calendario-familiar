import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n';
import { useActiveInvite, useInviteActions } from '../../members/invite';

/** Shown while nobody else has joined the household. */
export function InviteCard() {
  const active = useActiveInvite();
  const { share } = useInviteActions();
  const [busy, setBusy] = useState(false);
  return (
    <section className="card tinted-blue">
      <div className="row">
        <div className="grow">
          <h2 className="bold">{t('invite.title')}</h2>
          <p className="small muted">{t('invite.text')}</p>
        </div>
        <button
          type="button"
          className="btn sm"
          disabled={busy || active === undefined}
          onClick={async () => {
            setBusy(true);
            await share(active);
            setBusy(false);
          }}
        >
          <Share2 size={16} aria-hidden="true" /> {t('common.share')}
        </button>
      </div>
    </section>
  );
}
