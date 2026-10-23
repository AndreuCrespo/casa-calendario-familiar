// Pure notifier logic: decides WHICH notifications to send on each run from a
// household's data. No I/O, no Firestore, no network and no npm dependencies
// (only the app's shared modules), so it can be tested with sample data (see
// test.ts). The wording of each message, per language, lives in i18n.ts.
import type {
  Activity, ActivityKind, CalEvent, Device, Household, KeyDate, KeyDateKind, Member, MenuDay,
  NotifySettings, Task,
} from '../../src/shared/types';
import {
  addDays, diffDays, parts, zonedParts, zonedToUtc, type DateStr,
} from '../../src/shared/dates';
import { expandEvents, nextKeyDate, occursOn, type Occurrence } from '../../src/shared/recurrence';
import { DEFAULT_LANG, fmtTime, texts, toLang, type Lang, type Texts } from './i18n';

export type { Lang };

// ---------- constants ----------

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const DEFAULT_TZ = 'Europe/Madrid';
/** Catch up on reminders from the last 45 min at most (delayed cron). */
export const MAX_CATCHUP = 45 * MINUTE;
/** With no known previous run, look back 15 min. */
export const FIRST_RUN_LOOKBACK = 15 * MINUTE;
/** Activity older than this is no longer notified (only marked). */
export const ACTIVITY_MAX_AGE = 12 * HOUR;
/** Local hour from which key dates are announced. */
export const KEYDATE_HOUR = 9;
/** The daily summary can be sent during these many hours from `dailyHour`. */
export const DAILY_WINDOW_HOURS = 3;
/** Reminders of all-day events are relative to this local time. */
export const ALLDAY_BASE_MIN = 9 * 60;

/** App screens (hash routes) that notifications open. */
export const URLS = {
  home: '/#/',
  calendar: '/#/calendar',
  shopping: '/#/shopping',
  tasks: '/#/tasks',
  dates: '/#/dates',
  expenses: '/#/expenses',
  notes: '/#/notes',
  menu: '/#/menu',
} as const;

// ---------- types ----------

/** 'all' = every device in the household; excludeUid = everyone except that user's devices. */
export type Audience = 'all' | { excludeUid: string };

export type MessageKind = 'reminder' | 'keydate' | 'daily' | 'activity';

export interface OutMessage {
  /** Dedupe key (stored in notifyLog), the same in every language. Activity has none. */
  key?: string;
  kind: MessageKind;
  title: string;
  body: string;
  url: string;
  tag: string;
  urgency: 'high' | 'normal';
  toUids: Audience;
}

export interface ComputeInput {
  household: Household;
  events: CalEvent[];
  tasks: Task[];
  menuToday?: MenuDay | null;
  keyDates: KeyDate[];
  activity: Activity[];
  now: number;
  lastRunAt?: number | null;
  sentKeys?: ReadonlySet<string> | readonly string[];
}

export interface ComputeResult {
  messages: OutMessage[];
  activityIdsToMark: string[];
}

// ---------- settings ----------

const tzValid = new Map<string, boolean>();
/** The household's time zone (or Europe/Madrid if missing or invalid). */
export function householdTz(h: Pick<Household, 'timezone'>): string {
  const tz = h.timezone;
  if (!tz) return DEFAULT_TZ;
  let ok = tzValid.get(tz);
  if (ok === undefined) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); ok = true; } catch { ok = false; }
    tzValid.set(tz, ok);
  }
  return ok ? tz : DEFAULT_TZ;
}

export function notifySettings(h: Pick<Household, 'notify'>): NotifySettings {
  const n: Partial<NotifySettings> = h.notify ?? {};
  const hour = Number(n.dailyHour);
  return {
    dailySummary: n.dailySummary !== false,
    dailyHour: Number.isFinite(hour) && n.dailyHour != null ? Math.min(23, Math.max(0, Math.trunc(hour))) : 8,
    activity: n.activity !== false,
  };
}

/** Start (exclusive) of this run's reminder window. */
export function reminderWindowStart(now: number, lastRunAt?: number | null): number {
  if (lastRunAt == null || !Number.isFinite(lastRunAt)) return now - FIRST_RUN_LOOKBACK;
  return Math.max(lastRunAt, now - MAX_CATCHUP);
}

