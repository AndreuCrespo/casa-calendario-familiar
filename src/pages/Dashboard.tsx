import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CalendarClock, Droplets, ListChecks, ListTodo, MapPin, Settings2, Share2, ShoppingCart, StickyNote,
  UtensilsCrossed, Wallet, Zap,
} from 'lucide-react';
import { useApp, useCollection, useNow, useToday } from '../lib/app';
import { keyDateEmoji, keyDateLabel, useAgenda, useNextUp, type DayAgenda } from '../lib/agenda';
import { cap, countdown, dayLong, dayRelative, decimal, dow, euros, inDays, memberNames, timeRange } from '../lib/format';
import { useWeather, weatherLabel, type Weather } from '../lib/weather';
import { cheapestWindow, priceLevel, priceStats, usePvpc } from '../lib/pvpc';
import { settlements } from '../lib/expenses';
import { packSpans, useDashboardLayout, type WidgetId } from '../lib/dashboard';
import { href } from '../lib/router';
import { addDays, diffDays, parts, weekday, zonedParts, zonedToUtc } from '../shared/dates';
import { nextKeyDate, type Occurrence } from '../shared/recurrence';
import type { CalEvent, Expense, KeyDate, MenuDay, Note, ShoppingItem, Task } from '../shared/types';
import { EventEditor } from '../components/EventEditor';
import { DashboardEditor } from '../components/DashboardEditor';
import { MemberDots, Sheet, WeatherIcon, memberColorStyle, toast } from '../components/ui';
import { t, tn } from '../i18n';

export default function Dashboard() {
  const { household, demo } = useApp();
  const today = useToday();
  const [editing, setEditing] = useState<{ ev: CalEvent; occ: string } | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const layout = useDashboardLayout();
  const weather = useWeather();
  const openOcc = (o: Occurrence) => setEditing({ ev: o.event, occ: o.date });

  const render: Record<WidgetId, () => ReactNode> = {
    hero: () => <Hero weather={weather.data} />,
    next: () => <NextCard onOpen={openOcc} />,
    agenda: () => <AgendaCard today={today} onOpen={openOcc} />,
    menu: () => <MenuTodayCard today={today} />,
    week: () => <WeekStrip today={today} weather={weather.data} onOpen={openOcc} />,
    shopping: () => <ShoppingCard />,
    tasks: () => <TasksCard today={today} />,
    energy: () => <EnergyCard />,
    dates: () => <DatesCard today={today} />,
    expenses: () => <ExpensesCard today={today} />,
    notes: () => <NotesCard />,
  };

  const visible = layout.order.filter((id) => !layout.hidden.has(id));
  const spans = packSpans(visible);

  return (
    <div className="dash">
      {!demo && household.memberUids.length < 2 && <div className="w m-2 d-3"><InviteCard /></div>}
      {layout.loaded && visible.map((id) => (
        <div key={id} className={`w m-${spans.get(id)!.m} d-${spans.get(id)!.d}`}>{render[id]()}</div>
      ))}
      {layout.loaded && visible.length === 0 && (
        <div className="w m-2 d-3 card center" style={{ padding: 32 }}>
          <p className="muted">{t('dash.allHidden')}</p>
        </div>
      )}
      <div className="w m-2 d-3" style={{ alignItems: 'center' }}>
        <button className="btn ghost sm" style={{ flex: 'none' }} onClick={() => setCustomizing(true)}>
          <Settings2 size={16} /> {t('dash.customize')}
        </button>
      </div>
      {editing && <EventEditor event={editing.ev} occurrence={editing.occ} onClose={() => setEditing(null)} />}
      {customizing && <DashboardEditor onClose={() => setCustomizing(false)} />}
    </div>
  );
}

function WeekStrip({ today, weather, onOpen }: { today: string; weather?: Weather; onOpen: (o: Occurrence) => void }) {
  const days = useAgenda(today, addDays(today, 6));
  return (
    <section className="week">
      {days.map((d) => <WeekDay key={d.date} day={d} today={today} weather={weather} onOpen={onOpen} />)}
    </section>
  );
}

