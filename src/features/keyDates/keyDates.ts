// Key dates: birthdays, renewals, bills… with their kind and labels.
import { type MessageKey, t } from '../../i18n';
import { type DateStr, parts } from '../../shared/dates';
import type { KeyDate, KeyDateKind } from '../../shared/types';

export const KEY_DATE_KINDS: readonly { id: KeyDateKind; label: MessageKey; emoji: string }[] = [
  { id: 'birthday', label: 'kind.birthday', emoji: '🎂' },
  { id: 'car', label: 'kind.car', emoji: '🚗' },
  { id: 'insurance', label: 'kind.insurance', emoji: '🛡️' },
  { id: 'bill', label: 'kind.bill', emoji: '🧾' },
  { id: 'health', label: 'kind.health', emoji: '🩺' },
  { id: 'school', label: 'kind.school', emoji: '🎒' },
  { id: 'other', label: 'kind.other', emoji: '📌' },
];

export const keyDateEmoji = (kind: KeyDateKind) => KEY_DATE_KINDS.find((k) => k.id === kind)?.emoji ?? '📌';

/** "Lía turns 3" for birthdays, the plain title otherwise. */
export function keyDateLabel(kd: KeyDate, on: DateStr) {
  if (kd.kind !== 'birthday') return kd.title;
  const age = parts(on).y - parts(kd.date).y;
  return age > 0 && age < 120
    ? t('dates.turnsAge', { name: kd.title, age })
    : t('dates.birthdayOf', { name: kd.title });
}
