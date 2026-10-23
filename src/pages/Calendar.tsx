import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat } from 'lucide-react';
import { useApp, useToday } from '../lib/app';
import { keyDateEmoji, keyDateLabel, useAgenda, type DayAgenda } from '../lib/agenda';
import { cap, dow, monthName, monthShort, timeRange } from '../lib/format';
import { t } from '../i18n';
import { href, useRoute } from '../lib/router';
import { useWeather } from '../lib/weather';
import {
  addDays, addMonthsClamped, isoWeek, parts, startOfMonth, startOfWeek, weekday, type DateStr,
} from '../shared/dates';
import type { Occurrence } from '../shared/recurrence';
import type { CalEvent } from '../shared/types';
import { EventEditor } from '../components/EventEditor';
import { MemberDots, WeatherIcon, memberColorStyle } from '../components/ui';

type View = 'week' | 'month';

export default function Calendar() {
  const { members } = useApp();
  const today = useToday();
  const { param } = useRoute();
  const [view, setView] = useState<View>(() => (localStorage.getItem('casa-calview') as View) || 'week');
  const [anchor, setAnchor] = useState<DateStr>(param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today);
  const [selected, setSelected] = useState<DateStr>(anchor);
  const [filter, setFilter] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<{ ev?: CalEvent; occ?: string; date?: string } | null>(null);

  useEffect(() => {
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) { setAnchor(param); setSelected(param); }
  }, [param]);

  useEffect(() => { localStorage.setItem('casa-calview', view); }, [view]);

  // In week view, scroll down to today (or the requested day) when opening
  useEffect(() => {
    if (view !== 'week') return;
    const el = document.querySelector('.cal-day.today, .cal-day.target');
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.5) {
      el.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -12);
    }
  }, [view, anchor]);

  const [from, to] = useMemo(() => {
    if (view === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 6)]; }
    const s = startOfWeek(startOfMonth(anchor));
    const last = addDays(addMonthsClamped(startOfMonth(anchor), 1), -1);
    return [s, addDays(startOfWeek(last), 6)];
  }, [view, anchor]);

  const days = useAgenda(from, to, filter);

  const move = (n: number) => {
    const next = view === 'week' ? addDays(anchor, n * 7) : addMonthsClamped(startOfMonth(anchor), n);
    setAnchor(next);
    setSelected(view === 'week' ? next : next);
  };
  const goToday = () => { setAnchor(today); setSelected(today); };

  const toggleMember = (id: string) => {
    const cur = filter ?? members.map((m) => m.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setFilter(next.length === members.length ? null : next);
  };

  const title = view === 'week'
    ? <>{t('calendar.week', { n: isoWeek(from) })}</>
    : <>{cap(monthName(parts(anchor).m))} <span className="muted">{parts(anchor).y}</span></>;
  const sub = view === 'week'
    ? `${parts(from).d} ${monthShort(parts(from).m)} – ${parts(to).d} ${monthShort(parts(to).m)}`
    : null;

  const open = (o: Occurrence) => setEditing({ ev: o.event, occ: o.date });
  const newOn = (d: DateStr) => setEditing({ date: d });

  return (
    <>
      <header className="page-head">
        <div className="grow">
          <h1 className="page-title">{title}</h1>
          {sub && <div className="page-sub">{sub}</div>}
        </div>
        <div className="seg">
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>{t('calendar.weekView')}</button>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>{t('calendar.monthView')}</button>
        </div>
      </header>

      <div className="cal-toolbar">
        <button className="icon-btn solid" onClick={() => move(-1)} aria-label={t('common.previous')}><ChevronLeft size={20} /></button>
        <button className="icon-btn solid" onClick={() => move(1)} aria-label={t('common.next')}><ChevronRight size={20} /></button>
        <button className="btn soft sm" onClick={goToday}>{t('date.today')}</button>
        <div className="grow" />
      </div>

      {members.length > 1 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          {members.map((m) => {
            const on = !filter || filter.includes(m.id);
            return (
              <button key={m.id} className={`chip sm${on ? ' on' : ''}`} style={{ '--c': m.color } as CSSProperties} onClick={() => toggleMember(m.id)}>
                <span className="dot" />{m.name}
              </button>
            );
          })}
        </div>
      )}

      {view === 'week' ? (
        days.map((d) => <DayBlock key={d.date} day={d} today={today} target={d.date === anchor} onOpen={open} onNew={newOn} />)
      ) : (
        <MonthGrid days={days} anchor={anchor} today={today} selected={selected} onSelect={setSelected} />
      )}

      {view === 'month' && (() => {
        const d = days.find((x) => x.date === selected);
        return d ? <div style={{ marginTop: 16 }}><DayBlock day={d} today={today} onOpen={open} onNew={newOn} /></div> : null;
      })()}

      <button className="fab" onClick={() => newOn(view === 'month' ? selected : (today >= from && today <= to ? today : from))} aria-label={t('event.new')}>
        <Plus size={28} />
      </button>

      {editing && (
        <EventEditor
          event={editing.ev}
          occurrence={editing.occ}
          date={editing.date}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function DayBlock({ day, today, target, onOpen, onNew }: {
  day: DayAgenda;
  today: DateStr;
  target?: boolean;
  onOpen: (o: Occurrence) => void;
  onNew: (d: DateStr) => void;
}) {
  const { members } = useApp();
  const weather = useWeather();
  const w = weather.data;
  const wi = w ? w.daily.date.indexOf(day.date) : -1;
  const p = parts(day.date);
  const items = [...day.allDay, ...day.timed];
  const cls = (day.date === today ? ' today' : day.date < today ? ' past' : '') + (target ? ' target' : '');

  return (
    <section className={`cal-day${cls}`}>
      <div className="cal-day-head">
        <div className="cal-day-num">
          <span className="d">{dow()[weekday(day.date)]}</span>
          <span className="n num">{p.d}</span>
        </div>
        <div className="grow row" style={{ gap: 8 }}>
          {day.date === today && <span className="pill red">{t('date.today')}</span>}
          {wi >= 0 && (
            <a className="row tiny muted num" style={{ gap: 4, fontWeight: 700 }} href={href('weather')}>
              <WeatherIcon code={w!.daily.code[wi]} size={15} />
              {Math.round(w!.daily.max[wi])}° / {Math.round(w!.daily.min[wi])}°
            </a>
          )}
        </div>
        <button className="icon-btn sm" onClick={() => onNew(day.date)} aria-label={t('calendar.addOnDay')}><Plus size={18} /></button>
      </div>
      <div className="cal-items">
        {day.keyDates.map((kd) => (
          <a key={kd.id} className="cal-ev kd" href={href('dates')}>
            <span className="bar" style={memberColorStyle(kd.memberIds, members)} />
            <div className="grow"><div className="n">{keyDateEmoji(kd.kind)} {keyDateLabel(kd, day.date)}</div></div>
          </a>
        ))}
        {items.map((o) => {
          const multi = (o.event.memberIds?.length ?? 0) > 1;
          return (
            <button key={o.key} className="cal-ev" onClick={() => onOpen(o)}>
              <span className={`bar${multi ? ' multi' : ''}`} style={memberColorStyle(o.event.memberIds, members)} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="t num row" style={{ gap: 6 }}>
                  {o.date !== day.date ? t('agenda.continues') : timeRange(o.event)}
                  {o.event.recurrence && <Repeat size={12} />}
                </div>
                <div className="n">{o.event.title}</div>
                {o.event.location && <div className="tiny muted row" style={{ gap: 4 }}><MapPin size={11} />{o.event.location}</div>}
              </div>
              <MemberDots ids={o.event.memberIds} members={members} />
            </button>
          );
        })}
        {(day.menu?.lunch || day.menu?.dinner) && (
          <a className="cal-menu" href={href('menu')}>🍽️ {[day.menu?.lunch, day.menu?.dinner].filter(Boolean).join(' · ')}</a>
        )}
        {!items.length && !day.keyDates.length && (
          <button className="cal-add" onClick={() => onNew(day.date)}>{t('calendar.noPlans')} · <Plus size={13} /> {t('calendar.addLower')}</button>
        )}
      </div>
    </section>
  );
}

function MonthGrid({ days, anchor, today, selected, onSelect }: {
  days: DayAgenda[];
  anchor: DateStr;
  today: DateStr;
  selected: DateStr;
  onSelect: (d: DateStr) => void;
}) {
  const { members } = useApp();
  const month = anchor.slice(0, 7);
  return (
    <div className="month">
      {dow().map((d) => <div key={d} className="month-dow">{d}</div>)}
      {days.map((d) => {
        const all = [...d.allDay, ...d.timed];
        const colors = Array.from(new Set(all.flatMap((o) => o.event.memberIds?.length ? o.event.memberIds : ['_'])));
        const cls = [
          'mcell',
          d.date.slice(0, 7) !== month && 'out',
          d.date === today && 'today',
          d.date === selected && 'sel',
        ].filter(Boolean).join(' ');
        return (
          <button key={d.date} className={cls} onClick={() => onSelect(d.date)}>
            <span className="mnum num">{parts(d.date).d}</span>
            <span className="dots hide-wide">
              {d.keyDates.length > 0 && <span className="dot" style={{ background: 'var(--accent)' }} />}
              {colors.slice(0, 4).map((id) => (
                <span key={id} className="dot" style={{ background: members.find((m) => m.id === id)?.color ?? 'var(--muted)' }} />
              ))}
            </span>
            {d.keyDates.slice(0, 1).map((kd) => (
              <span key={kd.id} className="mev hide-narrow" style={{ '--c': 'var(--accent)' } as CSSProperties}>{keyDateEmoji(kd.kind)} {kd.title}</span>
            ))}
            {all.slice(0, 3).map((o) => (
              <span key={o.key} className="mev hide-narrow" style={memberColorStyle(o.event.memberIds, members)}>
                {o.event.startTime && o.date === d.date ? `${o.event.startTime} ` : ''}{o.event.title}
              </span>
            ))}
            {all.length > 3 && <span className="mev hide-narrow muted" style={{ borderLeft: 0 }}>{t('calendar.more', { n: all.length - 3 })}</span>}
          </button>
        );
      })}
    </div>
  );
}
