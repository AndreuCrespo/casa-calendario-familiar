import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../lib/app';
import { DOW_LETTER, dayLong } from '../lib/format';
import { addDays, timeToMinutes, weekday, type DateStr } from '../shared/dates';
import type { CalEvent, Freq } from '../shared/types';
import { MemberPicker, Sheet, toast } from './ui';

type RepeatSel = 'none' | Freq;

const TIMED_REMINDERS: [number | null, string][] = [
  [null, 'Sin aviso'], [0, 'A la hora'], [10, '10 min antes'], [30, '30 min antes'],
  [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 día antes'],
];
const ALLDAY_REMINDERS: [number | null, string][] = [
  [null, 'Sin aviso'], [0, 'Ese día a las 9:00'], [780, 'El día antes a las 20:00'],
];

function plusHour(t: string) {
  const m = (timeToMinutes(t) + 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function nextHour() {
  const h = (new Date().getHours() + 1) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

export function EventEditor({ event, date, occurrence, onClose }: {
  event?: CalEvent;
  date?: DateStr; // para eventos nuevos
  occurrence?: DateStr; // repetición concreta que se abrió
  onClose: () => void;
}) {
  const { backend, me, members, log } = useApp();
  const [title, setTitle] = useState(event?.title ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(event?.memberIds ?? (me ? [me.id] : []));
  const [allDay, setAllDay] = useState(event ? !event.startTime : false);
  const [start, setStart] = useState<DateStr>(event?.date ?? date!);
  const [multi, setMulti] = useState(!!(event?.endDate && event.endDate > event.date));
  const [end, setEnd] = useState<DateStr>(event?.endDate ?? event?.date ?? date!);
  const [startTime, setStartTime] = useState(event?.startTime ?? nextHour());
  const [endTime, setEndTime] = useState(event?.endTime ?? plusHour(event?.startTime ?? nextHour()));
  const [repeat, setRepeat] = useState<RepeatSel>(event?.recurrence?.freq ?? 'none');
  const [every, setEvery] = useState(event?.recurrence?.interval ?? 1);
  const [byWeekday, setByWeekday] = useState<number[]>(event?.recurrence?.byWeekday ?? [weekday(event?.date ?? date!)]);
  const [until, setUntil] = useState(event?.recurrence?.until ?? '');
  const [reminder, setReminder] = useState<number | null>(event?.reminderMins ?? null);
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [askDelete, setAskDelete] = useState(false);

  const reminders = allDay ? ALLDAY_REMINDERS : TIMED_REMINDERS;

  const onStartTime = (t: string) => {
    if (startTime && endTime && t) {
      const dur = (timeToMinutes(endTime) - timeToMinutes(startTime) + 1440) % 1440;
      const m = (timeToMinutes(t) + dur) % 1440;
      setEndTime(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    setStartTime(t);
  };

  const save = () => {
    if (!title.trim()) { toast('Ponle un título'); return; }
    const data: Omit<CalEvent, 'id'> = {
      title: title.trim(),
      date: start,
      endDate: multi && end > start ? end : null,
      startTime: allDay ? null : startTime || null,
      endTime: allDay ? null : endTime || null,
      memberIds,
      recurrence: repeat === 'none' ? null : {
        freq: repeat,
        interval: Math.max(1, every),
        ...(repeat === 'weekly' ? { byWeekday: byWeekday.length ? byWeekday : [weekday(start)] } : {}),
        until: until || null,
      },
      exdates: event?.exdates ?? [],
      reminderMins: reminders.some(([v]) => v === reminder) ? reminder : null,
      location: location.trim(),
      notes: notes.trim(),
      createdBy: event?.createdBy ?? me?.id,
      updatedAt: Date.now(),
    };
    if (event) {
      backend.set('events', event.id, data);
    } else {
      backend.add('events', data);
      log('event', data.title);
    }
    onClose();
  };

  const removeAll = () => { backend.remove('events', event!.id); onClose(); };
  const removeOne = () => {
    backend.update('events', event!.id, { exdates: [...(event!.exdates ?? []), occurrence!] });
    onClose();
  };

  return (
    <Sheet
      title={event ? 'Editar evento' : 'Nuevo evento'}
      onClose={onClose}
      footer={askDelete ? (
        <div className="stack" style={{ width: '100%', gap: 8 }}>
          {event?.recurrence && occurrence && (
            <button className="btn soft block" onClick={removeOne}>Borrar solo el {dayLong(occurrence)}</button>
          )}
          <button className="btn block" style={{ background: 'var(--red)', color: '#fff' }} onClick={removeAll}>
            {event?.recurrence ? 'Borrar todas las repeticiones' : 'Sí, borrar'}
          </button>
          <button className="btn ghost block" onClick={() => setAskDelete(false)}>Cancelar</button>
        </div>
      ) : (
        <>
          {event && <button className="btn danger" style={{ flex: 'none' }} onClick={() => setAskDelete(true)} aria-label="Borrar"><Trash2 size={20} /></button>}
          <button className="btn accent" onClick={save}>Guardar</button>
        </>
      )}
    >
      <input
        className="input"
        style={{ fontSize: 19, fontWeight: 700 }}
        placeholder="¿Qué pasa?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!event}
      />
      <div className="field"><span>¿Quién?</span>
        <MemberPicker members={members} value={memberIds} onChange={setMemberIds} />
      </div>

      <label className="switch">Todo el día
        <input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); setReminder(null); }} />
      </label>

      <div className="grid2">
        <label className="field"><span>{multi ? 'Desde' : 'Día'}</span>
          <input type="date" value={start} onChange={(e) => {
            const v = e.target.value; if (!v) return;
            setStart(v);
            if (end < v) setEnd(v);
            if (repeat === 'weekly' && byWeekday.length <= 1) setByWeekday([weekday(v)]);
          }} />
        </label>
        {multi ? (
          <label className="field"><span>Hasta</span>
            <input type="date" value={end} min={start} onChange={(e) => e.target.value && setEnd(e.target.value)} />
          </label>
        ) : (
          <div className="field"><span>&nbsp;</span>
            <button type="button" className="btn soft" onClick={() => { setMulti(true); setEnd(addDays(start, 1)); }}>Varios días</button>
          </div>
        )}
      </div>

      {!allDay && (
        <div className="grid2">
          <label className="field"><span>Empieza</span>
            <input type="time" value={startTime} onChange={(e) => onStartTime(e.target.value)} />
          </label>
          <label className="field"><span>Termina</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
      )}

      <div className="grid2">
        <label className="field"><span>Repetir</span>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatSel)}>
            <option value="none">No se repite</option>
            <option value="daily">Cada día</option>
            <option value="weekly">Cada semana</option>
            <option value="monthly">Cada mes</option>
            <option value="yearly">Cada año</option>
          </select>
        </label>
        <label className="field"><span>Aviso</span>
          <select value={reminder ?? ''} onChange={(e) => setReminder(e.target.value === '' ? null : Number(e.target.value))}>
            {reminders.map(([v, l]) => <option key={l} value={v ?? ''}>{l}</option>)}
          </select>
        </label>
      </div>

      {repeat !== 'none' && (
        <div className="card flat stack" style={{ padding: 12, gap: 12, background: 'var(--surface-2)' }}>
          {repeat === 'weekly' && (
            <div className="weekdays">
              {DOW_LETTER.map((l, i) => (
                <button key={i} type="button" className={byWeekday.includes(i) ? 'on' : ''}
                  onClick={() => setByWeekday(byWeekday.includes(i) ? byWeekday.filter((x) => x !== i) : [...byWeekday, i])}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <div className="grid2">
            <label className="field"><span>Cada</span>
              <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? { daily: 'día', weekly: 'semana', monthly: 'mes', yearly: 'año' }[repeat]
                      : `${n} ${{ daily: 'días', weekly: 'semanas', monthly: 'meses', yearly: 'años' }[repeat]}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="field"><span>Hasta (opcional)</span>
              <input type="date" value={until} min={start} onChange={(e) => setUntil(e.target.value)} />
            </label>
          </div>
          {event?.recurrence && <p className="tiny muted">Los cambios se aplican a todas las repeticiones.</p>}
        </div>
      )}

      <label className="field"><span>Lugar</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" />
      </label>
      <label className="field"><span>Notas</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </label>
    </Sheet>
  );
}
