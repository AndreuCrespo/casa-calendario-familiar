// Invite links: any member can create one; it works for LIMITS.inviteDays days.
import { useMemo } from 'react';
import { useApp, useCollection } from '../../core/app';
import { useNow } from '../../core/clock';
import { INVITE_TTL_MS, inviteLink } from '../../core/households';
import { type ShareResult, shareLink } from '../../core/share';
import { t } from '../../i18n';
import type { Invite } from '../../shared/types';
import { toast } from '../../ui/Toast';

/** Resolves when `p` does, or after `ms` (offline writes are queued, not lost). */
const settled = (p: Promise<unknown>, ms: number) =>
  Promise.race([p, new Promise((resolve) => setTimeout(resolve, ms))]);

/** The invite that lasts longest, if any is still valid. */
export function useActiveInvite(): Invite | null | undefined {
  const invites = useCollection('invites');
  const now = useNow();
  return useMemo(() => {
    if (!invites) return undefined;
    const valid = invites.filter((i) => i.expiresAt > now).sort((a, b) => b.expiresAt - a.expiresAt);
    return valid[0] ?? null;
  }, [invites, now]);
}

export function useInviteActions() {
  const { backend, household, user, me } = useApp();

  const create = async (): Promise<Invite> => {
    const code = backend.newId();
    const now = Date.now();
    const data = {
      householdName: household.name,
      createdBy: user.uid,
      createdByName: me?.name ?? user.name,
      createdAt: now,
      // An hour of margin in case this device's clock runs ahead of the server's.
      expiresAt: now + INVITE_TTL_MS - 3_600_000,
    };
    await settled(backend.set('invites', code, data), 5000);
    return { ...data, id: code };
  };

  const share = async (invite: Invite | null | undefined) => {
    let inv: Invite;
    try {
      inv = invite ?? (await create());
    } catch {
      return; // the backend already told the user
    }
    const result: ShareResult = await shareLink({
      title: household.name,
      text: t('invite.shareText', { name: household.name }),
      url: inviteLink(household.id, inv.id),
    });
    if (result === 'copied') toast(t('invite.copied'));
    if (result === 'failed') toast(t('common.copyFailed'));
  };

  const revokeAll = async (invites: readonly Invite[]) => {
    await Promise.all(invites.map((i) => backend.remove('invites', i.id)));
    toast(t('invite.revoked'));
  };

  return { create, share, revokeAll };
}
