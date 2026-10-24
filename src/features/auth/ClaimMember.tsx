import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { Household, Member } from '../../shared/types';
import { Avatar, newMemberId, nextColor } from '../members/members';
import { AuthScreen } from './AuthScreen';

/** After joining: pick which household member you are (or add yourself). */
export default function ClaimMember({
  household,
  user,
  onClaim,
}: {
  household: Household;
  user: { uid: string; name: string };
  onClaim: (members: Member[]) => void;
}) {
  const free = household.members.filter((m) => m.kind === 'adult' && !m.uid);
  const [name, setName] = useState(user.name.split(' ')[0] ?? '');
  const full = household.members.length >= LIMITS.members;

  const claim = (id: string) => onClaim(household.members.map((m) => (m.id === id ? { ...m, uid: user.uid } : m)));

  const addNew = () => {
    if (!name.trim() || full) return;
    onClaim([
      ...household.members,
      { id: newMemberId(), name: name.trim(), kind: 'adult', uid: user.uid, color: nextColor(household.members) },
    ]);
  };

  return (
    <AuthScreen>
      <div>
        <h1>{t('claim.title')}</h1>
        <p className="muted mt-6">{t('claim.subtitle')}</p>
      </div>
      {free.length > 0 && (
        <ul className="list">
          {free.map((m) => (
            <li key={m.id}>
              <button type="button" className="list-item clickable" onClick={() => claim(m.id)}>
                <Avatar member={m} />
                <b className="grow">{m.name}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="field">
          <span>{free.length ? t('claim.addNew') : t('auth.yourName')}</span>
          <div className="row">
            <input
              className="input grow"
              value={name}
              maxLength={LIMITS.memberName}
              aria-label={t('auth.yourName')}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="button" className="btn soft" onClick={addNew}>
              <UserRound size={18} aria-hidden="true" /> {t('claim.itsMe')}
            </button>
          </div>
        </div>
      )}
    </AuthScreen>
  );
}
