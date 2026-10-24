import type { User } from 'firebase/auth';
import { MapPin, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { firebase } from '../../core/firebase';
import { createHousehold, deviceTimezone } from '../../core/households';
import { t } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { Household, Member } from '../../shared/types';
import { memberColor, newMemberId } from '../members/members';
import { LocationSearch } from '../weather/LocationSearch';
import { AuthScreen } from './AuthScreen';

/** Colors in order of creation: you, your partner, then each child. */
const kidColor = (i: number) => memberColor(2 + i);

/** First run: name the household and its members. */
export default function Onboarding({ user }: { user: User }) {
  const [houseName, setHouseName] = useState(t('onboarding.defaultHouse'));
  const [me, setMe] = useState(user.displayName?.split(' ')[0] ?? '');
  const [partner, setPartner] = useState('');
  const [kids, setKids] = useState<string[]>(['', '']);
  const [loc, setLoc] = useState<Household['location']>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const named = kids.map((k) => k.trim()).filter(Boolean);

  const create = async () => {
    if (!me.trim()) {
      setErr(t('onboarding.needName'));
      return;
    }
    setBusy(true);
    const members: Member[] = [
      { id: newMemberId(), name: me.trim(), color: memberColor(0), kind: 'adult', uid: user.uid },
    ];
    if (partner.trim()) {
      members.push({ id: newMemberId(), name: partner.trim(), color: memberColor(1), kind: 'adult', uid: null });
    }
    // Same colors as the preview: by position among the children with a name.
    for (const [i, name] of named.entries())
      members.push({ id: newMemberId(), name, color: kidColor(i), kind: 'child' });
    try {
      // Entering happens when the server confirms it (see HouseholdGate).
      await createHousehold(firebase().db, {
        name: houseName.trim() || t('onboarding.defaultHouse'),
        memberUids: [user.uid],
        members: members.slice(0, LIMITS.members),
        timezone: deviceTimezone(),
        location: loc,
        notify: { dailySummary: true, dailyHour: 8, activity: true },
        createdAt: Date.now(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen top>
      <div>
        <h1>{t('onboarding.title')}</h1>
        <p className="muted mt-6">{t('onboarding.subtitle')}</p>
      </div>
      <label className="field">
        <span>{t('onboarding.houseName')}</span>
        <input value={houseName} maxLength={LIMITS.householdName} onChange={(e) => setHouseName(e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>{t('auth.yourName')}</span>
          <input value={me} maxLength={LIMITS.memberName} onChange={(e) => setMe(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('onboarding.partner')}</span>
          <input
            value={partner}
            maxLength={LIMITS.memberName}
            onChange={(e) => setPartner(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
          />
        </label>
      </div>
      <div className="field">
        <span id="kids-label">{t('onboarding.kids')}</span>
        <ul className="stack gap-8 plain" aria-labelledby="kids-label">
          {kids.map((k, i) => {
            const colorIndex = kids.slice(0, i).filter((x) => x.trim()).length;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are only added at the end or removed explicitly
              <li className="row" key={i}>
                <span
                  className="dot dot-lg"
                  style={{ background: k.trim() ? kidColor(colorIndex) : 'var(--border-strong)' }}
                  aria-hidden="true"
                />
                <input
                  className="input grow"
                  value={k}
                  maxLength={LIMITS.memberName}
                  placeholder={t('onboarding.kidPlaceholder', { n: i + 1 })}
                  aria-label={t('onboarding.kidPlaceholder', { n: i + 1 })}
                  onChange={(e) => setKids(kids.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  className="icon-btn"
                  type="button"
                  onClick={() => setKids(kids.filter((_, j) => j !== i))}
                  aria-label={t('common.remove')}
                >
                  <Minus size={18} />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn ghost sm self-start" onClick={() => setKids([...kids, ''])}>
          <Plus size={16} aria-hidden="true" /> {t('common.add')}
        </button>
      </div>
      <div className="field">
        <span>{t('onboarding.city')}</span>
        {loc ? (
          <div className="row card flat compact-card">
            <MapPin size={18} aria-hidden="true" /> <b className="grow">{loc.name}</b>
            <button type="button" className="btn ghost sm" onClick={() => setLoc(null)}>
              {t('common.change')}
            </button>
          </div>
        ) : (
          <LocationSearch onPick={(r) => setLoc({ name: r.name.slice(0, LIMITS.place), lat: r.lat, lon: r.lon })} />
        )}
      </div>
      {err && (
        <div className="error" role="alert">
          {err}
        </div>
      )}
      <button type="button" className="btn accent block" onClick={create} disabled={busy}>
        {t('onboarding.create')}
      </button>
    </AuthScreen>
  );
}
