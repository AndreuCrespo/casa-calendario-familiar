import type { Task } from '../shared/types';

/** One-off tasks are deleted this long after being completed. */
export const DONE_TASK_TTL_DAYS = 30;

/** Completed one-off tasks older than the retention period. */
export function expiredDoneTasks(tasks: Task[], now = Date.now()) {
  const cutoff = now - DONE_TASK_TTL_DAYS * 86_400_000;
  return tasks.filter((x) => x.done && !x.repeat && (x.lastDoneAt ?? x.createdAt ?? now) < cutoff);
}

/** All completed one-off tasks (for the "clear completed" button). */
export const doneTasks = (tasks: Task[]) => tasks.filter((x) => x.done && !x.repeat);