export const dailyKey = (date: DateStr) => `daily_${date}`;

/** Are we in the daily summary's time window (regardless of whether it was already sent)? */
export function isDailyWindow(h: Household, now: number): boolean {
  const s = notifySettings(h);
  if (!s.dailySummary) return false;
  const hour = zonedParts(now, householdTz(h)).hour;
  return hour >= s.dailyHour && hour < s.dailyHour + DAILY_WINDOW_HOURS;
}

/** Language of a device's notifications (missing or unknown ⇒ 'es'). */
export function deviceLang(d: Pick<Device, 'lang'>): Lang {
  return toLang(d.lang);
}

// ---------- helpers ----------

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const isTime = (t: unknown): t is string => typeof t === 'string' && TIME_RE.test(t);

function memberNames(ids: string[] | undefined, members: Member[], tx: Texts): string {
  if (!ids?.length) return '';
  const byId = new Map(members.map((m) => [m.id, m.name]));
  return tx.list(ids.map((id) => byId.get(id) ?? '').filter(Boolean));
}

// ---------- 1. event reminders ----------

const validReminder = (m: unknown): m is number => typeof m === 'number' && Number.isFinite(m) && m >= 0;

/**
 * Instant at which an occurrence's reminder fires.
 * - Timed: start − reminderMins. Whole days are counted in wall-clock time
 *   ("1 day before" 10:00 is at 10:00 even across a DST change) and the rest
 *   in real minutes (30 min before is 30 real minutes).
 * - All day: relative to 09:00 wall-clock time, so 780 is always "20:00 the
 *   day before" even if the clocks change that night.
 */
export function reminderFireAt(ev: Pick<CalEvent, 'startTime' | 'reminderMins'>, date: DateStr, tz: string): number {
  const mins = ev.reminderMins ?? 0;
  if (isTime(ev.startTime)) {
    const days = Math.floor(mins / 1440);
    return zonedToUtc(addDays(date, -days), ev.startTime, tz) - (mins - days * 1440) * MINUTE;
  }
  const total = ALLDAY_BASE_MIN - mins;
  const dayOff = Math.floor(total / 1440);
  const m = total - dayOff * 1440;
  const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return zonedToUtc(addDays(date, dayOff), hhmm, tz);
}

/** Days ahead that must be expanded to cover the longest reminder. */
export function reminderLookaheadDays(events: Pick<CalEvent, 'reminderMins'>[]): number {
  let max = 0;
  for (const e of events) if (validReminder(e.reminderMins)) max = Math.max(max, e.reminderMins);
  return Math.max(2, Math.ceil(max / 1440) + 1);
}

function reminderBody(o: Occurrence, today: DateStr, members: Member[], tx: Texts): string {
  const ev = o.event;
  let when = tx.reminderWhen(o.date, isTime(ev.startTime) ? ev.startTime : null, today);
  if (o.endDate > o.date) when += tx.until(o.endDate);
  const bits = [when];
  const names = memberNames(ev.memberIds, members, tx);
  if (names) bits.push(names);
  if (ev.location?.trim()) bits.push(ev.location.trim());
  return bits.join(' · ');
}

function eventReminders(
  events: CalEvent[], members: Member[], tz: string, today: DateStr,
  now: number, windowStart: number, sent: ReadonlySet<string>, tx: Texts,
): OutMessage[] {
  const withRem = events.filter((e) => validReminder(e.reminderMins));
  if (!withRem.length) return [];
  const from = addDays(today, -1);
  const occs = expandEvents(withRem, from, addDays(today, reminderLookaheadDays(withRem)));
  const out: OutMessage[] = [];
  for (const o of occs) {
    if (o.date < from) continue; // multi-day event that started earlier: its reminder is long gone
    const fireAt = reminderFireAt(o.event, o.date, tz);
    if (!(fireAt > windowStart && fireAt <= now)) continue;
    const key = `ev_${o.event.id}_${o.date}_${o.event.reminderMins}`;
    if (sent.has(key)) continue;
    out.push({
      key,
      kind: 'reminder',
      title: o.event.title?.trim() || tx.untitledEvent,
      body: reminderBody(o, today, members, tx),
      url: URLS.calendar,
      tag: `ev_${o.event.id}_${o.date}`,
      urgency: 'high',
      toUids: 'all',
    });
  }
  return out;
}

