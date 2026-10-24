import { describe, expect, it } from 'vitest';
import type { Expense, Member } from '../../shared/types';
import { balances, category, categoryId, monthTotal, settlements } from './expenses';

const adult = (id: string): Member => ({ id, name: id.toUpperCase(), color: '#000000', kind: 'adult', uid: null });
const A = adult('a');
const B = adult('b');
const C = adult('c');

let n = 0;
const expense = (e: Partial<Expense>): Expense => ({
  id: `e${n++}`,
  description: 'x',
  amount: 1000,
  paidBy: 'a',
  splitAmong: ['a', 'b'],
  date: '2026-10-01',
  category: 'other',
  kind: 'expense',
  createdAt: 0,
  ...e,
});

describe('balances', () => {
  it('splits evenly and the balances add up to zero', () => {
    const net = balances([expense({ amount: 1000, paidBy: 'a', splitAmong: ['a', 'b'] })]);
    expect(net.get('a')).toBe(500);
    expect(net.get('b')).toBe(-500);
  });

  it('never loses a cent when the amount does not divide evenly', () => {
    const net = balances([expense({ amount: 1001, paidBy: 'a', splitAmong: ['a', 'b', 'c'] })]);
    expect([...net.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });

  it('treats an empty split as paid for oneself', () => {
    const net = balances([expense({ splitAmong: [] })]);
    expect(net.get('a')).toBe(0);
  });

  it('counts settle-up payments', () => {
    const net = balances([
      expense({ amount: 1000, paidBy: 'a' }),
      expense({ kind: 'settle', amount: 500, paidBy: 'b', splitAmong: ['a'] }),
    ]);
    expect(net.get('a')).toBe(0);
    expect(net.get('b')).toBe(0);
  });
});

describe('settlements', () => {
  it('is empty when everyone is even', () => {
    expect(settlements([], [A, B])).toEqual([]);
  });

  it('uses as few payments as possible', () => {
    const out = settlements(
      [
        expense({ amount: 3000, paidBy: 'a', splitAmong: ['a', 'b', 'c'] }),
        expense({ amount: 600, paidBy: 'b', splitAmong: ['a', 'b', 'c'] }),
      ],
      [A, B, C],
    );
    expect(out.map((s) => [s.from.id, s.to.id, s.amount])).toEqual([
      ['c', 'a', 1200],
      ['b', 'a', 600],
    ]);
  });
});

describe('categories', () => {
  it('maps the Spanish ids of earlier versions', () => {
    expect(categoryId('super')).toBe('groceries');
    expect(categoryId('otros')).toBe('other');
    expect(category('unknown').id).toBe('other');
  });

  it('totals a month without settle-ups', () => {
    const list = [
      expense({ amount: 100, date: '2026-10-03' }),
      expense({ amount: 200, date: '2026-09-30' }),
      expense({ amount: 300, date: '2026-10-05', kind: 'settle' }),
    ];
    expect(monthTotal(list, '2026-10')).toBe(100);
  });
});
