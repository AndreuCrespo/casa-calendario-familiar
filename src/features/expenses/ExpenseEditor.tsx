import { useState } from 'react';
import { useApp, useToday } from '../../core/app';
import { centsToInput, euros, parseEuros } from '../../core/format';
import { t } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { Expense } from '../../shared/types';
import { MoneyInput } from '../../ui/MoneyInput';
import { DeleteButton } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { MemberPicker } from '../members/members';
import { CATEGORIES, type CategoryId, categoryId } from './expenses';

export function ExpenseEditor({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { backend, adults, members, me, user, log } = useApp();
  const today = useToday();
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amount) : '');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? me?.id ?? adults[0]?.id);
  const [splitAmong, setSplitAmong] = useState<string[]>(expense?.splitAmong ?? adults.map((a) => a.id));
  const [cat, setCat] = useState<CategoryId>(categoryId(expense?.category ?? 'groceries'));
  const [date, setDate] = useState(expense?.date ?? today);
  const isSettle = expense?.kind === 'settle';

  const save = () => {
    const cents = parseEuros(amount);
    if (!cents || cents <= 0 || cents > LIMITS.amountCents) {
      toast(t('expenses.needAmount'));
      return;
    }
    if (!isSettle && !description.trim()) {
      toast(t('expenses.needDescription'));
      return;
    }
    if (!paidBy || !splitAmong.length) {
      toast(t('expenses.needSplit'));
      return;
    }
    const data = {
      description: description.trim(),
      amount: cents,
      paidBy,
      splitAmong,
      category: cat,
      date,
      kind: expense?.kind ?? 'expense',
      createdBy: expense?.createdBy ?? user.uid,
      createdAt: expense?.createdAt ?? Date.now(),
    } as const;
    if (expense) backend.set('expenses', expense.id, data);
    else {
      backend.add('expenses', data);
      log('expense', `${data.description} (${euros(cents)})`);
    }
    onClose();
  };

  return (
    <Sheet
      title={expense ? (isSettle ? t('expenses.paymentBetween') : t('expenses.edit')) : t('expenses.new')}
      onClose={onClose}
      footer={
        <>
          {expense && (
            <DeleteButton
              onClick={() => {
                backend.remove('expenses', expense.id);
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
      <MoneyInput
        className="input num amount-input"
        placeholder={t('expenses.amountPlaceholder')}
        aria-label={t('expenses.amount')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus={!expense}
      />
      {!isSettle && (
        <>
          <label className="field">
            <span>{t('expenses.description')}</span>
            <input
              value={description}
              maxLength={LIMITS.title}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('expenses.descriptionPlaceholder')}
            />
          </label>
          <div className="field">
            <span>{t('expenses.category')}</span>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip sm${cat === c.id ? ' on' : ''}`}
                  style={{ '--c': c.color }}
                  aria-pressed={cat === c.id}
                  onClick={() => setCat(c.id)}
                >
                  <span aria-hidden="true">{c.emoji}</span> {t(c.label)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="field">
        <span>{t('expenses.paidByLabel')}</span>
        <MemberPicker members={adults} value={paidBy ? [paidBy] : []} onChange={(v) => setPaidBy(v[0])} single />
      </div>
      {!isSettle && (
        <div className="field">
          <span>{t('expenses.splitAmong')}</span>
          <MemberPicker members={adults} value={splitAmong} onChange={setSplitAmong} />
        </div>
      )}
      <label className="field">
        <span>{t('dates.date')}</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {members.length > adults.length && !isSettle && <p className="tiny muted">{t('expenses.kidsHint')}</p>}
    </Sheet>
  );
}
