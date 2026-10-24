import { Repeat } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { dayRelative } from '../../core/format';
import type { DateStr } from '../../shared/dates';
import type { Member, Task } from '../../shared/types';
import { CheckCircle } from '../../ui/primitives';
import { MemberDots, memberNames } from '../members/members';
import { isOverdue, repeatLabel } from './tasks';

export const TaskRow = memo(function TaskRow({
  task,
  today,
  members,
  onToggle,
  onOpen,
}: {
  task: Task;
  today: DateStr;
  members: ReadonlyMap<string, Member>;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const overdue = isOverdue(task, today);
  const showDue = task.due && !task.done;
  const who = memberNames(task.memberIds, members);
  return (
    <li className={`list-item${task.done ? ' done' : ''}`}>
      <CheckCircle on={task.done} onClick={() => onToggle(task)} label={task.title} />
      <button type="button" className="grow item-main" onClick={() => onOpen(task)}>
        <span className="item-title block">{task.title}</span>
        <span className="item-sub row gap-6">
          {showDue && <span className={overdue ? 'overdue' : undefined}>{dayRelative(task.due ?? today, today)}</span>}
          {task.repeat && (
            <span className="row gap-4">
              <Repeat size={12} aria-hidden="true" />
              {repeatLabel(task.repeat)}
            </span>
          )}
          {who && (
            <span className="ellipsis">
              {showDue || task.repeat ? '· ' : ''}
              {who}
            </span>
          )}
        </span>
      </button>
      <MemberDots ids={task.memberIds} members={members} />
    </li>
  );
});

export function TaskSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
      <ul className="list">{children}</ul>
    </>
  );
}
