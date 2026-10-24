// The small summary cards of the home screen; each links to its section.
import { CalendarClock, ListChecks, ShoppingCart, StickyNote, UtensilsCrossed, Wallet, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { href } from '../../../app/router';
import { useApp, useCollection } from '../../../core/app';
import { decimal, euros, hm, inDays } from '../../../core/format';
import { t, tn } from '../../../i18n';
import { addDays, type DateStr, diffDays } from '../../../shared/dates';
import { nextKeyDate } from '../../../shared/recurrence';
import { cheapestWindow, hourLabel, priceLevel, priceStats, usePvpc } from '../../energy/pvpc';
import { monthTotal, settlements } from '../../expenses/expenses';
import { keyDateEmoji, keyDateLabel } from '../../keyDates/keyDates';
import { MemberDots } from '../../members/members';
import { MenuQuickEdit } from '../../menu/MenuQuickEdit';
import { mealsText, useMenu } from '../../menu/menu';
import { sortNotes } from '../../notes/notes';
import { dueTasks, isOverdue } from '../../tasks/tasks';

export function MenuTodayCard({ today }: { today: DateStr }) {
  const menu = useMenu(today, addDays(today, 1));
  const [edit, setEdit] = useState(false);
  const m = menu?.find((x) => x.id === today);
  const tomorrow = mealsText(menu?.find((x) => x.id === addDays(today, 1)));
  return (
    <>
      <button type="button" className="card card-link card-button" onClick={() => setEdit(true)}>
        <span className="label label-amber">
          <UtensilsCrossed size={14} aria-hidden="true" /> {t('widget.menu')}
        </span>
        {!m?.lunch && !m?.dinner ? (
          <span className="small muted block mt-10">{t('menu.notPlanned')}</span>
        ) : (
          <span className="stack gap-6 mt-10">
            <span>
              <span className="tiny muted bold upper block">{t('menu.lunch')}</span>
              <span className="bold menu-dish">{m?.lunch || '—'}</span>
            </span>
            <span>
              <span className="tiny muted bold upper block">{t('menu.dinner')}</span>
              <span className="bold menu-dish">{m?.dinner || '—'}</span>
            </span>
          </span>
        )}
        {tomorrow && (
          <span className="tiny muted ellipsis block mt-8">
            {t('menu.tomorrowPrefix')} {tomorrow}
          </span>
        )}
      </button>
      {edit && <MenuQuickEdit date={today} current={m} onClose={() => setEdit(false)} />}
    </>
  );
}

export function ShoppingCard() {
  const items = useCollection('shopping');
  const pending = useMemo(
    () => (items ?? []).filter((i) => !i.done).sort((a, b) => b.createdAt - a.createdAt),
    [items],
  );
  return (
    <a className="card card-link" href={href('shopping')}>
      <span className="label label-amber">
        <ShoppingCart size={14} aria-hidden="true" /> {t('widget.shopping')}
      </span>
      <span className="big-num block">
        {pending.length ? tn('shopping.items', pending.length) : t('shopping.nothing')}
      </span>
      <span className="small muted clamp-2 mt-4">
        {pending.length ? pending.map((i) => i.name).join(' · ') : t('shopping.emptyShort')}
      </span>
    </a>
  );
}

export function TasksCard({ today }: { today: DateStr }) {
  const { membersById } = useApp();
  const tasks = useCollection('tasks');
  const due = useMemo(() => dueTasks(tasks ?? [], today), [tasks, today]);
  return (
    <a className="card card-link" href={href('tasks')}>
      <span className="label label-green">
        <ListChecks size={14} aria-hidden="true" /> {t('widget.tasks')}
      </span>
      {due.length === 0 ? (
        <>
          <span className="big-num block">🎉 {t('tasks.allDone')}</span>
          <span className="small muted block mt-4">{t('tasks.nothingToday')}</span>
        </>
      ) : (
        <>
          <span className="big-num block">{t('tasks.toDo', { n: due.length })}</span>
          <span className="stack gap-4 mt-6">
            {due.slice(0, 3).map((x) => (
              <span key={x.id} className="row small gap-6">
                <MemberDots ids={x.memberIds} members={membersById} />
                {isOverdue(x, today) ? (
                  <span className="ellipsis grow overdue">
                    {x.title}{' '}
                    <span className="sr-only">
                      ({t('tasks.overdueTitle', { when: inDays(x.due ?? today, today) })})
                    </span>
                  </span>
                ) : (
                  <span className="ellipsis grow">{x.title}</span>
                )}
              </span>
            ))}
          </span>
        </>
      )}
    </a>
  );
}

export function EnergyCard() {
  const { data, current, tz } = usePvpc();
  const cur = data?.hours[current] ?? data?.hours[0];
  if (!data || !cur) {
    return (
      <a className="card card-link" href={href('energy')}>
        <span className="label">
          <Zap size={14} aria-hidden="true" /> {t('widget.energy')}
        </span>
        <span className="small muted block mt-10">{t('energy.loading')}</span>
      </a>
    );
  }
  const stats = priceStats(data);
  const best = cheapestWindow(data, 2, Math.max(0, current));
  return (
    <a className="card card-link" href={href('energy')}>
      <span className="label label-amber">
        <Zap size={14} aria-hidden="true" /> {t('energy.now')}
      </span>
      <span className="row baseline gap-6 mt-8">
        <span className="num price">{decimal(cur.price, 3)}</span>
        <span className="tiny muted bold">€/kWh</span>
        <span className={`dot lvl-${priceLevel(cur.price, stats)} ml-auto`} aria-hidden="true" />
      </span>
      <span className="mini-bars mt-10" aria-hidden="true">
        {data.hours.map((h, i) => (
          <i
            key={h.start}
            className={`lvl-${priceLevel(h.price, stats)}${i === current ? ' now' : ''}${i < current ? ' past' : ''}`}
            style={{ height: `${Math.max(8, (h.price / stats.max) * 100)}%` }}
          />
        ))}
      </span>
      {best && (
        <span className="small muted block mt-8">
          {t('energy.cheapest')}{' '}
          <b>
            {hm(hourLabel(best.start, tz))}–{hm((hourLabel(best.start, tz) + 2) % 24)}
          </b>
        </span>
      )}
    </a>
  );
}

export function DatesCard({ today }: { today: DateStr }) {
  const dates = useCollection('dates');
  const upcoming = useMemo(
    () =>
      (dates ?? [])
        .flatMap((kd) => {
          const d = nextKeyDate(kd, today);
          return d && diffDays(d, today) <= 45 ? [{ kd, d }] : [];
        })
        .sort((a, b) => (a.d < b.d ? -1 : 1))
        .slice(0, 3),
    [dates, today],
  );
  return (
    <a className="card card-link" href={href('dates')}>
      <span className="label label-accent">
        <CalendarClock size={14} aria-hidden="true" /> {t('widget.dates')}
      </span>
      {upcoming.length === 0 ? (
        <span className="small muted block mt-10">{t('dates.nothingSoon')}</span>
      ) : (
        <span className="stack gap-6 mt-10">
          {upcoming.map(({ kd, d }) => (
            <span key={kd.id} className="row small gap-8 top">
              <span aria-hidden="true">{keyDateEmoji(kd.kind)}</span>
              <span className="grow tight">
                <span className="ellipsis bold block">{keyDateLabel(kd, d)}</span>
                <span className="tiny muted num block">{inDays(d, today)}</span>
              </span>
            </span>
          ))}
        </span>
      )}
    </a>
  );
}

export function ExpensesCard({ today }: { today: DateStr }) {
  const { adults } = useApp();
  const expenses = useCollection('expenses');
  const { total, debt } = useMemo(
    () => ({
      total: monthTotal(expenses ?? [], today.slice(0, 7)),
      debt: settlements(expenses ?? [], adults)[0],
    }),
    [expenses, adults, today],
  );
  return (
    <a className="card card-link" href={href('expenses')}>
      <span className="label label-blue">
        <Wallet size={14} aria-hidden="true" /> {t('expenses.thisMonth')}
      </span>
      <span className="big-num num block">{euros(total)}</span>
      <span className="small muted block mt-4">
        {debt ? (
          <>
            {debt.from.name} {t('expenses.owes')} <b>{euros(debt.amount)}</b> {t('expenses.to')} {debt.to.name}
          </>
        ) : (
          t('expenses.settledUp')
        )}
      </span>
    </a>
  );
}

export function NotesCard() {
  const notes = useCollection('notes');
  const n = useMemo(() => sortNotes(notes ?? [])[0], [notes]);
  return (
    <a
      className={`card card-link${n ? ' note-card' : ''}`}
      href={href('notes')}
      style={n ? { '--nc': n.color } : undefined}
    >
      <span className="label">
        <StickyNote size={14} aria-hidden="true" /> {t('widget.notes')}
      </span>
      {n ? (
        <>
          <span className="bold block mt-8 note-ink">{n.title}</span>
          <span className="small block clamp-3 note-ink-2 pre-line">{n.body}</span>
        </>
      ) : (
        <span className="small muted block mt-10">{t('notes.noneYet')}</span>
      )}
    </a>
  );
}
