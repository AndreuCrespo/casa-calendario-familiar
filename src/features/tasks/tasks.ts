import { t, tn } from '../../i18n';
import type { DateStr } from '../../shared/dates';
import type { Task } from '../../shared/types';

/** One-off tasks are deleted this long after being completed. */
export const DONE_TASK_TTL_DAYS = 30;

/** Completed one-off tasks older than the retention period. */
export function expiredDoneTasks(tasks: readonly Task[], now = Date.now()) {
  const cutoff = now - DONE_TASK_TTL_DAYS * 86_400_000;
  return tasks.filter((x) => x.done && !x.repeat && (x.lastDoneAt ?? x.createdAt ?? now) < cutoff);
}

/** All completed one-off tasks (for the "clear completed" button). */
export const doneTasks = (tasks: readonly Task[]) => tasks.filter((x) => x.done && !x.repeat);

export const isOverdue = (task: Task, today: DateStr) => !task.done && !!task.due && task.due < today;

/** Pending tasks due today or earlier, earliest first. */
export const dueTasks = (tasks: readonly Task[], today: DateStr) =>
  tasks.filter((x) => !x.done && x.due && x.due <= today).sort((a, b) => ((a.due ?? '') < (b.due ?? '') ? -1 : 1));

const UNIT_KEY = { day: 'unit.day', week: 'unit.week', month: 'unit.month' } as const;

/** "every 2 weeks" / "cada 2 semanas" */
export function repeatLabel(r: Task['repeat']) {
  return r ? t('repeat.everyUnit', { unit: tn(UNIT_KEY[r.unit], r.every) }) : '';
}

export interface TaskGroups {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  someday: Task[];
  done: Task[];
}

export function groupTasks(tasks: readonly Task[], today: DateStr, onlyFor?: string): TaskGroups {
  const list = onlyFor ? tasks.filter((x) => !x.memberIds.length || x.memberIds.includes(onlyFor)) : tasks;
  const open = list.filter((x) => !x.done).sort((a, b) => ((a.due ?? '9999') < (b.due ?? '9999') ? -1 : 1));
  return {
    overdue: open.filter((x) => x.due && x.due < today),
    today: open.filter((x) => x.due === today),
    upcoming: open.filter((x) => x.due && x.due > today),
    someday: open.filter((x) => !x.due),
    done: list.filter((x) => x.done).sort((a, b) => (b.lastDoneAt ?? 0) - (a.lastDoneAt ?? 0)),
  };
}
