import { ListTodo, MapPin } from 'lucide-react';
import { href } from '../../../app/router';
import { useApp } from '../../../core/app';
import { useNow } from '../../../core/clock';
import { dayLong, timeRange } from '../../../core/format';
import { t } from '../../../i18n';
import { addDays, type DateStr } from '../../../shared/dates';
import type { Occurrence } from '../../../shared/recurrence';
import { occurrenceBounds, useAgenda } from '../../calendar/agenda';
import { keyDateEmoji, keyDateLabel } from '../../keyDates/keyDates';
import { memberColorStyle, memberNames } from '../../members/members';

/** Today and tomorrow, item by item. */
export function AgendaCard({ today, onOpen }: { today: DateStr; onOpen: (o: Occurrence) => void }) {
  const { membersById, tz } = useApp();
  const now = useNow();
  const days = useAgenda(today, addDays(today, 1));

  return (
    <section className="card">
      <h2>
        <a className="label" href={href('calendar')}>
          <ListTodo size={14} aria-hidden="true" /> {t('widget.agenda')}
        </a>
      </h2>
      {days.map((d, di) => {
        const items = d.allDay.length + d.timed.length + d.keyDates.length;
        return (
          <div key={d.date} className="agenda-day">
            <h3 className="agenda-head">
              <b>{di === 0 ? t('date.today') : t('date.tomorrow')}</b> <span className="muted">{dayLong(d.date)}</span>
            </h3>
            {items === 0 && <p className="small muted agenda-empty">{t('agenda.nothing')}</p>}
            {d.keyDates.map((kd) => (
              <a key={kd.id} className="agenda-item" href={href('dates')}>
                <span className="agenda-time" aria-hidden="true">
                  {keyDateEmoji(kd.kind)}
                </span>
                <span className="bar" style={memberColorStyle(kd.memberIds, membersById)} />
                <span className="grow item-title">{keyDateLabel(kd, d.date)}</span>
              </a>
            ))}
            {[...d.allDay, ...d.timed].map((o) => {
              const timed = !!o.event.startTime && o.date === d.date;
              const past = timed && di === 0 && (occurrenceBounds(o, tz)?.end ?? Infinity) < now;
              const sub = [o.event.location, memberNames(o.event.memberIds, membersById)].filter(Boolean).join(' · ');
              return (
                <button
                  key={o.key}
                  type="button"
                  className={`agenda-item${past ? ' past' : ''}`}
                  onClick={() => onOpen(o)}
                >
                  <span className="agenda-time num">
                    {timed ? o.event.startTime : o.date !== d.date ? t('agenda.continues') : t('date.allDay')}
                  </span>
                  <span
                    className={`bar${(o.event.memberIds?.length ?? 0) > 1 ? ' multi' : ''}`}
                    style={memberColorStyle(o.event.memberIds, membersById)}
                  />
                  <span className="grow">
                    <span className="item-title ellipsis block">{o.event.title}</span>
                    {sub && (
                      <span className="item-sub ellipsis block">
                        {o.event.location && <MapPin size={11} className="inline-icon" aria-hidden="true" />}
                        {sub}
                      </span>
                    )}
                  </span>
                  <span className="sr-only">{timeRange(o.event)}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
