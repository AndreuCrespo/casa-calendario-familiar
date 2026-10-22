import { useMemo, useState } from 'react';
import { ListChecks, Plus, Repeat, Trash2 } from 'lucide-react';
import { useApp, useCollection, useToday } from '../lib/app';
import { dayRelative, memberNames } from '../lib/format';
import { nextTaskDue } from '../shared/recurrence';
import type { RepeatUnit, Task } from '../shared/types';
import { CheckCircle, Empty, MemberDots, MemberPicker, PageHead, Sheet, toast } from '../components/ui';

function repeatLabel(r: Task['repeat']) {
  if (!r) return '';
  const u = { day: ['día', 'días'], week: ['semana', 'semanas'], month: ['mes', 'meses'] }[r.unit];
  return r.every === 1 ? `cada ${u[0]}` : `cada ${r.every} ${u[1]}`;
}

export default function Tasks() {
  const { backend, me, members } = useApp();
  const today = useToday();
  const tasks = useCollection<Task>('tasks');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [mine, setMine] = useState(false);

  const groups = useMemo(() => {
    let list = tasks ?? [];
    if (mine && me) list = list.filter((t) => !t.memberIds.length || t.memberIds.includes(me.id));
    const open = list.filter((t) => !t.done).sort((a, b) => (a.due ?? '9999') < (b.due ?? '9999') ? -1 : 1);
    return {
      overdue: open.filter((t) => t.due && t.due < today),
      today: open.filter((t) => t.due === today),
      upcoming: open.filter((t) => t.due && t.due > today),
      someday: open.filter((t) => !t.due),
      done: list.filter((t) => t.done).sort((a, b) => (b.lastDoneAt ?? 0) - (a.lastDoneAt ?? 0)).slice(0, 15),
    };
  }, [tasks, today, mine, me]);

  const complete = (t: Task) => {
    if (t.done) {
      backend.update('tasks', t.id, { done: false });
      return;
    }
    const prev = { due: t.due ?? null, done: t.done, lastDoneAt: t.lastDoneAt ?? null, lastDoneBy: t.lastDoneBy ?? null };
    if (t.repeat) {
      const next = nextTaskDue(t, today);
      backend.update('tasks', t.id, { due: next, lastDoneAt: Date.now(), lastDoneBy: me?.id ?? null });
      toast(`Hecho ✓ Próxima: ${dayRelative(next!, today).toLowerCase()}`, { label: 'Deshacer', run: () => backend.update('tasks', t.id, prev) });
    } else {
      backend.update('tasks', t.id, { done: true, lastDoneAt: Date.now(), lastDoneBy: me?.id ?? null });
      toast('Hecho ✓', { label: 'Deshacer', run: () => backend.update('tasks', t.id, prev) });
    }
  };

  const Row = ({ t }: { t: Task }) => {
    const overdue = !t.done && t.due && t.due < today;
    return (
      <div className={`list-item${t.done ? ' done' : ''}`}>
        <CheckCircle on={t.done} onClick={() => complete(t)} />
        <div className="grow clickable" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setEditing(t)}>
          <div className="item-title">{t.title}</div>
          <div className="item-sub row" style={{ gap: 6 }}>
            {t.due && !t.done && <span style={overdue ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{dayRelative(t.due, today)}</span>}
            {t.repeat && <span className="row" style={{ gap: 3 }}><Repeat size={12} />{repeatLabel(t.repeat)}</span>}
            {t.memberIds.length > 0 && <span className="ellipsis">{(t.due && !t.done) || t.repeat ? '· ' : ''}{memberNames(t.memberIds, members)}</span>}
          </div>
        </div>
        <MemberDots ids={t.memberIds} members={members} />
      </div>
    );
  };

  const Section = ({ title, list }: { title: string; list: Task[] }) => list.length ? (
    <>
      <div className="section-title">{title}</div>
      <div className="list">{list.map((t) => <Row key={t.id} t={t} />)}</div>
    </>
  ) : null;

  const totalOpen = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.someday.length;

  return (
    <>
      <PageHead title="Tareas" sub={`${groups.overdue.length + groups.today.length} para hoy`}>
        <div className="seg">
          <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Todas</button>
          <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Mías</button>
        </div>
      </PageHead>

      {tasks && totalOpen === 0 && (
        <Empty icon={ListChecks} title="Nada pendiente">Añade tareas de casa: las que se repiten vuelven solas cuando las marcas.</Empty>
      )}

      <Section title="Atrasadas" list={groups.overdue} />
      <Section title="Hoy" list={groups.today} />
      <Section title="Próximas" list={groups.upcoming} />
      <Section title="Sin fecha" list={groups.someday} />
      <Section title="Hechas" list={groups.done} />

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva tarea"><Plus size={28} /></button>
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
    if (!title.trim()) { toast('Ponle un nombre'); return; }
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
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      footer={<>
        {task && <button className="btn danger" style={{ flex: 'none' }} onClick={() => { backend.remove('tasks', task.id); onClose(); }} aria-label="Borrar"><Trash2 size={20} /></button>}
        <button className="btn accent" onClick={save}>Guardar</button>
      </>}
    >
      <input className="input" style={{ fontSize: 18, fontWeight: 700 }} placeholder="Ej: Sacar la basura" value={title}
        onChange={(e) => setTitle(e.target.value)} autoFocus={!task} />
      <div className="field"><span>¿Quién se encarga?</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>
      <label className="switch">Tiene fecha
        <input type="checkbox" checked={hasDue} onChange={(e) => setHasDue(e.target.checked)} />
      </label>
      {hasDue && (
        <label className="field"><span>{repeatOn ? 'Próxima vez' : 'Para el día'}</span>
          <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
        </label>
      )}
      <label className="switch">Se repite
        <input type="checkbox" checked={repeatOn} onChange={(e) => setRepeatOn(e.target.checked)} />
      </label>
      {repeatOn && (
        <div className="grid2">
          <label className="field"><span>Cada</span>
            <input type="number" min={1} max={365} value={every} onChange={(e) => setEvery(Number(e.target.value))} />
          </label>
          <label className="field"><span>&nbsp;</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as RepeatUnit)}>
              <option value="day">{every === 1 ? 'día' : 'días'}</option>
              <option value="week">{every === 1 ? 'semana' : 'semanas'}</option>
              <option value="month">{every === 1 ? 'mes' : 'meses'}</option>
            </select>
          </label>
        </div>
      )}
      <label className="field"><span>Notas</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </label>
    </Sheet>
  );
}
