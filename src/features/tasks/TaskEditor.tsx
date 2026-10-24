import { useState } from 'react';
import { useApp, useToday } from '../../core/app';
import { t, tn } from '../../i18n';
import { LIMITS } from '../../shared/limits';
import type { RepeatUnit, Task } from '../../shared/types';
import { DeleteButton } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { MemberPicker } from '../members/members';

const UNIT_NOUN_KEY = { day: 'unitNoun.day', week: 'unitNoun.week', month: 'unitNoun.month' } as const;

export function TaskEditor({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { backend, me, members, log } = useApp();
  const today = useToday();
  const [title, setTitle] = useState(task?.title ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(task?.memberIds ?? (me ? [me.id] : []));
  const [due, setDue] = useState(task?.due ?? today);
  const [hasDue, setHasDue] = useState(task ? !!task.due : true);
  const [repeatOn, setRepeatOn] = useState(!!task?.repeat);
  // Kept as typed so the field can be cleared while editing it.
  const [every, setEvery] = useState(String(task?.repeat?.every ?? 1));
  const [unit, setUnit] = useState<RepeatUnit>(task?.repeat?.unit ?? 'week');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const everyN = Math.min(365, Math.max(1, Math.round(Number(every)) || 1));

  const save = () => {
    const name = title.trim();
    if (!name) {
      toast(t('tasks.needName'));
      return;
    }
    const data = {
      title: name,
      memberIds,
      due: hasDue ? due : null,
      repeat: repeatOn ? { every: everyN, unit } : null,
      notes: notes.trim(),
    };
    if (task) backend.update('tasks', task.id, data);
    else {
      backend.add('tasks', { ...data, done: false, createdAt: Date.now() });
      log('task', name);
    }
    onClose();
  };

  return (
    <Sheet
      title={task ? t('tasks.edit') : t('tasks.new')}
      onClose={onClose}
      footer={
        <>
          {task && (
            <DeleteButton
              onClick={() => {
                backend.remove('tasks', task.id);
                onClose();
              }}
            />
          )}
          <button type="button" className="btn accent" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <input
        className="input title-input"
        placeholder={t('tasks.titlePlaceholder')}
        aria-label={t('tasks.titlePlaceholder')}
        value={title}
        maxLength={LIMITS.title}
        onChange={(e) => setTitle(e.target.value)}
        // biome-ignore lint/a11y/noAutofocus: the sheet was opened to type a new task
        autoFocus={!task}
      />
      <div className="field">
        <span>{t('tasks.who')}</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>
      <label className="switch">
        {t('tasks.hasDate')}
        <input type="checkbox" checked={hasDue} onChange={(e) => setHasDue(e.target.checked)} />
      </label>
      {hasDue && (
        <label className="field">
          <span>{repeatOn ? t('tasks.nextTime') : t('tasks.dueOn')}</span>
          <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
        </label>
      )}
      <label className="switch">
        {t('tasks.repeats')}
        <input type="checkbox" checked={repeatOn} onChange={(e) => setRepeatOn(e.target.checked)} />
      </label>
      {repeatOn && (
        <div className="grid2">
          <label className="field">
            <span>{t('repeat.every')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={every}
              onChange={(e) => setEvery(e.target.value)}
              onBlur={() => setEvery(String(everyN))}
            />
          </label>
          <label className="field">
            <span aria-hidden="true">&nbsp;</span>
            <select value={unit} aria-label={t('tasks.unit')} onChange={(e) => setUnit(e.target.value as RepeatUnit)}>
              {(['day', 'week', 'month'] as const).map((u) => (
                <option key={u} value={u}>
                  {tn(UNIT_NOUN_KEY[u], everyN)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="field">
        <span>{t('common.notes')}</span>
        <textarea
          value={notes}
          maxLength={LIMITS.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('common.optional')}
        />
      </label>
    </Sheet>
  );
}
