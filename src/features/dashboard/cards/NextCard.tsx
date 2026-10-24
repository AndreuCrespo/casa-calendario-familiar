import { useApp } from '../../../core/app';
import { countdown, dayRelative, timeRange } from '../../../core/format';
import { t } from '../../../i18n';
import type { Occurrence } from '../../../shared/recurrence';
import { useNextUp } from '../../calendar/agenda';
import { memberNames } from '../../members/members';

/** The event in progress or coming next, with a countdown. */
export function NextCard({ onOpen }: { onOpen: (o: Occurrence) => void }) {
  const { membersById } = useApp();
  const { next, now, today } = useNextUp();

  if (!next) {
    return (
      <section className="next idle">
        <h2 className="label">{t('widget.next')}</h2>
        <div className="next-title">{t('next.nothing')}</div>
        <div className="next-when">{t('next.free')}</div>
      </section>
    );
  }
  const ongoing = next.start <= now;
  const who = memberNames(next.occ.event.memberIds, membersById);
  return (
    <button type="button" className="next" onClick={() => onOpen(next.occ)}>
      <span className="row between">
        <span className="label">{ongoing ? t('next.now') : t('widget.next')}</span>
        <span className="pill">{ongoing ? t('next.inProgress') : countdown(next.start - now)}</span>
      </span>
      <span className="next-title">{next.occ.event.title}</span>
      <span className="next-when">
        {dayRelative(next.occ.date, today)} · {timeRange(next.occ.event)}
        {who ? ` · ${who}` : ''}
      </span>
    </button>
  );
}
