import { CalendarClock } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useCollection, useToday } from '../../core/app';
import { dayShort, euros, inDays } from '../../core/format';
import { t } from '../../i18n';
import { type DateStr, diffDays } from '../../shared/dates';
import { nextKeyDate } from '../../shared/recurrence';
import type { KeyDate } from '../../shared/types';
import { Empty, Fab, PageHead } from '../../ui/primitives';
import { KeyDateEditor } from './KeyDateEditor';
import { keyDateEmoji, keyDateLabel } from './keyDates';

const KeyDateRow = memo(function KeyDateRow({
  kd,
  next,
  today,
  onOpen,
}: {
  kd: KeyDate;
  next: DateStr | null;
  today: DateStr;
  onOpen: (kd: KeyDate) => void;
}) {
  const soon = next !== null && diffDays(next, today) <= kd.remindDays;
  const details = [
    next ? dayShort(next) : t('dates.passedOn', { day: dayShort(kd.date) }),
    kd.repeat === 'yearly' && t('dates.everyYear'),
    kd.repeat === 'monthly' && t('dates.everyMonth'),
    kd.amount ? euros(kd.amount) : '',
  ].filter(Boolean);
  return (
    <li>
      <button type="button" className="list-item clickable" onClick={() => onOpen(kd)}>
        <span className="item-emoji" aria-hidden="true">
          {keyDateEmoji(kd.kind)}
        </span>
        <span className="grow">
          <span className="item-title ellipsis block">{next ? keyDateLabel(kd, next) : kd.title}</span>
          <span className="item-sub block">{details.join(' · ')}</span>
        </span>
        {next && <span className={`pill${soon ? ' red' : ''}`}>{inDays(next, today)}</span>}
      </button>
    </li>
  );
});

export default function KeyDatesPage() {
  const today = useToday();
  const dates = useCollection('dates');
  const [editing, setEditing] = useState<KeyDate | 'new' | null>(null);
  const open = useCallback((kd: KeyDate) => setEditing(kd), []);

  const list = useMemo(
    () =>
      (dates ?? [])
        .map((kd) => ({ kd, next: nextKeyDate(kd, today) }))
        .sort((a, b) => ((a.next ?? '9999') < (b.next ?? '9999') ? -1 : 1)),
    [dates, today],
  );
  const upcoming = list.filter((x) => x.next);
  const past = list.filter((x) => !x.next);
  const row = (x: { kd: KeyDate; next: DateStr | null }) => (
    <KeyDateRow key={x.kd.id} kd={x.kd} next={x.next} today={today} onOpen={open} />
  );

  return (
    <>
      <PageHead title={t('nav.dates')} sub={t('dates.subtitle')} />
      {dates && dates.length === 0 && (
        <Empty icon={CalendarClock} title={t('dates.emptyTitle')}>
          {t('dates.emptyText')}
        </Empty>
      )}
      {upcoming.length > 0 && <ul className="list">{upcoming.map(row)}</ul>}
      {past.length > 0 && (
        <>
          <h2 className="section-title">{t('dates.past')}</h2>
          <ul className="list">{past.map(row)}</ul>
        </>
      )}
      <Fab label={t('dates.new')} onClick={() => setEditing('new')} />
      {editing && <KeyDateEditor kd={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