// ---------- 4. key dates ----------

const KD_EMOJI: Record<KeyDateKind, string> = {
  birthday: '🎂', car: '🚗', insurance: '🛡️', bill: '🧾', health: '🩺', school: '🎒', other: '📌',
};
/** Kinds that "fall due" (Vence… / Due…). */
const KD_DUE: ReadonlySet<string> = new Set(['car', 'insurance', 'bill']);
/** Birthday titles that already say so ("Cumple de la abuela", "Grandma's birthday") are kept as is. */
const SAYS_BIRTHDAY = /^cumple|birthday/i;

const kdEmoji = (kd: KeyDate) => KD_EMOJI[kd.kind] ?? KD_EMOJI.other;
const hasAmount = (kd: KeyDate) => typeof kd.amount === 'number' && kd.amount > 0;

/** Next date (>= today). Birthdays repeat every year even if stored wrongly. */
export function keyDateNext(kd: KeyDate, today: DateStr): DateStr | null {
  return nextKeyDate(kd.kind === 'birthday' ? { ...kd, repeat: 'yearly' } : kd, today);
}

/** Age turned on `d` (null if the date of birth has no credible year). */
export function birthdayAge(kd: KeyDate, d: DateStr): number | null {
  const born = parts(kd.date).y;
  const age = parts(d).y - born;
  return born >= 1900 && age >= 1 && age < 130 ? age : null;
}

export function keyDateTitle(kd: KeyDate, lang: Lang = DEFAULT_LANG): string {
  const tx = texts(lang);
  const t = kd.title?.trim() ?? '';
  if (kd.kind === 'birthday') return `🎂 ${SAYS_BIRTHDAY.test(t) ? t : tx.birthdayOf(t)}`;
  return `${kdEmoji(kd)} ${t || tx.untitledKeyDate}`;
}

export function keyDateBody(kd: KeyDate, d: DateStr, today: DateStr, lang: Lang = DEFAULT_LANG): string {
  const tx = texts(lang);
  const n = diffDays(d, today);
  if (kd.kind === 'birthday') return tx.birthdayBody(n, birthdayAge(kd, d), d, today);
  let body = tx.keyDateBody(n, KD_DUE.has(kd.kind), d, today);
  if (hasAmount(kd)) body += ` · ${tx.money(kd.amount!)}`;
  return body;
}

function keyDateMessages(
  keyDates: KeyDate[], today: DateStr, hour: number, sent: ReadonlySet<string>, lang: Lang,
): OutMessage[] {
  if (hour < KEYDATE_HOUR) return [];
  const out: OutMessage[] = [];
  for (const kd of keyDates) {
    const d = keyDateNext(kd, today);
    if (!d) continue;
    const diff = diffDays(d, today);
    const rd = Math.max(0, Math.trunc(Number(kd.remindDays) || 0));
    const fire: number[] = [];
    if (diff === rd) fire.push(rd);
    if (rd > 0 && diff === 0) fire.push(0);
    for (const r of fire) {
      const key = `kd_${kd.id}_${d}_${r}`;
      if (sent.has(key)) continue;
      out.push({
        key,
        kind: 'keydate',
        title: keyDateTitle(kd, lang),
        body: keyDateBody(kd, d, today, lang),
        url: URLS.dates,
        tag: `kd_${kd.id}_${d}`,
        urgency: 'normal',
        toUids: 'all',
      });
    }
  }
  return out;
}

// ---------- 3. daily summary ----------

const MAX_DAILY_EVENTS = 6;
const MAX_TASK_TITLES = 3;

