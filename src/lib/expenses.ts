import type { Expense, Member } from '../shared/types';
import type { MessageKey } from '../i18n';

export const CATEGORIES: { id: string; label: MessageKey; emoji: string; color: string }[] = [
  { id: 'groceries', label: 'cat.groceries', emoji: '🛒', color: '#22A06B' },
  { id: 'home', label: 'cat.home', emoji: '🏠', color: '#4C7DF0' },
  { id: 'bills', label: 'cat.bills', emoji: '💡', color: '#F08C2E' },
  { id: 'kids', label: 'cat.kids', emoji: '🧸', color: '#8B5CF6' },
  { id: 'car', label: 'cat.car', emoji: '🚗', color: '#14A3B8' },
  { id: 'health', label: 'cat.health', emoji: '🩺', color: '#E2558A' },
  { id: 'leisure', label: 'cat.leisure', emoji: '🎉', color: '#D9483B' },
  { id: 'other', label: 'cat.other', emoji: '📦', color: '#968D81' },
];

/** Category ids used by earlier versions (still found in stored expenses). */
const LEGACY_CATEGORY: Record<string, string> = {
  super: 'groceries', casa: 'home', facturas: 'bills', ninas: 'kids',
  coche: 'car', salud: 'health', ocio: 'leisure', otros: 'other',
};

export const categoryId = (id: string) => LEGACY_CATEGORY[id] ?? id;
export const category = (id: string) => CATEGORIES.find((c) => c.id === categoryId(id)) ?? CATEGORIES[CATEGORIES.length - 1];

/** Net balance per member (positive = they are owed money). */
export function balances(expenses: Expense[]) {
  const net = new Map<string, number>();
  const add = (id: string, v: number) => net.set(id, (net.get(id) ?? 0) + v);
  for (const e of expenses) {
    if (e.kind === 'settle') {
      add(e.paidBy, e.amount);
      add(e.splitAmong[0], -e.amount);
      continue;
    }
    const among = e.splitAmong?.length ? e.splitAmong : [e.paidBy];
    add(e.paidBy, e.amount);
    const share = Math.floor(e.amount / among.length);
    let rest = e.amount - share * among.length;
    for (const id of among) {
      add(id, -(share + (rest > 0 ? 1 : 0)));
      if (rest > 0) rest--;
    }
  }
  return net;
}

/** Simplified debts: who pays whom. */
export function settlements(expenses: Expense[], members: Member[]) {
  const net = balances(expenses);
  const debtors = members.map((m) => ({ m, v: net.get(m.id) ?? 0 })).filter((x) => x.v < 0).sort((a, b) => a.v - b.v);
  const creditors = members.map((m) => ({ m, v: net.get(m.id) ?? 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const out: { from: Member; to: Member; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(-debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ from: debtors[i].m, to: creditors[j].m, amount: amt });
    debtors[i].v += amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}
