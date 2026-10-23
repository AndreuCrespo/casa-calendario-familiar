import { useMemo, useState } from 'react';
import { ListChecks, Plus, Repeat, Trash2 } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { dayRelative, memberNames } from '../lib/format';
import { DONE_TASK_TTL_DAYS, doneTasks } from '../lib/tasks';
import { nextTaskDue } from '../shared/recurrence';
import type { RepeatUnit, Task } from '../shared/types';
import { CheckCircle, Empty, MemberDots, MemberPicker, PageHead, Sheet, toast } from '../components/ui';
import { t, tn } from '../i18n';

const UNIT_KEY = { day: 'unit.day', week: 'unit.week', month: 'unit.month' } as const;
const UNIT_NOUN_KEY = { day: 'unitNoun.day', week: 'unitNoun.week', month: 'unitNoun.month' } as const;

/** "every 2 weeks" / "cada 2 semanas" */
function repeatLabel(r: Task['repeat']) {
  if (!r) return '';
  return t('repeat.everyUnit', { unit: tn(UNIT_KEY[r.unit], r.every) });
}

export default function Tasks() {
  const { backend, me, members } = useApp();
  const today = useToday();
  const tasks = useCollection<Task>('tasks');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [mine, setMine] = useState(false);

  const groups = useMemo(() => {
    let list = tasks ?? [];
    if (mine && me) list = list.filter((x) => !x.memberIds.length || x.memberIds.includes(me.id));
    const open = list.filter((x) => !x.done).sort((a, b) => (a.due ?? '9999') < (b.due ?? '9999') ? -1 : 1);
    return {
      overdue: open.filter((x) => x.due && x.due < today),
      today: open.filter((x) => x.due === today),
      upcoming: open.filter((x) => x.due && x.due > today),
      someday: open.filter((x) => !x.due),
      done: list.filter((x) => x.done).sort((a, b) => (b.lastDoneAt ?? 0) - (a.lastDoneAt ?? 0)),
    };
  }, [tasks, today, mine, me]);

  const complete = (task: Task) => {
    if (task.done) {
      backend.update('tasks', task.id, { done: false });
      return;
    }
    const prev = { due: task.due ?? null, done: task.done, lastDoneAt: task.lastDoneAt ?? null, lastDoneBy: task.lastDoneBy ?? null };
    const undo = { label: t('common.undo'), run: () => backend.update('tasks', task.id, prev) };
    if (task.repeat) {
      const next = nextTaskDue(task, today);
      backend.update('tasks', task.id, { due: next, lastDoneAt: Date.now(), lastDoneBy: me?.id ?? null });
      toast(t('tasks.doneNext', { when: dayRelative(next!, today).toLowerCase() }), undo);
    } else {
      backend.update('tasks', task.id, { done: true, lastDoneAt: Date.now(), lastDoneBy: me?.id ?? null });
      toast(t('tasks.doneToast'), undo);
    }
  };

  const clearDone = () => {
    const list = doneTasks(tasks ?? []);
    list.forEach((x) => backend.remove('tasks', x.id));
    toast(tn('tasks.cleared', list.length));
  };

  const Row = ({ task }: { task: Task }) => {
    const overdue = !task.done && task.due && task.due < today;
    return (
      <div className={`list-item${task.done ? ' done' : ''}`}>
        <CheckCircle on={task.done} onClick={() => complete(task)} />
        <div className="grow clickable" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setEditing(task)}>
          <div className="item-title">{task.title}</div>
          <div className="item-sub row" style={{ gap: 6 }}>
            {task.due && !task.done && <span style={overdue ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{dayRelative(task.due, today)}</span>}
            {task.repeat && <span className="row" style={{ gap: 3 }}><Repeat size={12} />{repeatLabel(task.repeat)}</span>}
            {task.memberIds.length > 0 && <span className="ellipsis">{(task.due && !task.done) || task.repeat ? '· ' : ''}{memberNames(task.memberIds, members)}</span>}
          </div>
        </div>
        <MemberDots ids={task.memberIds} members={members} />
      </div>
    );
  };

  const Section = ({ title, list }: { title: string; list: Task[] }) => list.length ? (
    <>
      <div className="section-title">{title}</div>
      <div className="list">{list.map((x) => <Row key={x.id} task={x} />)}</div>
    </>
  ) : null;

  const totalOpen = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.someday.length;

  return (
    <>
      <PageHead title={t('nav.tasks')} sub={t('tasks.forToday', { n: groups.overdue.length + groups.today.length })}>
        <div className="seg">
          <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>{t('tasks.all')}</button>
          <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>{t('tasks.mine')}</button>
        </div>
      </PageHead>

      {tasks && totalOpen === 0 && (
        <Empty icon={ListChecks} title={t('tasks.emptyTitle')}>{t('tasks.emptyText')}</Empty>
      )}

      <Section title={t('tasks.overdue')} list={groups.overdue} />
      <Section title={t('date.today')} list={groups.today} />
      <Section title={t('tasks.upcoming')} list={groups.upcoming} />
      <Section title={t('tasks.noDate')} list={groups.someday} />

      {groups.done.length > 0 && (
        <>
          <div className="section-title">
            <span>{t('tasks.done')}</span>
            <div className="grow" />
            <button className="btn ghost sm" onClick={clearDone}><Trash2 size={15} /> {t('tasks.clearDone')}</button>
          </div>
          <div className="list">{groups.done.map((x) => <Row key={x.id} task={x} />)}</div>
          <p className="tiny muted" style={{ margin: '8px 4px 0' }}>{t('tasks.autoDelete', { n: DONE_TASK_TTL_DAYS })}</p>
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label={t('tasks.new')}><Plus size={28} /></button>
      {editing && <TaskEditor task={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TaskEditor({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { backend, me, members, log } = useApp();
  const today = useToday();
  const [title, setTitle] = useState(task?.title ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(task?.memberIds ?? (me ? [me.id] : []));
  const [due, setDue] = useState(task?.due ?? today);
  const [hasDue, setHasDue] = useState(task ? !!task.due : true);
  const [repeatOn, setRepeatOn] = useState(!!task?.repeat);
  const [every, setEvery] = useState(task?.repeat?.every ?? 1);
  const [unit, setUnit] = useState<RepeatUnit>(task?.repeat?.unit ?? 'week');
  const [notes, setNotes] = useState(task?.notes ?? '');

  const save = () => {
    if (!title.trim()) { toast(t('tasks.needName')); return; }
    const data = {
      title: title.trim(),
      memberIds,
      due: hasDue ? due : null,
      repeat: repeatOn ? { every: Math.max(1, every), unit } : null,
      notes: notes.trim(),
    };
    if (task) backend.update('tasks', task.id, data);
    else {
      backend.add('tasks', { ...data, done: false, createdAt: Date.now() });
      log('task', data.title);
    }
    onClose();
  };

  return (
    <Sheet
      title={task ? t('tasks.edit') : t('tasks.new')}
      onClose={onClose}
      footer={<>
        {task && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('tasks', task.id); onClose(); }} aria-label={t('common.delete')}><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>{t('common.save')}</button>
      </>}
    >
      <input className="input" style={{ fontSize: 18, fontWeight: 700 }} placeholder={t('tasks.titlePlaceholder')} value={title}
        onChange={(e) => setTitle(e.target.value)} autoFocus={!task} />
      <div className="field"><span>{t('tasks.who')}</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>
      <label className="switch">{t('tasks.hasDate')}
        <input type="checkbox" checked={hasDue} onChange={(e) => setHasDue(e.target.checked)} />
      </label>
      {hasDue && (
        <label className="field"><span>{repeatOn ? t('tasks.nextTime') : t('tasks.dueOn')}</span>
          <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
        </label>
      )}
      <label className="switch">{t('tasks.repeats')}
        <input type="checkbox" checked={repeatOn} onChange={(e) => setRepeatOn(e.target.checked)} />
      </label>
      {repeatOn && (
        <div className="grid2">
          <label className="field"><span>{t('repeat.every')}</span>
            <input type="number" min={1} max={365} value={every} onChange={(e) => setEvery(Number(e.target.value))} />
          </label>
          <label className="field"><span>&nbsp;</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as RepeatUnit)}>
              {(['day', 'week', 'month'] as const).map((u) => (
                <option key={u} value={u}>{tn(UNIT_NOUN_KEY[u], every)}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="field"><span>{t('common.notes')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('common.optional')} />
      </label>
    </Sheet>
  );
}