export function dailySummary(
  input: Pick<ComputeInput, 'household' | 'events' | 'tasks' | 'menuToday' | 'keyDates' | 'now'>,
  sent: ReadonlySet<string> = new Set(),
  lang: Lang = DEFAULT_LANG,
): OutMessage | null {
  const { household, now } = input;
  if (!isDailyWindow(household, now)) return null;
  const tx = texts(lang);
  const tz = householdTz(household);
  const { date: today, hour } = zonedParts(now, tz);
  const key = dailyKey(today);
  if (sent.has(key)) return null;

  const lines: string[] = [];
  const byTitle = (a: string, b: string) => a.localeCompare(b, tx.locale);

  // Today's events: all-day ones (or ones carried over from earlier days) first.
  const occs = expandEvents(input.events, today, today).filter((o) => occursOn(o, today));
  const rows = occs.map((o) => {
    const timed = isTime(o.event.startTime) && o.date === today;
    return {
      sort: timed ? o.event.startTime! : '',
      label: timed ? fmtTime(o.event.startTime!) : tx.allDay,
      title: o.event.title?.trim() || tx.untitledEvent,
    };
  }).sort((a, b) => (a.sort === b.sort ? byTitle(a.title, b.title) : a.sort < b.sort ? -1 : 1));
  for (const r of rows.slice(0, MAX_DAILY_EVENTS)) lines.push(`${r.label} · ${r.title}`);
  if (rows.length > MAX_DAILY_EVENTS) lines.push(tx.moreEvents(rows.length - MAX_DAILY_EVENTS));

  // Menu
  const menu = input.menuToday;
  const meal: string[] = [];
  if (menu?.lunch?.trim()) meal.push(`${tx.lunch}: ${menu.lunch.trim()}`);
  if (menu?.dinner?.trim()) meal.push(`${tx.dinner}: ${menu.dinner.trim()}`);
  if (meal.length) lines.push(`🍽️ ${meal.join(' · ')}`);

  // Tasks due today or overdue
  const due = input.tasks
    .filter((t) => !t.done && typeof t.due === 'string' && t.due <= today)
    .sort((a, b) => (a.due! === b.due! ? byTitle(a.title, b.title) : a.due! < b.due! ? -1 : 1));
  if (due.length === 1) {
    lines.push(`✅ ${tx.oneTask(due[0].title, due[0].due! < today)}`);
  } else if (due.length > 1) {
    const overdue = due.filter((t) => t.due! < today).length;
    lines.push(`✅ ${tx.manyTasks(due.length, overdue, tx.list(due.map((t) => t.title), MAX_TASK_TITLES))}`);
  }

  // Today's key dates
  for (const kd of input.keyDates) {
    if (keyDateNext(kd, today) !== today) continue;
    let l = keyDateTitle(kd, lang);
    if (kd.kind === 'birthday') {
      const age = birthdayAge(kd, today);
      if (age != null) l += ` (${tx.ageNote(age)})`;
    } else {
      if (KD_DUE.has(kd.kind)) l += ` · ${tx.dueToday}`;
      if (hasAmount(kd)) l += ` · ${tx.money(kd.amount!)}`;
    }
    lines.push(l);
  }

  if (!lines.length) return null;
  return {
    key,
    kind: 'daily',
    title: `${tx.greeting(hour)} · ${tx.dayName(today)}`,
    body: lines.join('\n'),
    url: URLS.home,
    tag: key,
    urgency: 'normal',
    toUids: 'all',
  };
}

// ---------- 2. activity ----------

const KIND_ORDER: ActivityKind[] = ['shopping', 'event', 'task', 'date', 'expense', 'note', 'menu'];
/** App screen that each kind of activity opens. */
const KIND_URL: Record<ActivityKind, string> = {
  shopping: URLS.shopping, event: URLS.calendar, task: URLS.tasks, date: URLS.dates,
  expense: URLS.expenses, note: URLS.notes, menu: URLS.menu,
};
const MAX_ACTIVITY_ITEMS = 8;

/**
 * One notification per person with what they added. By default only counts
 * what wasn't notified yet; the instant function passes `includeNotified` to
 * rebuild the notification for the whole burst (same tag ⇒ it replaces the
 * previous one on the phone).
 */
