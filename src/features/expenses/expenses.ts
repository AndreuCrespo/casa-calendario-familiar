// Shared expenses: categories, who owes whom and the fewest payments to settle up.
import type { MessageKey } from '../../i18n';
import type { Expense, Member } from '../../shared/types';

export const CATEGORIES = [
  { id: 'groceries', label: 'cat.groceries', emoji: '🛒', color: '#22A06B' },
  { id: 'home', label: 'cat.home', emoji: '🏠', color: '#4C7DF0' },
  { id: 'bills', label: 'cat.bills', emoji: '💡', color: '#F08C2E' },
  { id: 'kids', label: 'cat.kids', emoji: '🧸', color: '#8B5CF6' },
  { id: 'car', label: 'cat.car', emoji: '🚗', color: '#14A3B8' },
  { id: 'health', label: 'cat.health', emoji: '🩺', color: '#E2558A' },
  { id: 'leisure', label: 'cat.leisure', emoji: '🎉', color: '#D9483B' },
  { id: 'other', label: 'cat.other', emoji: '📦', color: '#968D81' },
] as const satisfies readonly { id: string; label: MessageKey; emoji: string; color: string }[];

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type Category = (typeof CATEGORIES)[number];
const OTHER: Category = CATEGORIES[7];

/** Category ids used by earlier versions (still found in stored expenses). */
const LEGACY_CATEGORY: Record<string, CategoryId> = {
  super: 'groceries',
  casa: 'home',
  facturas: 'bills',
  ninas: 'kids',
  coche: 'car',
  salud: 'health',
  ocio: 'leisure',
  otros: 'other',
};

export function category(id: string): Category {
  const current = LEGACY_CATEGORY[id] ?? id;
  return CATEGORIES.find((c) => c.id === current) ?? OTHER;
}

export const categoryId = (id: string): CategoryId => category(id).id;

/** Net balance per member in cents (positive: they are owed money). */
export function balances(expenses: readonly Expense[]) {
  const net = new Map<string, number>();
  const add = (id: string, v: number) => net.set(id, (net.get(id) ?? 0) + v);
  for (const e of expenses) {
    if (e.kind === 'settle') {
      const to = e.splitAmong[0];
      add(e.paidBy, e.amount);
      if (to) add(to, -e.amount);
      continue;
    }
    const among = e.splitAmong?.length ? e.splitAmong : [e.paidBy];
    add(e.paidBy, e.amount);
    // Cents that don't divide evenly go to the first members.
    const share = Math.floor(e.amount / among.length);
    let rest = e.amount - share * among.length;
    for (const id of among) {
      add(id, -(share + (rest > 0 ? 1 : 0)));
      if (rest > 0) rest--;
    }
  }
  return net;
}

export interface Settlement {
  from: Member;
  to: Member;
  amount: number;
}

/** Who pays whom, with as few payments as possible. */
export function settlements(expenses: readonly Expense[], members: readonly Member[]): Settlement[] {
  const net = balances(expenses);
  const withBalance = members.map((m) => ({ m, v: net.get(m.id) ?? 0 }));
  const debtors = withBalance.filter((x) => x.v < 0).sort((a, b) => a.v - b.v);
  const creditors = withBalance.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    if (!d || !c) break;
    const amount = Math.min(-d.v, c.v);
    if (amount > 0) out.push({ from: d.m, to: c.m, amount });
    d.v += amount;
    c.v -= amount;
    if (d.v === 0) i++;
    if (c.v === 0) j++;
  }
  return out;
}

/** Total spent (not counting settle-up payments) in a month ('YYYY-MM'). */
export const monthTotal = (expenses: readonly Expense[], month: string) =>
  expenses.filter((e) => e.kind === 'expense' && e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);
