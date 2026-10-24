import { useApp } from '../../core/app';
import { dayLong, dow } from '../../core/format';
import { t } from '../../i18n';
import { type DateStr, parts } from '../../shared/dates';
import { keyDateEmoji } from '../keyDates/keyDates';
import { memberColorStyle } from '../members/members';
import type { DayAgenda } from './agenda';

export function MonthGrid({
  days,
  anchor,
  today,
  selected,
  onSelect,
}: {
  days: DayAgenda[];
  anchor: DateStr;
  today: DateStr;
  selected: DateStr;
  onSelect: (d: DateStr) => void;
}) {
  const { membersById } = useApp();
  const month = anchor.slice(0, 7);
  return (
    <div className="month">
      {dow().map((d) => (
        <div key={d} className="month-dow" aria-hidden="true">
          {d}
        </div>
      ))}
      {days.map((d) => {
        const all = [...d.allDay, ...d.timed];
        const colors = Array.from(
          new Set(all.flatMap((o) => (o.event.memberIds?.length ? o.event.memberIds : ['_']))),
        ).slice(0, 4);
        const count = all.length + d.keyDates.length;
        const cls = [
          'mcell',
          d.date.slice(0, 7) !== month && 'out',
          d.date === today && 'today',
          d.date === selected && 'sel',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={d.date}
            type="button"
            className={cls}
            onClick={() => onSelect(d.date)}
            aria-pressed={d.date === selected}
            aria-current={d.date === today ? 'date' : undefined}
            aria-label={count ? `${dayLong(d.date)}, ${t('calendar.items', { n: count })}` : dayLong(d.date)}
          >
            <span className="mnum num">{parts(d.date).d}</span>
            <span className="dots hide-wide" aria-hidden="true">
              {d.keyDates.length > 0 && <span className="dot kd-dot" />}
              {colors.map((id) => (
                <span key={id} className="dot" style={{ background: membersById.get(id)?.color ?? 'var(--muted)' }} />
              ))}
            </span>
            {d.keyDates.slice(0, 1).map((kd) => (
              <span key={kd.id} className="mev kd hide-narrow" aria-hidden="true">
                {keyDateEmoji(kd.kind)} {kd.title}
              </span>
            ))}
            {all.slice(0, 3).map((o) => (
              <span
                key={o.key}
                className="mev hide-narrow"
                style={memberColorStyle(o.event.memberIds, membersById)}
                aria-hidden="true"
              >
                {o.event.startTime && o.date === d.date ? `${o.event.startTime} ` : ''}
                {o.event.title}
              </span>
            ))}
            {all.length > 3 && (
              <span className="mev more hide-narrow muted" aria-hidden="true">
                {t('calendar.more', { n: all.length - 3 })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