export function activityDigest(
  activity: Activity[], now: number, opts: { includeNotified?: boolean } = {}, lang: Lang = DEFAULT_LANG,
): OutMessage[] {
  const tx = texts(lang);
  const recent = activity
    .filter((a) => (opts.includeNotified || !a.notified) && (a.createdAt ?? 0) >= now - ACTIVITY_MAX_AGE)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const byActor = new Map<string, Activity[]>();
  for (const a of recent) {
    const k = a.actorUid || '';
    byActor.set(k, [...(byActor.get(k) ?? []), a]);
  }
  const out: OutMessage[] = [];
  for (const [actorUid, items] of byActor) {
    // Group by kind and drop duplicates (the same thing added twice; case-insensitive,
    // the same in every language).
    const byKind = new Map<string, { texts: string[]; count: number }>();
    for (const a of items) {
      const g = byKind.get(a.kind) ?? { texts: [], count: 0 };
      g.count++;
      const t = (a.text ?? '').trim();
      if (t && !g.texts.some((x) => x.toLowerCase() === t.toLowerCase())) g.texts.push(t);
      byKind.set(a.kind, g);
    }
    const order = (k: string) => { const i = KIND_ORDER.indexOf(k as ActivityKind); return i < 0 ? 99 : i; };
    const kinds = [...byKind.keys()].sort((a, b) => byKind.get(b)!.count - byKind.get(a)!.count || order(a) - order(b));
    const dominant = kinds[0] as ActivityKind;
    const last = items[items.length - 1];
    out.push({
      kind: 'activity',
      title: last.actorName?.trim() || tx.someone,
      body: kinds.map((k) => tx.activityLine(k, byKind.get(k)!.texts, MAX_ACTIVITY_ITEMS)).join('\n'),
      url: KIND_URL[dominant] ?? URLS.home,
      tag: `act_${actorUid || 'anon'}_${items[0].createdAt ?? now}`,
      urgency: 'normal',
      toUids: actorUid ? { excludeUid: actorUid } : 'all',
    });
  }
  return out;
}

// ---------- main entry point ----------

/**
 * Computes a household's notifications for this run, worded in `lang`.
 * The result is the same for every language except for the text: same
 * messages, order, keys, tags, URLs and audiences.
 * The lists may come pre-filtered (see run.ts): it's enough that they include
 * the events that start or fall within [today−1, today+N], the recurring
 * ones, the pending tasks and all key dates.
 */
export function computeNotifications(input: ComputeInput, lang: Lang = DEFAULT_LANG): ComputeResult {
  const { household, now } = input;
  const sent: ReadonlySet<string> = input.sentKeys instanceof Set
    ? input.sentKeys
    : new Set(input.sentKeys ?? []);
  const tx = texts(lang);
  const tz = householdTz(household);
  const { date: today, hour } = zonedParts(now, tz);
  const settings = notifySettings(household);
  const members = household.members ?? [];

  const messages: OutMessage[] = [
    ...eventReminders(input.events, members, tz, today, now, reminderWindowStart(now, input.lastRunAt), sent, tx),
    ...keyDateMessages(input.keyDates, today, hour, sent, lang),
  ];
  const daily = dailySummary(input, sent, lang);
  if (daily) messages.push(daily);
  if (settings.activity) messages.push(...activityDigest(input.activity, now, {}, lang));

  // All pending activity is marked (even if the notification is turned off or
  // it's old) so it doesn't pile up.
  const activityIdsToMark = input.activity.filter((a) => !a.notified).map((a) => a.id);
  return { messages, activityIdsToMark };
}

/** Target devices of a message (no repeated endpoints). */
export function selectDevices<D extends Pick<Device, 'uid' | 'subscription'>>(devices: D[], to: Audience): D[] {
  const seen = new Set<string>();
  return devices.filter((d) => {
    const ep = d.subscription?.endpoint;
    if (!ep || !d.subscription?.keys?.p256dh || !d.subscription?.keys?.auth) return false;
    if (to !== 'all' && d.uid === to.excludeUid) return false;
    if (seen.has(ep)) return false;
    seen.add(ep);
    return true;
  });
}

/** What gets sent to the service worker. */
export function pushPayload(m: Pick<OutMessage, 'title' | 'body' | 'url' | 'tag'>): string {
  const body = m.body.length > 1500 ? `${m.body.slice(0, 1497)}…` : m.body;
  return JSON.stringify({ title: m.title, body, url: m.url, tag: m.tag });
}
