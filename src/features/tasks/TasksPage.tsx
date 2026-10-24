import { ListChecks, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useApp, useCollection, useToday } from '../../core/app';
import { dayRelative } from '../../core/format';
import { t, tn } from '../../i18n';
import { nextTaskDue } from '../../shared/recurrence';
import type { Task } from '../../shared/types';
import { Empty, Fab, PageHead, Segmented } from '../../ui/primitives';
import { toast } from '../../ui/Toast';
import { TaskEditor } from './TaskEditor';
import { TaskRow, TaskSection } from './TaskRow';
import { DONE_TASK_TTL_DAYS, doneTasks, groupTasks } from './tasks';

type Who = 'all' | 'mine';

export default function TasksPage() {
  const { backend, me, membersById } = useApp();
  const today = useToday();
  const tasks = useCollection('tasks');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [who, setWho] = useState<Who>('all');

  const groups = useMemo(
    () => groupTasks(tasks ?? [], today, who === 'mine' ? me?.id : undefined),
    [tasks, today, who, me],
  );

  const toggle = useCallback(
    (task: Task) => {
      if (task.done) {
        backend.update('tasks', task.id, { done: false });
        return;
      }
      const prev = {
        due: task.due ?? null,
        done: task.done,
        lastDoneAt: task.lastDoneAt ?? null,
        lastDoneBy: task.lastDoneBy ?? null,
      };
      const undo = { label: t('common.undo'), run: () => backend.update('tasks', task.id, prev) };
      const done = { lastDoneAt: Date.now(), lastDoneBy: me?.id ?? null };
      const next = task.repeat ? nextTaskDue(task, today) : null;
      if (next) {
        backend.update('tasks', task.id, { ...done, due: next });
        toast(t('tasks.doneNext', { when: dayRelative(next, today).toLowerCase() }), undo);
      } else {
        backend.update('tasks', task.id, { ...done, done: true });
        toast(t('tasks.doneToast'), undo);
      }
    },
    [backend, me, today],
  );

  const open = useCallback((task: Task) => setEditing(task), []);

  const clearDone = () => {
    const list = doneTasks(tasks ?? []);
    for (const x of list) backend.remove('tasks', x.id);
    toast(tn('tasks.cleared', list.length));
  };

  const sections = [
    { title: t('tasks.overdue'), list: groups.overdue },
    { title: t('date.today'), list: groups.today },
    { title: t('tasks.upcoming'), list: groups.upcoming },
    { title: t('tasks.noDate'), list: groups.someday },
  ];
  const totalOpen = sections.reduce((n, s) => n + s.list.length, 0);
  const row = (x: Task) => (
    <TaskRow key={x.id} task={x} today={today} members={membersById} onToggle={toggle} onOpen={open} />
  );

  return (
    <>
      <PageHead title={t('nav.tasks')} sub={t('tasks.forToday', { n: groups.overdue.length + groups.today.length })}>
        <Segmented
          label={t('tasks.whose')}
          value={who}
          onChange={setWho}
          options={[
            { id: 'all', label: t('tasks.all') },
            { id: 'mine', label: t('tasks.mine') },
          ]}
        />
      </PageHead>

      {tasks && totalOpen === 0 && (
        <Empty icon={ListChecks} title={t('tasks.emptyTitle')}>
          {t('tasks.emptyText')}
        </Empty>
      )}

      {sections.map(
        (s) =>
          s.list.length > 0 && (
            <TaskSection key={s.title} title={s.title}>
              {s.list.map(row)}
            </TaskSection>
          ),
      )}

      {groups.done.length > 0 && (
        <>
          <div className="section-title">
            <h2 className="grow">{t('tasks.done')}</h2>
            <button type="button" className="btn ghost sm" onClick={clearDone}>
              <Trash2 size={15} aria-hidden="true" /> {t('tasks.clearDone')}
            </button>
          </div>
          <ul className="list">{groups.done.map(row)}</ul>
          <p className="tiny muted note-below">{t('tasks.autoDelete', { n: DONE_TASK_TTL_DAYS })}</p>
        </>
      )}

      <Fab label={t('tasks.new')} onClick={() => setEditing('new')} />
      {editing && <TaskEditor task={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
