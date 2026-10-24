import { MapPin, Plus, Repeat } from 'lucide-react';
import { memo } from 'react';
import { href } from '../../app/router';
import { useApp } from '../../core/app';
import { dayLong, dow, timeRange } from '../../core/format';
import { t } from '../../i18n';
import { type DateStr, parts, weekday } from '../../shared/dates';
import type { Occurrence } from '../../shared/recurrence';
import { keyDateEmoji, keyDateLabel } from '../keyDates/keyDates';
import { MemberDots, memberColorStyle } from '../members/members';
import { mealsText } from '../menu/menu';
import { WeatherIcon } from '../weather/WeatherIcon';
import { dayWeather, type Weather } from '../weather/weather';
import type { DayAgenda } from './agenda';

/** One day of the week view: its events, key dates and meals. */
export const DayBlock = memo(function DayBlock({
  day,
  today,
  weather,
  onOpen,
  onNew,
}: {
  day: DayAgenda;
  today: DateStr;
  weather: Weather | undefined;
  onOpen: (o: Occurrence) => void;
  onNew: (d: DateStr) => void;
}) {
  const { membersById } = useApp();
  const wx = dayWeather(weather, day.date);
  const items = [...day.allDay, ...day.timed];
  const isToday = day.date === today;
  const meals = mealsText(day.menu);

  return (
    <section
      className={`cal-day${isToday ? ' today' : day.date < today ? ' past' : ''}`}
      data-date={day.date}
      aria-label={dayLong(day.date)}
    >
      <div className="cal-day-head">
        <div className="cal-day-num" aria-hidden="true">
          <span className="d">{dow()[weekday(day.date)]}</span>
          <span className="n num">{parts(day.date).d}</span>
        </div>
        <div className="grow row gap-8">
          {isToday && <span className="pill red">{t('date.today')}</span>}
          {wx && (
            <a className="row gap-4 tiny muted num bold" href={href('weather')}>
              <WeatherIcon code={wx.code} size={15} labelled />
              {Math.round(wx.max)}° / {Math.round(wx.min)}°
            </a>
          )}
        </div>
        <button
          type="button"
          className="icon-btn sm"
          onClick={() => onNew(day.date)}
          aria-label={t('calendar.addOnDay', { day: dayLong(day.date) })}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="cal-items">
        {day.keyDates.map((kd) => (
          <a key={kd.id} className="cal-ev kd" href={href('dates')}>
            <span className="bar" style={memberColorStyle(kd.memberIds, membersById)} />
            <span className="grow n">
              {keyDateEmoji(kd.kind)} {keyDateLabel(kd, day.date)}
            </span>
          </a>
        ))}
        {items.map((o) => (
          <button key={o.key} type="button" className="cal-ev" onClick={() => onOpen(o)}>
            <span
              className={`bar${(o.event.memberIds?.length ?? 0) > 1 ? ' multi' : ''}`}
              style={memberColorStyle(o.event.memberIds, membersById)}
            />
            <span className="grow">
              <span className="t num row gap-6">
                {o.date !== day.date ? t('agenda.continues') : timeRange(o.event)}
                {o.event.recurrence && <Repeat size={12} aria-label={t('event.repeats')} />}
              </span>
              <span className="n block">{o.event.title}</span>
              {o.event.location && (
                <span className="tiny muted row gap-4">
                  <MapPin size={11} aria-hidden="true" />
                  {o.event.location}
                </span>
              )}
            </span>
            <MemberDots ids={o.event.memberIds} members={membersById} />
          </button>
        ))}
        {meals && (
          <a className="cal-menu" href={href('menu')}>
            <span aria-hidden="true">🍽️</span> {meals}
          </a>
        )}
        {!items.length && !day.keyDates.length && (
          <button type="button" className="cal-add" onClick={() => onNew(day.date)}>
            {t('calendar.noPlans')} · <Plus size={13} aria-hidden="true" /> {t('calendar.addLower')}
          </button>
        )}
      </div>
    </section>
  );
});
