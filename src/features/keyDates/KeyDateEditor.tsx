import { useState } from 'react';
import { useApp, useToday } from '../../core/app';
import { centsToInput, parseEuros } from '../../core/format';
import { t, tn } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { KeyDate, KeyDateKind } from '../../shared/types';
import { MoneyInput } from '../../ui/MoneyInput';
import { DeleteButton } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { MemberPicker } from '../members/members';
import { KEY_DATE_KINDS } from './keyDates';

const REMIND_DAYS = [0, 1, 2, 3, 7, 15, 30, 60];

export function KeyDateEditor({ kd, onClose }: { kd?: KeyDate; onClose: () => void }) {
  const { backend, members, log } = useApp();
  const today = useToday();
  const [title, setTitle] = useState(kd?.title ?? '');
  const [kind, setKind] = useState<KeyDateKind>(kd?.kind ?? 'other');
  const [date, setDate] = useState(kd?.date ?? today);
  const [repeat, setRepeat] = useState<KeyDate['repeat']>(kd?.repeat ?? 'none');
  const [remindDays, setRemindDays] = useState(kd?.remindDays ?? 7);
  const [amount, setAmount] = useState(kd?.amount ? centsToInput(kd.amount) : '');
  const [memberIds, setMemberIds] = useState<string[]>(kd?.memberIds ?? []);
  const [notes, setNotes] = useState(kd?.notes ?? '');
  const birthday = kind === 'birthday';

  const onKind = (k: KeyDateKind) => {
    setKind(k);
    if (kd) return;
    // Sensible defaults for new dates
    if (k === 'birthday' || k === 'insurance') setRepeat('yearly');
    if (k === 'bill') {
      setRepeat('monthly');
      setRemindDays(1);
    }
  };

  const save = () => {
    const name = title.trim();
    if (!name) {
      toast(t('dates.needName'));
      return;
    }
    const cents = birthday || !amount.trim() ? null : parseEuros(amount);
    if (cents === null && !birthday && amount.trim()) {
      toast(t('expenses.needAmount'));
      return;
    }
    const data = { title: name, kind, date, repeat, remindDays, amount: cents, memberIds, notes: notes.trim() };
    if (kd) backend.set('dates', kd.id, data);
    else {
      backend.add('dates', data);
      log('date', name);
    }
    onClose();
  };

  return (
    <Sheet
      title={kd ? t('dates.edit') : t('dates.new')}
      onClose={onClose}
      footer={
        <>
          {kd && (
            <DeleteButton
              onClick={() => {
                backend.remove('dates', kd.id);
                onClose();
              }}
            />
          )}
          <button type="button" className="btn accent" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <label className="field">
        <span>{t('dates.type')}</span>
        <select value={kind} onChange={(e) => onKind(e.target.value as KeyDateKind)}>
          {KEY_DATE_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.emoji} {t(k.label)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{birthday ? t('dates.whose') : t('dates.name')}</span>
        <input
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={birthday ? t('dates.name') : t('dates.namePlaceholder')}
          // biome-ignore lint/a11y/noAutofocus: the sheet was opened to type a new date
          autoFocus={!kd}
        />
      </label>
      <div className="grid2">
        <label className="field">
          <span>{birthday ? t('dates.birthDate') : t('dates.date')}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('dates.repeats')}</span>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as KeyDate['repeat'])}>
            <option value="none">{t('common.no')}</option>
            <option value="monthly">{t('repeat.monthly')}</option>
            <option value="yearly">{t('repeat.yearly')}</option>
          </select>
        </label>
      </div>
      <div className="grid2">
        <label className="field">
          <span>{t('dates.remind')}</span>
          <select value={remindDays} onChange={(e) => setRemindDays(Number(e.target.value))}>
            {REMIND_DAYS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('dates.sameDay') : tn('dates.daysBefore', n)}
              </option>
            ))}
          </select>
        </label>
        {!birthday && (
          // biome-ignore lint/a11y/noLabelWithoutControl: MoneyInput renders the <input>
          <label className="field">
            <span>{t('dates.amount')}</span>
            <MoneyInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('dates.amountPlaceholder')}
            />
          </label>
        )}
      </div>
      <div className="field">
        <span>{t('dates.relatedTo')}</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>
      <label className="field">
        <span>{t('common.notes')}</span>
        <textarea
          value={notes}
          maxLength={LIMITS.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('dates.notesPlaceholder')}
        />
      </label>
    </Sheet>
  );
}
