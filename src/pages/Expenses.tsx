import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, HandCoins, Plus, Trash2, Wallet } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { CATEGORIES, category, settlements } from '../lib/expenses';
import { MONTHS, cap, dayRelative, euros, parseEuros } from '../lib/format';
import { addMonthsClamped } from '../shared/dates';
import type { Expense } from '../shared/types';
import { Empty, MemberPicker, PageHead, Sheet, toast } from '../components/ui';

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
    .map((c) => ({ c, v: spend.filter((e) => e.category === c.id).reduce((a, e) => a + e.amount, 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const settle = (d: (typeof debts)[number]) => {
    backend.add('expenses', {
      description: 'Saldar cuentas', amount: d.amount, paidBy: d.from.id, splitAmong: [d.to.id],
      date: today, category: 'otros', kind: 'settle', createdBy: user.uid, createdAt: Date.now(),
    });
    toast('Cuentas saldadas ✓');
  };

  const [y, m] = month.split('-').map(Number);
  const shift = (n: number) => setMonth(addMonthsClamped(`${month}-01`, n).slice(0, 7));

  return (
    <>
      <PageHead title="Gastos">
        <button className="icon-btn solid" onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
        <button className="icon-btn solid" onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
      </PageHead>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="label"><HandCoins size={14} /> Cuentas</div>
        {debts.length === 0 ? (
          <div className="big-num">Estáis en paz ✌️</div>
        ) : debts.map((d) => (
          <div key={d.from.id + d.to.id} className="row" style={{ marginTop: 10 }}>
            <div className="grow">
              <div style={{ fontSize: 17 }}><b>{d.from.name}</b> debe <b className="num">{euros(d.amount)}</b> a <b>{d.to.name}</b></div>
            </div>
            <button className="btn green sm" onClick={() => settle(d)}>Saldar</button>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label"><Wallet size={14} /> {cap(MONTHS[m - 1])} {y !== Number(today.slice(0, 4)) ? y : ''}</div>
        </div>
        <div className="big-num num">{euros(total)}</div>
        {byCat.length > 0 && (
          <div className="stack" style={{ gap: 9, marginTop: 14 }}>
            {byCat.map(({ c, v }) => (
              <div key={c.id}>
                <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{c.emoji} {c.label}</span><b className="num">{euros(v)}</b>
                </div>
                <div className="hbar"><i style={{ width: `${(v / byCat[0].v) * 100}%`, '--c': c.color } as React.CSSProperties} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {expenses && monthList.length === 0 && (
        <Empty icon={Wallet} title="Sin gastos este mes">Apunta lo que pagáis cada uno y la app calcula quién debe a quién.</Empty>
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
                  <div className="item-title ellipsis">{isSettle ? `${payer?.name} pagó a ${members.find((x) => x.id === e.splitAmong[0])?.name}` : e.description}</div>
                  <div className="item-sub">{dayRelative(e.date, today)} · {isSettle ? 'saldar cuentas' : `pagó ${payer?.name ?? '?'}`}</div>
                </div>
                <b className="num" style={isSettle ? { color: 'var(--muted)' } : undefined}>{euros(e.amount)}</b>
              </button>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo gasto"><Plus size={28} /></button>
      {editing && <ExpenseEditor expense={editing === 'new' ? undefined : editing} defaultPayer={me?.id} onClose={() => setEditing(null)} />}
    </>
  );
}

function ExpenseEditor({ expense, defaultPayer, onClose }: { expense?: Expense; defaultPayer?: string; onClose: () => void }) {
  const { backend, adults, members, user, log } = useApp();
  const today = useToday();
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? (expense.amount / 100).toFixed(2).replace('.', ',') : '');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? defaultPayer ?? adults[0]?.id);
  const [splitAmong, setSplitAmong] = useState<string[]>(expense?.splitAmong ?? adults.map((a) => a.id));
  const [cat, setCat] = useState(expense?.category ?? 'super');
  const [date, setDate] = useState(expense?.date ?? today);
  const isSettle = expense?.kind === 'settle';

  const save = () => {
    const cents = parseEuros(amount);
    if (!cents || cents <= 0) { toast('Pon un importe'); return; }
    if (!isSettle && !description.trim()) { toast('Pon una descripción'); return; }
    if (!splitAmong.length) { toast('Elige entre quién se reparte'); return; }
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
      title={expense ? (isSettle ? 'Pago entre vosotros' : 'Editar gasto') : 'Nuevo gasto'}
      onClose={onClose}
      footer={<>
        {expense && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('expenses', expense.id); onClose(); }} aria-label="Borrar"><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>Guardar</button>
      </>}
    >
      <input
        className="input num"
        style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', height: 64 }}
        inputMode="decimal"
        placeholder="0,00 €"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus={!expense}
      />
      {!isSettle && (
        <>
          <label className="field"><span>Concepto</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Mercadona" />
          </label>
          <div className="field"><span>Categoría</span>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`chip sm${cat === c.id ? ' on' : ''}`} style={{ '--c': c.color } as React.CSSProperties} onClick={() => setCat(c.id)}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="field"><span>Pagó</span>
        <MemberPicker members={adults} value={paidBy ? [paidBy] : []} onChange={(v) => setPaidBy(v[0])} single />
      </div>
      {!isSettle && (
        <div className="field"><span>Se reparte entre</span>
          <MemberPicker members={adults} value={splitAmong} onChange={setSplitAmong} />
        </div>
      )}
      <label className="field"><span>Fecha</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {members.length > adults.length && !isSettle && (
        <p className="tiny muted">Los gastos de las peques ponlos en la categoría «Peques» y repártelos entre los adultos.</p>
      )}
    </Sheet>
  );
}
