import { useReducer, useState } from 'react';
import { useApp } from '../../core/app';
import { dayLong, dowLetter, dowLong, hm } from '../../core/format';
import { type MessageKey, t, tn } from '../../i18n';
import { addDays, type DateStr, timeToMinutes, todayIn, weekday, zonedParts } from '../../shared/dates';
import { LIMITS } from '../../shared/limits';
import { ALLDAY_REMINDERS, TIMED_REMINDERS } from '../../shared/reminders';
import type { CalEvent, Freq } from '../../shared/types';
import { DeleteButton } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { MemberPicker } from '../members/members';

type RepeatSel = 'none' | Freq;

const REMINDER_LABEL: Record<string, MessageKey> = {
  'timed:0': 'reminder.atTime',
  'timed:10': 'reminder.min10',
  'timed:30': 'reminder.min30',
  'timed:60': 'reminder.hour1',
  'timed:120': 'reminder.hours2',
  'timed:1440': 'reminder.day1',
  'allday:0': 'reminder.sameDay9',
  'allday:780': 'reminder.dayBefore20',
};

/** Reminder choices: none, then the options the notifier supports. */
const reminderOptions = (allDay: boolean): [number | null, MessageKey][] => {
  const kind = allDay ? 'allday' : 'timed';
  const values: readonly number[] = allDay ? ALLDAY_REMINDERS : TIMED_REMINDERS;
  return [
    [null, 'reminder.none'],
    ...values.map((v): [number, MessageKey] => [v, REMINDER_LABEL[`${kind}:${v}`] ?? 'reminder.none']),
  ];
};

const UNIT_KEY = { daily: 'unit.day', weekly: 'unit.week', monthly: 'unit.month', yearly: 'unit.year' } as const;

const addMinutes = (time: string, minutes: number) => {
  const m = (((timeToMinutes(time) + minutes) % 1440) + 1440) % 1440;
  return hm(Math.floor(m / 60), m % 60);
};

/** Default start for a new event: the next full hour today, 09:00 on other days. */
function defaultStart(date: DateStr, tz: string): { date: DateStr; time: string } {
  const now = zonedParts(Date.now(), tz);
  if (date !== todayIn(tz)) return { date, time: '09:00' };
  return now.hour === 23 ? { date: addDays(date, 1), time: '09:00' } : { date, time: hm(now.hour + 1) };
}

interface Form {
  title: string;
  memberIds: string[];
  allDay: boolean;
  start: DateStr;
  multi: boolean;
  end: DateStr;
  startTime: string;
  endTime: string;
  repeat: RepeatSel;
  every: number;
  /** Weekdays chosen by hand; null follows the start date. */
  byWeekday: number[] | null;
  until: string;
  reminder: number | null;
  location: string;
  notes: string;
}

function initialForm(event: CalEvent | undefined, date: DateStr, tz: string, me: string | undefined): Form {
  if (event) {
    const startTime = event.startTime ?? '09:00';
    return {
      title: event.title,
      memberIds: event.memberIds ?? [],
      allDay: !event.startTime,
      start: event.date,
      multi: !!(event.endDate && event.endDate > event.date),
      end: event.endDate ?? event.date,
      startTime,
      endTime: event.endTime ?? addMinutes(startTime, 60),
      repeat: event.recurrence?.freq ?? 'none',
      every: event.recurrence?.interval ?? 1,
      byWeekday: event.recurrence?.byWeekday ?? null,
      until: event.recurrence?.until ?? '',
      reminder: event.reminderMins ?? null,
      location: event.location ?? '',
      notes: event.notes ?? '',
    };
  }
  const s = defaultStart(date, tz);
  return {
    title: '',
    memberIds: me ? [me] : [],
    allDay: false,
    start: s.date,
    multi: false,
    end: s.date,
    startTime: s.time,
    endTime: addMinutes(s.time, 60),
    repeat: 'none',
    every: 1,
    byWeekday: null,
    until: '',
    reminder: null,
    location: '',
    notes: '',
  };
}