function AgendaCard({ today, onOpen }: { today: string; onOpen: (o: Occurrence) => void }) {
  const { members, tz } = useApp();
  const now = useNow(60_000);
  const days = useAgenda(today, addDays(today, 1));

  return (
    <section className="card">
      <a className="label" href={href('calendar')}><ListTodo size={14} /> {t('widget.agenda')}</a>
      {days.map((d, di) => {
        const items = d.allDay.length + d.timed.length + d.keyDates.length;
        return (
          <div key={d.date} className="agenda-day">
            <div className="agenda-head">
              <b>{di === 0 ? t('date.today') : t('date.tomorrow')}</b> <span className="muted">{dayLong(d.date)}</span>
            </div>
            {items === 0 && <p className="small muted" style={{ padding: '4px 0 2px' }}>{t('agenda.nothing')}</p>}
            {d.keyDates.map((kd) => (
              <a key={kd.id} className="agenda-item" href={href('dates')}>
                <span className="agenda-time">{keyDateEmoji(kd.kind)}</span>
                <span className="bar" style={memberColorStyle(kd.memberIds, members)} />
                <span className="grow item-title">{keyDateLabel(kd, d.date)}</span>
              </a>
            ))}
            {[...d.allDay, ...d.timed].map((o) => {
              const timed = !!o.event.startTime && o.date === d.date;
              let past = false;
              if (timed && di === 0) {
                let end = o.event.endTime ? zonedToUtc(o.endDate, o.event.endTime, tz) : zonedToUtc(o.date, o.event.startTime!, tz) + 3600_000;
                if (o.event.endTime && o.event.endTime < o.event.startTime!) end += 86400_000;
                past = end < now;
              }
              return (
                <button key={o.key} className={`agenda-item${past ? ' past' : ''}`} onClick={() => onOpen(o)}>
                  <span className="agenda-time num">{timed ? o.event.startTime : o.date !== d.date ? t('agenda.continues') : t('date.allDay')}</span>
                  <span className={`bar${(o.event.memberIds?.length ?? 0) > 1 ? ' multi' : ''}`} style={memberColorStyle(o.event.memberIds, members)} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="item-title ellipsis" style={{ display: 'block' }}>{o.event.title}</span>
                    {!!(o.event.location || o.event.memberIds?.length) && (
                      <span className="item-sub ellipsis" style={{ display: 'block' }}>
                        {o.event.location && <MapPin size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}
                        {[o.event.location, memberNames(o.event.memberIds, members)].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function MenuTodayCard({ today }: { today: string }) {
  const menu = useCollection<MenuDay>('menu');
  const [edit, setEdit] = useState(false);
  const m = menu?.find((x) => x.id === today);
  const tomorrow = menu?.find((x) => x.id === addDays(today, 1));
  const empty = !m?.lunch && !m?.dinner;
  return (
    <>
      <button className="card card-link" style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setEdit(true)}>
        <div className="label" style={{ color: 'var(--amber)' }}><UtensilsCrossed size={14} /> {t('widget.menu')}</div>
        {empty ? (
          <p className="small muted" style={{ marginTop: 10 }}>{t('menu.notPlanned')}</p>
        ) : (
          <div className="stack" style={{ gap: 6, marginTop: 10 }}>
            <div><div className="tiny muted bold">{t('menu.lunch').toUpperCase()}</div><div className="bold menu-dish">{m?.lunch || '—'}</div></div>
            <div><div className="tiny muted bold">{t('menu.dinner').toUpperCase()}</div><div className="bold menu-dish">{m?.dinner || '—'}</div></div>
          </div>
        )}
        {(tomorrow?.lunch || tomorrow?.dinner) && (
          <p className="tiny muted ellipsis" style={{ marginTop: 8 }}>{t('menu.tomorrowPrefix')} {[tomorrow.lunch, tomorrow.dinner].filter(Boolean).join(' · ')}</p>
        )}
      </button>
      {edit && <MenuQuickEdit date={today} current={m} all={menu ?? []} onClose={() => setEdit(false)} />}
    </>
  );
}

function MenuQuickEdit({ date, current, all, onClose }: { date: string; current?: MenuDay; all: MenuDay[]; onClose: () => void }) {
  const { backend, log } = useApp();
  const [lunch, setLunch] = useState(current?.lunch ?? '');
  const [dinner, setDinner] = useState(current?.dinner ?? '');
  const dishes = useMemo(() => {
    const count = new Map<string, number>();
    for (const x of all) for (const d of [x.lunch, x.dinner]) if (d) count.set(d, (count.get(d) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 100);
  }, [all]);

  const save = () => {
    const l = lunch.trim();
    const d = dinner.trim();
    if (l !== (current?.lunch ?? '') || d !== (current?.dinner ?? '')) {
      backend.set('menu', date, { lunch: l, dinner: d }, true);
      log('menu', [l, d].filter(Boolean).join(' / '));
    }
    onClose();
  };

  return (
    <Sheet
      title={`${t('nav.menu')} · ${dayLong(date)}`}
      onClose={onClose}
      footer={<>
        <a className="btn ghost" style={{ flex: 'none' }} href={href('menu')}>{t('menu.seeWeek')}</a>
        <button className="btn accent" onClick={save}>{t('common.save')}</button>
      </>}
    >
      <datalist id="dishes-quick">{dishes.map((d) => <option key={d} value={d} />)}</datalist>
      <label className="field"><span>{t('menu.lunch')}</span>
        <input value={lunch} onChange={(e) => setLunch(e.target.value)} list="dishes-quick" placeholder={t('menu.lunchPlaceholder')} />
      </label>
      <label className="field"><span>{t('menu.dinner')}</span>
        <input value={dinner} onChange={(e) => setDinner(e.target.value)} list="dishes-quick" placeholder={t('menu.dinnerPlaceholder')} />
      </label>
    </Sheet>
  );
}

function Hero({ weather }: { weather?: Weather }) {
  const { tz, household } = useApp();
  const now = useNow(5_000);
  const p = zonedParts(now, tz);
  const date = p.date;
  const di = weather ? weather.daily.date.indexOf(date) : -1;

  return (
    <section className="hero">
      <div className="hero-top">
        <div>
          <div className="hero-clock num">{String(p.hour).padStart(2, '0')}:{String(p.minute).padStart(2, '0')}</div>
          <div className="hero-date"><b>{cap(dayLong(date).split(' ')[0])}</b> {dayLong(date).split(' ').slice(1).join(' ')}</div>
        </div>
        {weather && (
          <a className="hero-now" href={href('weather')}>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
              <WeatherIcon code={weather.current.code} isDay={weather.current.isDay} size={30} />
              <span className="t num">{Math.round(weather.current.temp)}°</span>
            </div>
            <div className="s">{weatherLabel(weather.current.code)}</div>
            {di >= 0 && (
              <div className="s num">
                {Math.round(weather.daily.min[di])}° / {Math.round(weather.daily.max[di])}° · <Droplets size={11} style={{ verticalAlign: -1 }} /> {weather.daily.pop[di] ?? 0}%
              </div>
            )}
          </a>
        )}
        {!weather && !household.location && (
          <a className="hero-now s" href={href('settings')} style={{ opacity: .8, fontSize: 13, maxWidth: 140 }}>{t('hero.pickCity')}</a>
        )}
      </div>
      {weather && di >= 0 && (
        <a className="hero-days" href={href('weather')}>
          {weather.daily.date.slice(di + 1, di + 6).map((d, i) => {
            const k = di + 1 + i;
            return (
              <div className="hero-day num" key={d}>
                <span>{dow()[weekday(d)]}</span>
                <WeatherIcon code={weather.daily.code[k]} size={20} />
                <span className="mx">{Math.round(weather.daily.max[k])}°</span>
                <span className="mn">{Math.round(weather.daily.min[k])}°</span>
                <span className="pp">{weather.daily.pop[k] ?? 0}%</span>
              </div>
            );
          })}
        </a>
      )}
    </section>
  );
}

function NextCard({ onOpen }: { onOpen: (o: Occurrence) => void }) {
  const { members } = useApp();
  const now = useNow(30_000);
  const today = useToday();
  const next = useNextUp(now, today);

  if (!next) {
    return (
      <section className="next idle">
        <div className="label">{t('widget.next')}</div>
        <div className="next-title">{t('next.nothing')}</div>
        <div className="next-when">{t('next.free')}</div>
      </section>
    );
  }
  const ongoing = next.start <= now;
  const who = memberNames(next.occ.event.memberIds, members);
  return (
    <button className="next" style={{ textAlign: 'left' }} onClick={() => onOpen(next.occ)}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="label">{ongoing ? t('next.now') : t('widget.next')}</div>
        <span className="pill">{ongoing ? t('next.inProgress') : countdown(next.start - now)}</span>
      </div>
      <div className="next-title">{next.occ.event.title}</div>
      <div className="next-when">
        {dayRelative(next.occ.date, today)} · {timeRange(next.occ.event)}{who ? ` · ${who}` : ''}
      </div>
    </button>
  );
}

function WeekDay({ day, today, weather, onOpen }: { day: DayAgenda; today: string; weather?: Weather; onOpen: (o: Occurrence) => void }) {
  const { members } = useApp();
  const isToday = day.date === today;
  const wi = weather ? weather.daily.date.indexOf(day.date) : -1;
  const empty = !day.allDay.length && !day.timed.length && !day.keyDates.length;

  return (
    <div className={`wday${isToday ? ' today' : ''}`}>
      <a className="wday-head" href={href('calendar', day.date)}>
        <span>{isToday ? t('date.today') : dow()[weekday(day.date)]}</span>
        <span className="n num">{parts(day.date).d}</span>
      </a>
      {wi >= 0 && (
        <div className="wday-wx num">
          <WeatherIcon code={weather!.daily.code[wi]} size={14} />
          {Math.round(weather!.daily.max[wi])}° / {Math.round(weather!.daily.min[wi])}°
        </div>
      )}
      <div className="wday-events">
        {day.keyDates.map((kd) => (
          <a key={kd.id} className="wev allday" href={href('dates')} style={memberColorStyle(kd.memberIds, members)}>
            {keyDateEmoji(kd.kind)} {keyDateLabel(kd, day.date)}
          </a>
        ))}
        {day.allDay.map((o) => (
          <button key={o.key} className="wev allday" style={{ ...memberColorStyle(o.event.memberIds, members), textAlign: 'left' }} onClick={() => onOpen(o)}>
            {o.event.title}
          </button>
        ))}
        {day.timed.map((o) => (
          <button key={o.key} className="wev" style={{ ...memberColorStyle(o.event.memberIds, members), textAlign: 'left' }} onClick={() => onOpen(o)}>
            <div className="t num">{o.event.startTime}</div>
            <div className="n">{o.event.title}</div>
          </button>
        ))}
        {empty && <span className="muted small">—</span>}
      </div>
      {(day.menu?.lunch || day.menu?.dinner) && (
        <a className="wmenu" href={href('menu')}>
          🍽️ {[day.menu?.lunch, day.menu?.dinner].filter(Boolean).join(' · ')}
        </a>
      )}
    </div>
  );
}

function InviteCard() {
  const { household } = useApp();
  const link = `${location.origin}/?join=${household.id}`;
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: household.name, text: t('invite.shareText', { name: household.name }), url: link }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link);
      toast(t('invite.copied'));
    }
  };
  return (
    <section className="card" style={{ background: 'var(--blue-soft)', borderColor: 'transparent' }}>
      <div className="row">
        <div className="grow">
          <b>{t('invite.title')}</b>
          <p className="small muted">{t('invite.text')}</p>
        </div>
        <button className="btn sm" onClick={share}><Share2 size={16} /> {t('common.share')}</button>
      </div>
    </section>
  );
}

function ShoppingCard() {
  const items = useCollection<ShoppingItem>('shopping');
  const pending = (items ?? []).filter((i) => !i.done).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <a className="card card-link" href={href('shopping')}>
      <div className="label" style={{ color: 'var(--amber)' }}><ShoppingCart size={14} /> {t('widget.shopping')}</div>
      <div className="big-num">{pending.length ? tn('shopping.items', pending.length) : t('shopping.nothing')}</div>
      <p className="small muted" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {pending.length ? pending.map((i) => i.name).join(' · ') : t('shopping.emptyShort')}
      </p>
    </a>
  );
}

function TasksCard({ today }: { today: string }) {
  const { members } = useApp();
  const tasks = useCollection<Task>('tasks');
  const due = (tasks ?? []).filter((x) => !x.done && x.due && x.due <= today).sort((a, b) => (a.due! < b.due! ? -1 : 1));
  return (
    <a className="card card-link" href={href('tasks')}>
      <div className="label" style={{ color: 'var(--green)' }}><ListChecks size={14} /> {t('widget.tasks')}</div>
      {due.length === 0 ? (
        <>
          <div className="big-num">🎉 {t('tasks.allDone')}</div>
          <p className="small muted" style={{ marginTop: 4 }}>{t('tasks.nothingToday')}</p>
        </>
      ) : (
        <>
          <div className="big-num">{t('tasks.toDo', { n: due.length })}</div>
          <div className="stack" style={{ gap: 4, marginTop: 6 }}>
            {due.slice(0, 3).map((x) => (
              <div key={x.id} className="row small" style={{ gap: 6 }}>
                <MemberDots ids={x.memberIds} members={members} />
                <span className="ellipsis grow" style={x.due! < today ? { color: 'var(--red)', fontWeight: 700 } : undefined}
                  title={x.due! < today ? t('tasks.overdueTitle', { when: inDays(x.due!, today) }) : undefined}>{x.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </a>
  );
}

function EnergyCard() {
  const { data, hour } = usePvpc();
  if (!data) {
    return (
      <a className="card card-link" href={href('energy')}>
        <div className="label"><Zap size={14} /> {t('widget.energy')}</div>
        <p className="small muted" style={{ marginTop: 10 }}>{t('energy.loading')}</p>
      </a>
    );
  }
  const stats = priceStats(data);
  const cur = data.hours.find((h) => h.hour === hour) ?? data.hours[0];
  const lvl = priceLevel(cur.price, stats);
  const best = cheapestWindow(data, 2, hour);
  const max = stats.max;
  return (
    <a className="card card-link" href={href('energy')}>
      <div className="label" style={{ color: 'var(--amber)' }}><Zap size={14} /> {t('energy.now')}</div>
      <div className="row" style={{ marginTop: 8, gap: 6, alignItems: 'baseline' }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 800 }}>{decimal(cur.price, 3)}</span>
        <span className="tiny muted bold">€/kWh</span>
        <span className={`dot lvl-${lvl}`} style={{ marginLeft: 'auto' }} />
      </div>
      <div className="mini-bars" style={{ marginTop: 10 }}>
        {data.hours.map((h) => (
          <i key={h.hour}
            className={`lvl-${priceLevel(h.price, stats)}${h.hour === hour ? ' now' : ''}${h.hour < hour ? ' past' : ''}`}
            style={{ height: `${Math.max(8, (h.price / max) * 100)}%` }} />
        ))}
      </div>
      {best && <p className="small muted" style={{ marginTop: 8 }}>{t('energy.cheapest')} <b>{best.start}:00–{best.start + 2}:00</b></p>}
    </a>
  );
}

function DatesCard({ today }: { today: string }) {
  const dates = useCollection<KeyDate>('dates');
  const upcoming = useMemo(() => (dates ?? [])
    .map((kd) => ({ kd, d: nextKeyDate(kd, today) }))
    .filter((x) => x.d && diffDays(x.d, today) <= 45)
    .sort((a, b) => (a.d! < b.d! ? -1 : 1))
    .slice(0, 3), [dates, today]);
  return (
    <a className="card card-link" href={href('dates')}>
      <div className="label" style={{ color: 'var(--accent)' }}><CalendarClock size={14} /> {t('widget.dates')}</div>
      {upcoming.length === 0 ? (
        <p className="small muted" style={{ marginTop: 10 }}>{t('dates.nothingSoon')}</p>
      ) : (
        <div className="stack" style={{ gap: 6, marginTop: 10 }}>
          {upcoming.map(({ kd, d }) => (
            <div key={kd.id} className="row small" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span>{keyDateEmoji(kd.kind)}</span>
              <div className="grow" style={{ minWidth: 0, lineHeight: 1.25 }}>
                <div className="ellipsis bold">{keyDateLabel(kd, d!)}</div>
                <div className="tiny muted num">{inDays(d!, today)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </a>
  );
}

function ExpensesCard({ today }: { today: string }) {
  const { adults } = useApp();
  const expenses = useCollection<Expense>('expenses');
  const month = today.slice(0, 7);
  const total = (expenses ?? []).filter((e) => e.kind === 'expense' && e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  const debts = settlements(expenses ?? [], adults);
  return (
    <a className="card card-link" href={href('expenses')}>
      <div className="label" style={{ color: 'var(--blue)' }}><Wallet size={14} /> {t('expenses.thisMonth')}</div>
      <div className="big-num num">{euros(total)}</div>
      <p className="small muted" style={{ marginTop: 4 }}>
        {debts.length ? <>{debts[0].from.name} {t('expenses.owes')} <b>{euros(debts[0].amount)}</b> {t('expenses.to')} {debts[0].to.name}</> : t('expenses.settledUp')}
      </p>
    </a>
  );
}

function NotesCard() {
  const notes = useCollection<Note>('notes');
  const pinned = (notes ?? []).filter((n) => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const n = pinned[0] ?? (notes ?? []).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return (
    <a className="card card-link" href={href('notes')} style={n ? { background: n.color, borderColor: 'transparent' } as CSSProperties : undefined}>
      <div className="label" style={n ? { color: '#8b8274' } : undefined}><StickyNote size={14} /> {t('widget.notes')}</div>
      {n ? (
        <>
          <div className="bold" style={{ marginTop: 8, color: '#2a2620' }}>{n.title}</div>
          <p className="small" style={{ marginTop: 2, color: '#4a443b', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</p>
        </>
      ) : (
        <p className="small muted" style={{ marginTop: 10 }}>{t('notes.noneYet')}</p>
      )}
    </a>
  );
}

