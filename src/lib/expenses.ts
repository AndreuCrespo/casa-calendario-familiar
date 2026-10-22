import type { Expense, Member } from '../shared/types';

export const CATEGORIES: { id: string; label: string; emoji: string; color: string }[] = [
  { id: 'super', label: 'Súper', emoji: '🛒', color: '#22A06B' },
  { id: 'casa', label: 'Casa', emoji: '🏠', color: '#4C7DF0' },
  { id: 'facturas', label: 'Facturas', emoji: '💡', color: '#F08C2E' },
  { id: 'ninas', label: 'Peques', emoji: '🧸', color: '#8B5CF6' },
  { id: 'coche', label: 'Coche', emoji: '🚗', color: '#14A3B8' },
  { id: 'salud', label: 'Salud', emoji: '🩺', color: '#E2558A' },
  { id: 'ocio', label: 'Ocio', emoji: '🎉', color: '#D9483B' },
  { id: 'otros', label: 'Otros', emoji: '📦', color: '#968D81' },
];

export const category = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** Saldo neto por miembro (positivo = le deben). */
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

/** Deudas simplificadas: quién paga a quién. */
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