export type EventEditorProps =
  | { mode: 'new'; date: DateStr; onClose: () => void }
  /** `occurrence`: the date of the repetition that was opened. */
  | { mode: 'edit'; event: CalEvent; occurrence?: DateStr; onClose: () => void };

export function EventEditor(props: EventEditorProps) {
  const { onClose } = props;
  const event = props.mode === 'edit' ? props.event : undefined;
  const occurrence = props.mode === 'edit' ? props.occurrence : undefined;
  const { backend, me, members, log, tz } = useApp();
  const [f, set] = useReducer(
    (s: Form, patch: Partial<Form>) => ({ ...s, ...patch }),
    null,
    () => initialForm(event, props.mode === 'new' ? props.date : '', tz, me?.id),
  );
  const [askDelete, setAskDelete] = useState(false);

  const reminders = reminderOptions(f.allDay);
  const unitKey = f.repeat === 'none' ? null : UNIT_KEY[f.repeat];
  const weekdays = f.byWeekday ?? [weekday(f.start)];

  const onStartDate = (v: DateStr) => {
    if (!v) return;
    // Weekdays that only mirrored the old start date follow the new one.
    const followed = !f.byWeekday || (f.byWeekday.length === 1 && f.byWeekday[0] === weekday(f.start));
    set({ start: v, end: f.end < v ? v : f.end, byWeekday: followed ? null : f.byWeekday });
  };

  // Moving the start keeps the duration
  const onStartTime = (value: string) => {
    if (!value) return;
    const dur = (timeToMinutes(f.endTime) - timeToMinutes(f.startTime) + 1440) % 1440;
    set({ startTime: value, endTime: addMinutes(value, dur) });
  };

  const toggleWeekday = (i: number) =>
    set({ byWeekday: weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort((a, b) => a - b) });

  const save = () => {
    const title = f.title.trim();
    if (!title) {
      toast(t('event.needTitle'));
      return;
    }
    const data: Omit<CalEvent, 'id'> = {
      title,
      date: f.start,
      endDate: f.multi && f.end > f.start ? f.end : null,
      startTime: f.allDay ? null : f.startTime || null,
      endTime: f.allDay ? null : f.endTime || null,
      memberIds: f.memberIds,
      recurrence:
        f.repeat === 'none'
          ? null
          : {
              freq: f.repeat,
              interval: Math.max(1, f.every),
              ...(f.repeat === 'weekly' ? { byWeekday: weekdays.length ? weekdays : [weekday(f.start)] } : {}),
              until: f.until || null,
            },
      exdates: event?.exdates ?? [],
      reminderMins: reminders.some(([v]) => v === f.reminder) ? f.reminder : null,
      location: f.location.trim(),
      notes: f.notes.trim(),
      createdBy: event?.createdBy ?? me?.id,
      updatedAt: Date.now(),
    };
    if (event) {
      backend.set('events', event.id, data);
    } else {
      backend.add('events', data);
      log('event', title);
    }
    onClose();
  };

  const removeAll = () => {
    if (event) backend.remove('events', event.id);
    onClose();
  };
  const removeOne = () => {
    if (event && occurrence) backend.update('events', event.id, { exdates: [...(event.exdates ?? []), occurrence] });
    onClose();
  };

  return (
    <Sheet
      title={event ? t('event.edit') : t('event.new')}
      onClose={onClose}
      footer={
        askDelete ? (
          <div className="stack gap-8 w-full">
            {event?.recurrence && occurrence && (
              <button type="button" className="btn soft block" onClick={removeOne}>
                {t('event.deleteOne', { day: dayLong(occurrence) })}
              </button>
            )}
            <button type="button" className="btn danger-solid block" onClick={removeAll}>
              {event?.recurrence ? t('event.deleteAll') : t('common.confirmDelete')}
            </button>
            <button type="button" className="btn ghost block" onClick={() => setAskDelete(false)}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <>
            {event && <DeleteButton onClick={() => setAskDelete(true)} />}
            <button type="button" className="btn accent" onClick={save}>
              {t('common.save')}
            </button>
          </>
        )
      }
    >
      <input
        className="input title-input"
        placeholder={t('event.titlePlaceholder')}
        aria-label={t('event.titlePlaceholder')}
        value={f.title}
        maxLength={LIMITS.title}
        onChange={(e) => set({ title: e.target.value })}
        // biome-ignore lint/a11y/noAutofocus: the sheet was opened to type a new event
        autoFocus={!event}
      />
      <div className="field">
        <span>{t('event.who')}</span>
        <MemberPicker members={members} value={f.memberIds} onChange={(memberIds) => set({ memberIds })} />
      </div>

      <label className="switch">
        {t('date.allDay')}
        <input type="checkbox" checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked, reminder: null })} />
      </label>

      <div className="grid2">
        <label className="field">
          <span>{f.multi ? t('event.from') : t('event.day')}</span>
          <input type="date" value={f.start} onChange={(e) => onStartDate(e.target.value)} />
        </label>
        {f.multi ? (
          <label className="field">
            <span>{t('event.to')}</span>
            <input
              type="date"
              value={f.end}
              min={f.start}
              onChange={(e) => e.target.value && set({ end: e.target.value })}
            />
          </label>
        ) : (
          <div className="field">
            <span aria-hidden="true">&nbsp;</span>
            <button type="button" className="btn soft" onClick={() => set({ multi: true, end: addDays(f.start, 1) })}>
              {t('event.multiDay')}
            </button>
          </div>
        )}
      </div>

      {!f.allDay && (
        <div className="grid2">
          <label className="field">
            <span>{t('event.starts')}</span>
            <input type="time" value={f.startTime} onChange={(e) => onStartTime(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('event.ends')}</span>
            <input type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </label>
        </div>
      )}

      <div className="grid2">
        <label className="field">
          <span>{t('event.repeat')}</span>
          <select value={f.repeat} onChange={(e) => set({ repeat: e.target.value as RepeatSel })}>
            <option value="none">{t('repeat.none')}</option>
            <option value="daily">{t('repeat.daily')}</option>
            <option value="weekly">{t('repeat.weekly')}</option>
            <option value="monthly">{t('repeat.monthly')}</option>
            <option value="yearly">{t('repeat.yearly')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('event.reminder')}</span>
          <select
            value={f.reminder ?? ''}
            onChange={(e) => set({ reminder: e.target.value === '' ? null : Number(e.target.value) })}
          >
            {reminders.map(([v, l]) => (
              <option key={l} value={v ?? ''}>
                {t(l)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {unitKey && (
        <div className="card flat stack gap-12 inset">
          {f.repeat === 'weekly' && (
            // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own border and legend
            <div className="weekdays" role="group" aria-label={t('event.weekdays')}>
              {dowLetter().map((l, i) => (
                <button
                  key={dowLong()[i]}
                  type="button"
                  className={weekdays.includes(i) ? 'on' : ''}
                  aria-pressed={weekdays.includes(i)}
                  aria-label={dowLong()[i]}
                  onClick={() => toggleWeekday(i)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          <div className="grid2">
            <label className="field">
              <span>{t('repeat.every')}</span>
              <select value={f.every} onChange={(e) => set({ every: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {tn(unitKey, n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('repeat.until')}</span>
              <input type="date" value={f.until} min={f.start} onChange={(e) => set({ until: e.target.value })} />
            </label>
          </div>
          {event?.recurrence && <p className="tiny muted">{t('event.changesAllOccurrences')}</p>}
        </div>
      )}

      <label className="field">
        <span>{t('event.location')}</span>
        <input
          value={f.location}
          maxLength={LIMITS.place}
          onChange={(e) => set({ location: e.target.value })}
          placeholder={t('common.optional')}
        />
      </label>
      <label className="field">
        <span>{t('common.notes')}</span>
        <textarea
          value={f.notes}
          maxLength={LIMITS.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder={t('common.optional')}
        />
      </label>
    </Sheet>
  );
}
