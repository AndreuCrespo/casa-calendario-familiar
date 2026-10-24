import { ChevronLeft, ChevronRight, HandCoins, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCollection, useToday } from '../../core/app';
import { cap, dayRelative, euros, monthName } from '../../core/format';
import { t } from '../../i18n';
import { addMonthsClamped, parts } from '../../shared/dates';
import type { Expense } from '../../shared/types';
import { Empty, Fab, PageHead } from '../../ui/primitives';
import { toast } from '../../ui/Toast';
import { ExpenseEditor } from './ExpenseEditor';
import { CATEGORIES, category, type Settlement, settlements } from './expenses';

export default function ExpensesPage() {
  const { backend, adults, membersById, user } = useApp();
  const today = useToday();
  const expenses = useCollection('expenses');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);

  const debts = useMemo(() => settlements(expenses ?? [], adults), [expenses, adults]);
  const monthList = useMemo(
    () =>
      (expenses ?? [])
        .filter((e) => e.date.startsWith(month))
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [expenses, month],
  );
  const byCat = useMemo(() => {
    const spend = monthList.filter((e) => e.kind === 'expense');
    const total = spend.reduce((a, e) => a + e.amount, 0);
    const cats = CATEGORIES.map((c) => ({
      c,
      v: spend.filter((e) => category(e.category).id === c.id).reduce((a, e) => a + e.amount, 0),
    }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
    return { total, cats, top: cats[0]?.v ?? 1 };
  }, [monthList]);

  const settle = (d: Settlement) => {
    backend.add('expenses', {
      description: '',
      amount: d.amount,
      paidBy: d.from.id,
      splitAmong: [d.to.id],
      date: today,
      category: 'other',
      kind: 'settle',
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    toast(t('expenses.settledToast'));
  };

  const p = parts(`${month}-01`);
  const shift = (n: number) => setMonth(addMonthsClamped(`${month}-01`, n).slice(0, 7));
  const nameOf = (id: string | undefined) => (id ? membersById.get(id)?.name : undefined) ?? '?';

  return (
    <>
      <PageHead title={t('nav.expenses')}>
        <button type="button" className="icon-btn solid" onClick={() => shift(-1)} aria-label={t('expenses.prevMonth')}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="icon-btn solid" onClick={() => shift(1)} aria-label={t('expenses.nextMonth')}>
          <ChevronRight size={20} />
        </button>
      </PageHead>

      <section className="card mb-12">
        <h2 className="label">
          <HandCoins size={14} aria-hidden="true" /> {t('expenses.balances')}
        </h2>
        {debts.length === 0 ? (
          <div className="big-num">{t('expenses.settledUp')}</div>
        ) : (
          debts.map((d) => (
            <div key={d.from.id + d.to.id} className="row mt-10">
              <div className="grow debt">
                <b>{d.from.name}</b> {t('expenses.owes')} <b className="num">{euros(d.amount)}</b> {t('expenses.to')}{' '}
                <b>{d.to.name}</b>
              </div>
              <button type="button" className="btn green sm" onClick={() => settle(d)}>
                {t('expenses.settle')}
              </button>
            </div>
          ))
        )}
      </section>

      <section className="card mb-12">
        <h2 className="label">
          <Wallet size={14} aria-hidden="true" /> {cap(monthName(p.m))} {p.y !== Number(today.slice(0, 4)) ? p.y : ''}
        </h2>
        <div className="big-num num">{euros(byCat.total)}</div>
        {byCat.cats.length > 0 && (
          <ul className="stack gap-9 mt-14 plain">
            {byCat.cats.map(({ c, v }) => (
              <li key={c.id}>
                <div className="row small between mb-4">
                  <span>
                    {c.emoji} {t(c.label)}
                  </span>
                  <b className="num">{euros(v)}</b>
                </div>
                <div className="hbar" aria-hidden="true">
                  <i style={{ width: `${(v / byCat.top) * 100}%`, '--c': c.color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {expenses && monthList.length === 0 && (
        <Empty icon={Wallet} title={t('expenses.emptyTitle')}>
          {t('expenses.emptyText')}
        </Empty>
      )}

      {monthList.length > 0 && (
        <ul className="list">
          {monthList.map((e) => {
            const isSettle = e.kind === 'settle';
            return (
              <li key={e.id}>
                <button type="button" className="list-item clickable" onClick={() => setEditing(e)}>
                  <span className="item-emoji" aria-hidden="true">
                    {isSettle ? '🤝' : category(e.category).emoji}
                  </span>
                  <span className="grow">
                    <span className="item-title ellipsis block">
                      {isSettle
                        ? t('expenses.paidTo', { from: nameOf(e.paidBy), to: nameOf(e.splitAmong[0]) })
                        : e.description}
                    </span>
                    <span className="item-sub block">
                      {dayRelative(e.date, today)} ·{' '}
                      {isSettle ? t('expenses.settleUpLower') : t('expenses.paidBy', { name: nameOf(e.paidBy) })}
                    </span>
                  </span>
                  <b className={`num${isSettle ? ' muted' : ''}`}>{euros(e.amount)}</b>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Fab label={t('expenses.new')} onClick={() => setEditing('new')} />
      {editing && <ExpenseEditor expense={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
