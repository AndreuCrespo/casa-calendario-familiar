import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from '../../app/router';
import { useApp, useToday } from '../../core/app';
import { cap, dateRange, monthName } from '../../core/format';
import { KEYS, readChoice, writeString } from '../../core/storage';
import { t } from '../../i18n';
import { addDays, addMonthsClamped, type DateStr, isoWeek, parts, startOfMonth, startOfWeek } from '../../shared/dates';
import type { Occurrence } from '../../shared/recurrence';
import type { CalEvent } from '../../shared/types';
import { Fab, PageHead, Segmented } from '../../ui/primitives';
import { useWeather } from '../weather/weather';
import { useAgenda } from './agenda';
import { DayBlock } from './DayBlock';
import { EventEditor } from './EventEditor';
import { MonthGrid } from './MonthGrid';
import './calendar.css';

const VIEWS = ['week', 'month'] as const;
type View = (typeof VIEWS)[number];
const isDate = (s: string | null): s is DateStr => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

type Editing = { mode: 'new'; date: DateStr } | { mode: 'edit'; event: CalEvent; occurrence: DateStr };

export default function CalendarPage() {
  const { members } = useApp();
  const today = useToday();
  const { param } = useRoute();
  const weather = useWeather().data;
  const [view, setView] = useState<View>(() => readChoice(KEYS.calendarView, VIEWS, 'week'));
  const [anchor, setAnchor] = useState<DateStr>(isDate(param) ? param : today);
  const [selected, setSelected] = useState<DateStr>(anchor);
  const [filter, setFilter] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  // A link to a day (#/calendar/2026-10-20) moves there.
  useEffect(() => {
    if (isDate(param)) {
      setAnchor(param);
      setSelected(param);
    }
  }, [param]);

  const changeView = (v: View) => {
    setView(v);
    writeString(KEYS.calendarView, v);
  };

  // In week view, scroll down to today (or the requested day) when opening
  useEffect(() => {
    if (view !== 'week') return;
    const el = document.querySelector(`[data-date="${anchor}"]`) ?? document.querySelector('.cal-day.today');
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.5) {
      el.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -12);
    }
  }, [view, anchor]);

  const [from, to] = useMemo(() => {
    if (view === 'week') {
      const s = startOfWeek(anchor);
      return [s, addDays(s, 6)];
    }
    const s = startOfWeek(startOfMonth(anchor));
    const last = addDays(addMonthsClamped(startOfMonth(anchor), 1), -1);
    return [s, addDays(startOfWeek(last), 6)];
  }, [view, anchor]);

  const days = useAgenda(from, to, filter);

  const move = (n: number) => {
    const next = view === 'week' ? addDays(anchor, n * 7) : addMonthsClamped(startOfMonth(anchor), n);
    setAnchor(next);
    setSelected(next);
  };
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const toggleMember = (id: string) => {
    const cur = filter ?? members.map((m) => m.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setFilter(next.length === members.length ? null : next);
  };

  const p = parts(anchor);
  const title =
    view === 'week' ? (
      t('calendar.week', { n: isoWeek(from) })
    ) : (
      <>
        {cap(monthName(p.m))} <span className="muted">{p.y}</span>
      </>
    );

  const open = useCallback((o: Occurrence) => setEditing({ mode: 'edit', event: o.event, occurrence: o.date }), []);
  const newOn = useCallback((date: DateStr) => setEditing({ mode: 'new', date }), []);
  const selectedDay = view === 'month' ? days.find((x) => x.date === selected) : undefined;

  return (
    <>
      <PageHead title={title} sub={view === 'week' ? dateRange(from, to) : undefined}>
        <Segmented
          label={t('calendar.view')}
          value={view}
          onChange={changeView}
          options={[
            { id: 'week', label: t('calendar.weekView') },
            { id: 'month', label: t('calendar.monthView') },
          ]}
        />
      </PageHead>

      <div className="cal-toolbar">
        <button type="button" className="icon-btn solid" onClick={() => move(-1)} aria-label={t('common.previous')}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="icon-btn solid" onClick={() => move(1)} aria-label={t('common.next')}>
          <ChevronRight size={20} />
        </button>
        <button type="button" className="btn soft sm" onClick={goToday}>
          {t('date.today')}
        </button>
      </div>

      {members.length > 1 && (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own border and legend
        <div className="chips mb-14" role="group" aria-label={t('calendar.filter')}>
          {members.map((m) => {
            const on = !filter || filter.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className={`chip sm${on ? ' on' : ''}`}
                style={{ '--c': m.color }}
                aria-pressed={on}
                onClick={() => toggleMember(m.id)}
              >
                <span className="dot" />
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {view === 'week' ? (
        days.map((d) => <DayBlock key={d.date} day={d} today={today} weather={weather} onOpen={open} onNew={newOn} />)
      ) : (
        <MonthGrid days={days} anchor={anchor} today={today} selected={selected} onSelect={setSelected} />
      )}

      {selectedDay && (
        <div className="mt-16">
          <DayBlock day={selectedDay} today={today} weather={weather} onOpen={open} onNew={newOn} />
        </div>
      )}

      <Fab
        label={t('event.new')}
        onClick={() => newOn(view === 'month' ? selected : today >= from && today <= to ? today : from)}
      />

      {editing && <EventEditor {...editing} onClose={() => setEditing(null)} />}
    </>
  );
}
