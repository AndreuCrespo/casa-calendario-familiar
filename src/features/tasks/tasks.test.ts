import { describe, expect, it } from 'vitest';
import type { Task } from '../../shared/types';
import { DONE_TASK_TTL_DAYS, doneTasks, dueTasks, expiredDoneTasks, groupTasks } from './tasks';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 24, 12);

let n = 0;
const task = (t: Partial<Task>): Task => ({
  id: `t${n++}`,
  title: 'x',
  memberIds: [],
  done: false,
  createdAt: NOW - 100 * DAY,
  ...t,
});

describe('expiredDoneTasks', () => {
  it('only removes one-off tasks completed before the cutoff', () => {
    const old = task({ done: true, lastDoneAt: NOW - (DONE_TASK_TTL_DAYS + 1) * DAY });
    const recent = task({ done: true, lastDoneAt: NOW - (DONE_TASK_TTL_DAYS - 1) * DAY });
    const repeating = task({ done: true, lastDoneAt: NOW - 90 * DAY, repeat: { every: 1, unit: 'week' } });
    const open = task({});
    expect(expiredDoneTasks([old, recent, repeating, open], NOW)).toEqual([old]);
  });

  it('falls back to the creation date', () => {
    const legacy = task({ done: true, lastDoneAt: null, createdAt: NOW - 60 * DAY });
    expect(expiredDoneTasks([legacy], NOW)).toEqual([legacy]);
  });

  it('clears every completed one-off task on demand', () => {
    const done = task({ done: true });
    expect(doneTasks([done, task({}), task({ done: true, repeat: { every: 1, unit: 'day' } })])).toEqual([done]);
  });
});

describe('grouping', () => {
  const today = '2026-10-24';
  const overdue = task({ due: '2026-10-20' });
  const due = task({ due: today, memberIds: ['a'] });
  const later = task({ due: '2026-10-30', memberIds: ['b'] });
  const someday = task({});
  const finished = task({ done: true, lastDoneAt: NOW });
  const all = [later, finished, someday, due, overdue];

  it('sorts tasks into sections', () => {
    const g = groupTasks(all, today);
    expect(g.overdue).toEqual([overdue]);
    expect(g.today).toEqual([due]);
    expect(g.upcoming).toEqual([later]);
    expect(g.someday).toEqual([someday]);
    expect(g.done).toEqual([finished]);
  });

  it('shows my tasks and the ones assigned to nobody', () => {
    const g = groupTasks(all, today, 'a');
    expect(g.today).toEqual([due]);
    expect(g.upcoming).toEqual([]);
    expect(g.someday).toEqual([someday]);
  });

  it('lists what is due by today, earliest first', () => {
    expect(dueTasks(all, today)).toEqual([overdue, due]);
  });
});
