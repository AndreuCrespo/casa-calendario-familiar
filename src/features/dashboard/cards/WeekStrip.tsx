import { memo } from 'react';
import { href } from '../../../app/router';
import { useApp } from '../../../core/app';
import { dayLong, dow } from '../../../core/format';
import { t } from '../../../i18n';
import { addDays, type DateStr, parts, weekday } from '../../../shared/dates';
import type { Occurrence } from '../../../shared/recurrence';
import { type DayAgenda, useAgenda } from '../../calendar/agenda';
import { keyDateEmoji, keyDateLabel } from '../../keyDates/keyDates';
import { memberColorStyle } from '../../members/members';
import { mealsText } from '../../menu/menu';
import { WeatherIcon } from '../../weather/WeatherIcon';
import { dayWeather, type Weather } from '../../weather/weather';

/** The next seven days side by side. */
export function WeekStrip({
  today,
  weather,
  onOpen,
}: {
  today: DateStr;
  weather: Weather | undefined;
  onOpen: (o: Occurrence) => void;
}) {
  const days = useAgenda(today, addDays(today, 6));
  return (
    <section className="week" aria-label={t('widget.week')}>
      {days.map((d) => (
        <WeekDay key={d.date} day={d} today={today} weather={weather} onOpen={onOpen} />
      ))}
    </section>
  );
}

const WeekDay = memo(function WeekDay({
  day,
  today,
  weather,
  onOpen,
}: {
  day: DayAgenda;
  today: DateStr;
  weather: Weather | undefined;
  onOpen: (o: Occurrence) => void;
}) {
  const { membersById } = useApp();
  const isToday = day.date === today;
  const wx = dayWeather(weather, day.date);
  const empty = !day.allDay.length && !day.timed.length && !day.keyDates.length;
  const meals = mealsText(day.menu);

  return (
    <div className={`wday${isToday ? ' today' : ''}`}>
      <a className="wday-head" href={href('calendar', day.date)} aria-label={dayLong(day.date)}>
        <span>{isToday ? t('date.today') : dow()[weekday(day.date)]}</span>
        <span className="n num">{parts(day.date).d}</span>
      </a>
      {wx && (
        <div className="wday-wx num">
          <WeatherIcon code={wx.code} size={14} labelled />
          {Math.round(wx.max)}° / {Math.round(wx.min)}°
        </div>
      )}
      <div className="wday-events">
        {day.keyDates.map((kd) => (
          <a
            key={kd.id}
            className="wev allday"
            href={href('dates')}
            style={memberColorStyle(kd.memberIds, membersById)}
          >
            {keyDateEmoji(kd.kind)} {keyDateLabel(kd, day.date)}
          </a>
        ))}
        {day.allDay.map((o) => (
          <button
            key={o.key}
            type="button"
            className="wev allday"
            style={memberColorStyle(o.event.memberIds, membersById)}
            onClick={() => onOpen(o)}
          >
            {o.event.title}
          </button>
        ))}
        {day.timed.map((o) => (
          <button
            key={o.key}
            type="button"
            className="wev"
            style={memberColorStyle(o.event.memberIds, membersById)}
            onClick={() => onOpen(o)}
          >
            <span className="t num block">{o.event.startTime}</span>
            <span className="n block">{o.event.title}</span>
          </button>
        ))}
        {empty && <span className="muted small">—</span>}
      </div>
      {meals && (
        <a className="wmenu" href={href('menu')}>
          <span aria-hidden="true">🍽️</span> {meals}
        </a>
      )}
    </div>
  );
});
