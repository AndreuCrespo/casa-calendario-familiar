import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, HandCoins, Plus, Trash2, Wallet } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { CATEGORIES, category, categoryId, settlements } from '../lib/expenses';
import { cap, centsToInput, dayRelative, euros, monthName, parseEuros } from '../lib/format';
import { addMonthsClamped } from '../shared/dates';
import type { Expense } from '../shared/types';
import { Empty, MemberPicker, PageHead, Sheet, toast } from '../components/ui';
import { t } from '../i18n';

export default function Expenses() {
  const { backend, adults, members, me, user } = useApp();
  const today = useToday();
  const expenses = useCollection<Expense>('expenses');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);

  const debts = useMemo(() => settlements(expenses ?? [], adults), [expenses, adults]);
  const monthList = useMemo(() => (expenses ?? [])
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)), [expenses, month]);
  const spend = monthList.filter((e) => e.kind === 'expense');
  const total = spend.reduce((a, e) => a + e.amount, 0);
  const byCat = CATEGORIES
    .map((c) => ({ c, v: spend.filter((e) => categoryId(e.category) === c.id).reduce((a, e) => a + e.amount, 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const settle = (d: (typeof debts)[number]) => {
    backend.add('expenses', {
      description: t('expenses.settleUp'), amount: d.amount, paidBy: d.from.id, splitAmong: [d.to.id],
      date: today, category: 'otros', kind: 'settle', createdBy: user.uid, createdAt: Date.now(),
    });
    toast(t('expenses.settledToast'));
  };

  const [y, m] = month.split('-').map(Number);
  const shift = (n: number) => setMonth(addMonthsClamped(`${month}-01`, n).slice(0, 7));

  return (
    <>
      <PageHead title={t('nav.expenses')}>
        <button className="icon-btn solid" onClick={() => shift(-1)} aria-label={t('expenses.prevMonth')}><ChevronLeft size={20} /></button>
        <button className="icon-btn solid" onClick={() => shift(1)} aria-label={t('expenses.nextMonth')}><ChevronRight size={20} /></button>
      </PageHead>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="label"><HandCoins size={14} /> {t('expenses.balances')}</div>
        {debts.length === 0 ? (
          <div className="big-num">{t('expenses.settledUp')}</div>
        ) : debts.map((d) => (
          <div key={d.from.id + d.to.id} className="row" style={{ marginTop: 10 }}>
            <div className="grow">
              <div style={{ fontSize: 17 }}><b>{d.from.name}</b> {t('expenses.owes')} <b className="num">{euros(d.amount)}</b> {t('expenses.to')} <b>{d.to.name}</b></div>
            </div>
            <button className="btn green sm" onClick={() => settle(d)}>{t('expenses.settle')}</button>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label"><Wallet size={14} /> {cap(monthName(m))} {y !== Number(today.slice(0, 4)) ? y : ''}</div>
        </div>
        <div className="big-num num">{euros(total)}</div>
        {byCat.length > 0 && (
          <div className="stack" style={{ gap: 9, marginTop: 14 }}>
            {byCat.map(({ c, v }) => (
              <div key={c.id}>
                <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{c.emoji} {t(c.label)}</span><b className="num">{euros(v)}</b>
                </div>
                <div className="hbar"><i style={{ width: `${(v / byCat[0].v) * 100}%`, '--c': c.color } as CSSProperties} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {expenses && monthList.length === 0 && (
        <Empty icon={Wallet} title={t('expenses.emptyTitle')}>{t('expenses.emptyText')}</Empty>
      )}

      {monthList.length > 0 && (
        <div className="list">
          {monthList.map((e) => {
            const payer = members.find((x) => x.id === e.paidBy);
            const c = category(e.category);
            const isSettle = e.kind === 'settle';
            return (
              <button key={e.id} className="list-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setEditing(e)}>
                <span style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{isSettle ? '🤝' : c.emoji}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="item-title ellipsis">{isSettle ? t('expenses.paidTo', { from: payer?.name ?? '?', to: members.find((x) => x.id === e.splitAmong[0])?.name ?? '?' }) : e.description}</div>
                  <div className="item-sub">{dayRelative(e.date, today)} · {isSettle ? t('expenses.settleUpLower') : t('expenses.paidBy', { name: payer?.name ?? '?' })}</div>
                </div>
                <b className="num" style={isSettle ? { color: 'var(--muted)' } : undefined}>{euros(e.amount)}</b>
              </button>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label={t('expenses.new')}><Plus size={28} /></button>
      {editing && <ExpenseEditor expense={editing === 'new' ? undefined : editing} defaultPayer={me?.id} onClose={() => setEditing(null)} />}
    </>
  );
}

function ExpenseEditor({ expense, defaultPayer, onClose }: { expense?: Expense; defaultPayer?: string; onClose: () => void }) {
  const { backend, adults, members, user, log } = useApp();
  const today = useToday();
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amount) : '');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? defaultPayer ?? adults[0]?.id);
  const [splitAmong, setSplitAmong] = useState<string[]>(expense?.splitAmong ?? adults.map((a) => a.id));
  const [cat, setCat] = useState(categoryId(expense?.category ?? 'groceries'));
  const [date, setDate] = useState(expense?.date ?? today);
  const isSettle = expense?.kind === 'settle';

  const save = () => {
    const cents = parseEuros(amount);
    if (!cents || cents <= 0) { toast(t('expenses.needAmount')); return; }
    if (!isSettle && !description.trim()) { toast(t('expenses.needDescription')); return; }
    if (!splitAmong.length) { toast(t('expenses.needSplit')); return; }
    const data = {
      description: description.trim(), amount: cents, paidBy, splitAmong, category: cat, date,
      kind: expense?.kind ?? 'expense', createdBy: expense?.createdBy ?? user.uid, createdAt: expense?.createdAt ?? Date.now(),
    };
    if (expense) backend.set('expenses', expense.id, data);
    else { backend.add('expenses', data); log('expense', `${data.description} (${euros(cents)})`); }
    onClose();
  };

  return (
    <Sheet
      title={expense ? (isSettle ? t('expenses.paymentBetween') : t('expenses.edit')) : t('expenses.new')}
      onClose={onClose}
      footer={<>
        {expense && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('expenses', expense.id); onClose(); }} aria-label={t('common.delete')}><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>{t('common.save')}</button>
      </>}
    >
      <input
        className="input num"
        style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', height: 64 }}
        inputMode="decimal"
        placeholder={t('expenses.amountPlaceholder')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus={!expense}
      />
      {!isSettle && (
        <>
          <label className="field"><span>{t('expenses.description')}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('expenses.descriptionPlaceholder')} />
          </label>
          <div className="field"><span>{t('expenses.category')}</span>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`chip sm${cat === c.id ? ' on' : ''}`} style={{ '--c': c.color } as CSSProperties} onClick={() => setCat(c.id)}>
                  {c.emoji} {t(c.label)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="field"><span>{t('expenses.paidByLabel')}</span>
        <MemberPicker members={adults} value={paidBy ? [paidBy] : []} onChange={(v) => setPaidBy(v[0])} single />
      </div>
      {!isSettle && (
        <div className="field"><span>{t('expenses.splitAmong')}</span>
          <MemberPicker members={adults} value={splitAmong} onChange={setSplitAmong} />
        </div>
      )}
      <label className="field"><span>{t('dates.date')}</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {members.length > adults.length && !isSettle && (
        <p className="tiny muted">{t('expenses.kidsHint')}</p>
      )}
    </Sheet>
  );
}
