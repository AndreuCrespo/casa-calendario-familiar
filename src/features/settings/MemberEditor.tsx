import { useState } from 'react';
import { useApp } from '../../core/app';
import { t } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { Member } from '../../shared/types';
import { DeleteButton, Segmented } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { ColorSwatches, MEMBER_COLORS, newMemberId, nextColor } from '../members/members';

export function MemberEditor({ member, onClose }: { member?: Member; onClose: () => void }) {
  const { backend, household, members, user } = useApp();
  const [name, setName] = useState(member?.name ?? '');
  const [color, setColor] = useState(member?.color ?? nextColor(members));
  const [kind, setKind] = useState<Member['kind']>(member?.kind ?? 'child');
  const isMe = member?.uid === user.uid;

  const save = () => {
    const n = name.trim();
    if (!n) {
      toast(t('settings.needName'));
      return;
    }
    if (!member && members.length >= LIMITS.members) {
      toast(t('settings.tooManyMembers', { n: LIMITS.members }));
      return;
    }
    const next: Member[] = member
      ? members.map((m) => (m.id === member.id ? { ...m, name: n, color, kind: m.uid ? 'adult' : kind } : m))
      : [...members, { id: newMemberId(), name: n, color, kind, uid: null }];
    backend.updateHousehold({ members: next });
    onClose();
  };

  // Removing someone with an account also takes away their access to the household.
  const remove = () => {
    if (!member || isMe) return;
    const uid = member.uid;
    backend.updateHousehold({
      members: members.filter((m) => m.id !== member.id),
      ...(uid ? { memberUids: household.memberUids.filter((u) => u !== uid) } : {}),
    });
    onClose();
  };

  return (
    <Sheet
      title={member ? t('settings.editMember') : t('settings.newMember')}
      onClose={onClose}
      footer={
        <>
          {member && !isMe && <DeleteButton onClick={remove} label={t('common.remove')} />}
          <button type="button" className="btn accent" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <label className="field">
        <span>{t('dates.name')}</span>
        <input
          value={name}
          maxLength={LIMITS.memberName}
          onChange={(e) => setName(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: the sheet was opened to type a name
          autoFocus={!member}
        />
      </label>
      {!member?.uid && (
        <div className="field">
          <span>{t('dates.type')}</span>
          <Segmented
            label={t('dates.type')}
            value={kind}
            onChange={setKind}
            options={[
              { id: 'child', label: t('settings.kindChild') },
              { id: 'adult', label: t('settings.kindAdult') },
            ]}
          />
        </div>
      )}
      <div className="field">
        <span>{t('common.color')}</span>
        <ColorSwatches colors={MEMBER_COLORS} value={color} onChange={setColor} />
      </div>
    </Sheet>
  );
}
