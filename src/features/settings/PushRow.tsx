import { useEffect, useState } from 'react';
import { useApp } from '../../core/app';
import { type MessageKey, t } from '../../i18n';
import { toast } from '../../ui/Toast';
import { disablePush, enablePush, type PushStatus, pushStatus } from '../notifications/push';

const HINT: Record<PushStatus, MessageKey | null> = {
  unsupported: 'push.unsupported',
  'needs-install': 'push.needsInstall',
  'no-key': 'push.noKeyHint',
  denied: 'push.blocked',
  off: null,
  on: null,
};

/** Switch for notifications on this device. */
export function PushRow() {
  const { backend, user, demo } = useApp();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    pushStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) await enablePush(backend, user.uid);
      else await disablePush(backend);
      toast(on ? t('push.enabled') : t('push.disabled'));
    } catch (e) {
      // Backend failures were already reported; the rest (permission, browser) are shown here.
      if (!(e && typeof e === 'object' && 'code' in e)) toast(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus(await pushStatus());
      setBusy(false);
    }
  };

  if (!status) return null;
  const hint = HINT[status];
  const note = demo ? t('push.notInDemo') : hint ? t(hint) : '';
  return (
    <>
      <label className="switch">
        {t('push.thisDevice')}
        <input
          type="checkbox"
          disabled={busy || demo || !(status === 'on' || status === 'off')}
          checked={status === 'on'}
          onChange={(e) => toggle(e.target.checked)}
        />
      </label>
      {note && <p className="tiny muted switch-note">{note}</p>}
    </>
  );
}
