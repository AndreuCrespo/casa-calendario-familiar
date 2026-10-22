// Lógica pura del notificador: decide QUÉ notificaciones mandar en cada
// ejecución a partir de los datos de una casa. Sin E/S, sin Firestore, sin
// red y sin dependencias de npm (solo los módulos compartidos de la app),
// para poder probarla con datos de ejemplo (ver test.ts).
import type {
  Activity, ActivityKind, CalEvent, Device, Household, KeyDate, KeyDateKind, Member, MenuDay,
  NotifySettings, Task,
} from '../src/shared/types';
import {
  addDays, diffDays, parts, weekday, zonedParts, zonedToUtc, type DateStr,
} from '../src/shared/dates';
import { expandEvents, nextKeyDate, occursOn, type Occurrence } from '../src/shared/recurrence';

// ---------- constantes ----------

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const DEFAULT_TZ = 'Europe/Madrid';
/** Como mucho recuperamos recordatorios de los últimos 45 min (cron retrasado). */
export const MAX_CATCHUP = 45 * MINUTE;
/** Sin ejecución previa conocida, miramos 15 min hacia atrás. */
export const FIRST_RUN_LOOKBACK = 15 * MINUTE;
/** Actividad más antigua que esto ya no se notifica (solo se marca). */
export const ACTIVITY_MAX_AGE = 12 * HOUR;
/** Hora local a partir de la que se avisan las fechas clave. */
export const KEYDATE_HOUR = 9;
/** El resumen diario se puede mandar durante estas horas desde `dailyHour`. */
export const DAILY_WINDOW_HOURS = 3;
/** Los recordatorios de eventos de todo el día son relativos a esta hora local. */
export const ALLDAY_BASE_MIN = 9 * 60;

export const URLS = {
  home: '/#/',
  calendar: '/#/calendario',
  shopping: '/#/compra',
  tasks: '/#/tareas',
  dates: '/#/fechas',
  expenses: '/#/gastos',
  notes: '/#/notas',
  menu: '/#/menu',
} as const;

// ---------- tipos ----------

/** 'all' = todos los dispositivos de la casa; excludeUid = todos menos los de ese usuario. */
export type Audience = 'all' | { excludeUid: string };

export type MessageKind = 'reminder' | 'keydate' | 'daily' | 'activity';

export interface OutMessage {
  /** Clave de deduplicación (se guarda en notifyLog). La actividad no la lleva. */
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

// ---------- ajustes ----------

const tzValid = new Map<string, boolean>();
/** Zona horaria de la casa (o Europe/Madrid si falta o no es válida). */
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

/** Inicio (exclusivo) de la ventana de recordatorios de esta ejecución. */
export function reminderWindowStart(now: number, lastRunAt?: number | null): number {
  if (lastRunAt == null || !Number.isFinite(lastRunAt)) return now - FIRST_RUN_LOOKBACK;
  return Math.max(lastRunAt, now - MAX_CATCHUP);
}

export const dailyKey = (date: DateStr) => `daily_${date}`;

/** ¿Estamos en la franja del resumen diario (sin mirar si ya se mandó)? */
export function isDailyWindow(h: Household, now: number): boolean {
  const s = notifySettings(h);
  if (!s.dailySummary) return false;
  const hour = zonedParts(now, householdTz(h)).hour;
  return hour >= s.dailyHour && hour < s.dailyHour + DAILY_WINDOW_HOURS;
}

// ---------- textos en español ----------

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const WEEKDAYS_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const isTime = (t: unknown): t is string => typeof t === 'string' && TIME_RE.test(t);

/** '09:05' → '9:05' */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  return `${Number(h)}:${m}`;
}

/** 'a las 17:00', 'a la 1:30' */
export function atTime(t: string): string {
  return `${Number(t.split(':')[0]) === 1 ? 'a la' : 'a las'} ${fmtTime(t)}`;
}

/** 'jueves 22' */
export function dayName(d: DateStr): string {
  return `${WEEKDAYS[weekday(d)]} ${parts(d).d}`;
}

/** 'jue 29 oct' (con año si no es el de `today`) */
export function shortDate(d: DateStr, today?: DateStr): string {
  const p = parts(d);
  const year = today && parts(today).y !== p.y ? ` ${p.y}` : '';
  return `${WEEKDAYS_SHORT[weekday(d)]} ${p.d} ${MONTHS_SHORT[p.m - 1]}${year}`;
}

/** 'Hoy', 'Mañana', 'Ayer', 'El sábado 24', 'El sábado 7 de noviembre' */
export function relativeDay(d: DateStr, today: DateStr): string {
  const n = diffDays(d, today);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n > 1 && n < 7) return `El ${dayName(d)}`;
  const p = parts(d);
  const year = parts(today).y !== p.y ? ` de ${p.y}` : '';
  return `El ${dayName(d)} de ${MONTHS[p.m - 1]}${year}`;
}

/** Conjunción copulativa: 'e' delante de palabras que empiezan por sonido /i/ ("Lía e Iker"). */
function conj(next: string): string {
  const w = next.trim().toLocaleLowerCase('es-ES');
  if (/^[ií]/.test(w)) return 'e';
  if (/^h[ií]/.test(w) && !/^hi[aeiouáéó]/.test(w)) return 'e';
  return 'y';
}

/** ['a','b','c'] → 'a, b y c'; con `max`, 'a, b, c y 2 más'. */
export function listEs(items: string[], max = Infinity): string {
  const xs = items.filter(Boolean);
  if (xs.length > max) {
    const shown = xs.slice(0, max);
    return `${shown.join(', ')} y ${xs.length - max} más`;
  }
  if (xs.length <= 1) return xs[0] ?? '';
  const last = xs[xs.length - 1];
  return `${xs.slice(0, -1).join(', ')} ${conj(last)} ${last}`;
}

const euroFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
/** Céntimos → '45,90 €' */
export function euros(cents: number): string {
  return euroFmt.format(cents / 100);
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function memberNames(ids: string[] | undefined, members: Member[]): string {
  if (!ids?.length) return '';
  const byId = new Map(members.map((m) => [m.id, m.name]));
  return listEs(ids.map((id) => byId.get(id) ?? '').filter(Boolean));
}

// ---------- 1. recordatorios de eventos ----------

const validReminder = (m: unknown): m is number => typeof m === 'number' && Number.isFinite(m) && m >= 0;

/**
 * Instante en que salta el recordatorio de una repetición.
 * - Con hora: inicio − reminderMins. Los días completos se cuentan en hora de
 *   pared ("1 día antes" de las 10:00 es a las 10:00 aunque cambie la hora) y
 *   el resto en minutos reales (30 min antes son 30 min reales).
 * - Todo el día: relativo a las 09:00 en hora de pared, para que 780 sea
 *   siempre "20:00 del día anterior" aunque esa noche cambie la hora.
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

/** Días hacia delante que hay que expandir para cubrir el mayor recordatorio. */
export function reminderLookaheadDays(events: Pick<CalEvent, 'reminderMins'>[]): number {
  let max = 0;
  for (const e of events) if (validReminder(e.reminderMins)) max = Math.max(max, e.reminderMins);
  return Math.max(2, Math.ceil(max / 1440) + 1);
}

function reminderBody(o: Occurrence, today: DateStr, members: Member[]): string {
  const ev = o.event;
  let when = isTime(ev.startTime)
    ? `${relativeDay(o.date, today)} ${atTime(ev.startTime)}`
    : `${relativeDay(o.date, today)}, todo el día`;
  if (o.endDate > o.date) when += ` (hasta el ${dayName(o.endDate)})`;
  const bits = [when];
  const names = memberNames(ev.memberIds, members);
  if (names) bits.push(names);
  if (ev.location?.trim()) bits.push(ev.location.trim());
  return bits.join(' · ');
}

function eventReminders(
  events: CalEvent[], members: Member[], tz: string, today: DateStr,
  now: number, windowStart: number, sent: ReadonlySet<string>,
): OutMessage[] {
  const withRem = events.filter((e) => validReminder(e.reminderMins));
  if (!withRem.length) return [];
  const from = addDays(today, -1);
  const occs = expandEvents(withRem, from, addDays(today, reminderLookaheadDays(withRem)));
  const out: OutMessage[] = [];
  for (const o of occs) {
    if (o.date < from) continue; // evento de varios días que empezó antes: su aviso ya pasó
    const fireAt = reminderFireAt(o.event, o.date, tz);
    if (!(fireAt > windowStart && fireAt <= now)) continue;
    const key = `ev_${o.event.id}_${o.date}_${o.event.reminderMins}`;
    if (sent.has(key)) continue;
    out.push({
      key,
      kind: 'reminder',
      title: o.event.title?.trim() || 'Evento',
      body: reminderBody(o, today, members),
      url: URLS.calendar,
      tag: `ev_${o.event.id}_${o.date}`,
      urgency: 'high',
      toUids: 'all',
    });
  }
  return out;
}

// ---------- 4. fechas clave ----------

const KD_EMOJI: Record<KeyDateKind, string> = {
  birthday: '🎂', car: '🚗', insurance: '🛡️', bill: '🧾', health: '🩺', school: '🎒', other: '📌',
};
const KD_EXPIRES: ReadonlySet<string> = new Set(['car', 'insurance', 'bill']);

const kdEmoji = (kd: KeyDate) => KD_EMOJI[kd.kind] ?? KD_EMOJI.other;

/** Siguiente fecha (>= hoy). Los cumpleaños se repiten cada año aunque estén mal guardados. */
export function keyDateNext(kd: KeyDate, today: DateStr): DateStr | null {
  return nextKeyDate(kd.kind === 'birthday' ? { ...kd, repeat: 'yearly' } : kd, today);
}

/** Años que cumple en `d` (null si la fecha de nacimiento no tiene un año creíble). */
export function birthdayAge(kd: KeyDate, d: DateStr): number | null {
  const born = parts(kd.date).y;
  const age = parts(d).y - born;
  return born >= 1900 && age >= 1 && age < 130 ? age : null;
}

export function keyDateTitle(kd: KeyDate): string {
  const t = kd.title?.trim() || 'Fecha importante';
  if (kd.kind === 'birthday') return /^cumple/i.test(t) ? `🎂 ${t}` : `🎂 Cumpleaños de ${t}`;
  return `${kdEmoji(kd)} ${t}`;
}

export function keyDateBody(kd: KeyDate, d: DateStr, today: DateStr): string {
  const n = diffDays(d, today);
  if (kd.kind === 'birthday') {
    const age = birthdayAge(kd, d);
    const years = age != null ? `${age} ${plural(age, 'año', 'años')}` : null;
    if (n === 0) return years ? `¡Hoy cumple ${years}!` : '¡Hoy es su cumpleaños!';
    if (n === 1) return years ? `Mañana cumple ${years}` : 'Mañana es su cumpleaños';
    return years ? `Cumple ${years} en ${n} días (${shortDate(d, today)})` : `En ${n} días (${shortDate(d, today)})`;
  }
  const verb = KD_EXPIRES.has(kd.kind) ? 'Vence ' : '';
  let when: string;
  if (n === 0) when = verb ? 'hoy' : 'Hoy';
  else if (n === 1) when = verb ? 'mañana' : 'Mañana';
  else when = `${verb ? 'en' : 'En'} ${n} días (${shortDate(d, today)})`;
  let body = verb + when;
  if (typeof kd.amount === 'number' && kd.amount > 0) body += ` · ${euros(kd.amount)}`;
  return body;
}

function keyDateMessages(keyDates: KeyDate[], today: DateStr, hour: number, sent: ReadonlySet<string>): OutMessage[] {
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
        title: keyDateTitle(kd),
        body: keyDateBody(kd, d, today),
        url: URLS.dates,
        tag: `kd_${kd.id}_${d}`,
        urgency: 'normal',
        toUids: 'all',
      });
    }
  }
  return out;
}

// ---------- 3. resumen diario ----------

const MAX_DAILY_EVENTS = 6;
const MAX_TASK_TITLES = 3;

function greeting(hour: number): string {
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function dailySummary(
  input: Pick<ComputeInput, 'household' | 'events' | 'tasks' | 'menuToday' | 'keyDates' | 'now'>,
  sent: ReadonlySet<string> = new Set(),
): OutMessage | null {
  const { household, now } = input;
  if (!isDailyWindow(household, now)) return null;
  const tz = householdTz(household);
  const { date: today, hour } = zonedParts(now, tz);
  const key = dailyKey(today);
  if (sent.has(key)) return null;

  const lines: string[] = [];

  // Eventos de hoy: primero los de todo el día (o que vienen de días anteriores).
  const occs = expandEvents(input.events, today, today).filter((o) => occursOn(o, today));
  const rows = occs.map((o) => {
    const timed = isTime(o.event.startTime) && o.date === today;
    return { sort: timed ? o.event.startTime! : '', label: timed ? fmtTime(o.event.startTime!) : 'Todo el día', title: o.event.title?.trim() || 'Evento' };
  }).sort((a, b) => (a.sort === b.sort ? a.title.localeCompare(b.title, 'es') : a.sort < b.sort ? -1 : 1));
  for (const r of rows.slice(0, MAX_DAILY_EVENTS)) lines.push(`${r.label} · ${r.title}`);
  if (rows.length > MAX_DAILY_EVENTS) {
    const more = rows.length - MAX_DAILY_EVENTS;
    lines.push(`y ${more} ${plural(more, 'evento', 'eventos')} más`);
  }

  // Menú
  const menu = input.menuToday;
  const meal: string[] = [];
  if (menu?.lunch?.trim()) meal.push(`Comida: ${menu.lunch.trim()}`);
  if (menu?.dinner?.trim()) meal.push(`Cena: ${menu.dinner.trim()}`);
  if (meal.length) lines.push(`🍽️ ${meal.join(' · ')}`);

  // Tareas para hoy o atrasadas
  const due = input.tasks
    .filter((t) => !t.done && typeof t.due === 'string' && t.due <= today)
    .sort((a, b) => (a.due! === b.due! ? a.title.localeCompare(b.title, 'es') : a.due! < b.due! ? -1 : 1));
  if (due.length === 1) {
    lines.push(`✅ Tarea: ${due[0].title}${due[0].due! < today ? ' (atrasada)' : ''}`);
  } else if (due.length > 1) {
    const late = due.filter((t) => t.due! < today).length;
    const lateTxt = late ? ` (${late} ${plural(late, 'atrasada', 'atrasadas')})` : '';
    lines.push(`✅ ${due.length} tareas${lateTxt}: ${listEs(due.map((t) => t.title), MAX_TASK_TITLES)}`);
  }

  // Fechas clave de hoy
  for (const kd of input.keyDates) {
    if (keyDateNext(kd, today) !== today) continue;
    if (kd.kind === 'birthday') {
      const age = birthdayAge(kd, today);
      lines.push(`${keyDateTitle(kd)}${age != null ? ` (${age} ${plural(age, 'año', 'años')})` : ''}`);
    } else {
      let l = keyDateTitle(kd);
      if (KD_EXPIRES.has(kd.kind)) l += ' · vence hoy';
      if (typeof kd.amount === 'number' && kd.amount > 0) l += ` · ${euros(kd.amount)}`;
      lines.push(l);
    }
  }

  if (!lines.length) return null;
  return {
    key,
    kind: 'daily',
    title: `${greeting(hour)} · ${dayName(today)}`,
    body: lines.join('\n'),
    url: URLS.home,
    tag: key,
    urgency: 'normal',
    toUids: 'all',
  };
}

// ---------- 2. actividad ----------

const KIND_ORDER: ActivityKind[] = ['shopping', 'event', 'task', 'date', 'expense', 'note', 'menu'];
/** Pantalla de la app que abre cada tipo de actividad. */
const KIND_URL: Record<ActivityKind, string> = {
  shopping: URLS.shopping, event: URLS.calendar, task: URLS.tasks, date: URLS.dates,
  expense: URLS.expenses, note: URLS.notes, menu: URLS.menu,
};
const MAX_ACTIVITY_ITEMS = 8;

function activityLine(kind: string, texts: string[]): string {
  const n = texts.length;
  const list = listEs(texts, MAX_ACTIVITY_ITEMS);
  const withList = (label: string) => (n ? `${label}: ${list}` : label);
  switch (kind) {
    case 'shopping': return n ? `Ha añadido a la compra: ${list}` : 'Ha actualizado la compra';
    case 'event': return withList(plural(n, 'Nuevo evento', 'Nuevos eventos'));
    case 'task': return withList(plural(n, 'Nueva tarea', 'Nuevas tareas'));
    case 'note': return withList(plural(n, 'Nueva nota', 'Nuevas notas'));
    case 'expense': return withList(plural(n, 'Nuevo gasto', 'Nuevos gastos'));
    case 'date': return withList(plural(n, 'Nueva fecha', 'Nuevas fechas'));
    case 'menu': return 'Menú actualizado';
    default: return withList('Cambios');
  }
}

function activityDigest(activity: Activity[], now: number): OutMessage[] {
  const recent = activity
    .filter((a) => !a.notified && (a.createdAt ?? 0) >= now - ACTIVITY_MAX_AGE)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const byActor = new Map<string, Activity[]>();
  for (const a of recent) {
    const k = a.actorUid || '';
    byActor.set(k, [...(byActor.get(k) ?? []), a]);
  }
  const out: OutMessage[] = [];
  for (const [actorUid, items] of byActor) {
    // Agrupar por tipo y quitar repetidos (misma cosa añadida dos veces).
    const byKind = new Map<string, { texts: string[]; count: number }>();
    for (const a of items) {
      const g = byKind.get(a.kind) ?? { texts: [], count: 0 };
      g.count++;
      const t = (a.text ?? '').trim();
      if (t && !g.texts.some((x) => x.toLocaleLowerCase('es-ES') === t.toLocaleLowerCase('es-ES'))) g.texts.push(t);
      byKind.set(a.kind, g);
    }
    const order = (k: string) => { const i = KIND_ORDER.indexOf(k as ActivityKind); return i < 0 ? 99 : i; };
    const kinds = [...byKind.keys()].sort((a, b) => byKind.get(b)!.count - byKind.get(a)!.count || order(a) - order(b));
    const dominant = kinds[0] as ActivityKind;
    const last = items[items.length - 1];
    out.push({
      kind: 'activity',
      title: last.actorName?.trim() || 'Alguien de casa',
      body: kinds.map((k) => activityLine(k, byKind.get(k)!.texts)).join('\n'),
      url: KIND_URL[dominant] ?? URLS.home,
      tag: `act_${actorUid || 'anon'}_${last.createdAt ?? now}`,
      urgency: 'normal',
      toUids: actorUid ? { excludeUid: actorUid } : 'all',
    });
  }
  return out;
}

// ---------- entrada principal ----------

/**
 * Calcula las notificaciones de una casa para esta ejecución.
 * Las listas pueden venir prefiltradas (ver notify.ts): basta con que incluyan
 * los eventos que empiezan o caen en [hoy−1, hoy+N], los repetidos, las tareas
 * pendientes y todas las fechas clave.
 */
export function computeNotifications(input: ComputeInput): ComputeResult {
  const { household, now } = input;
  const sent: ReadonlySet<string> = input.sentKeys instanceof Set
    ? input.sentKeys
    : new Set(input.sentKeys ?? []);
  const tz = householdTz(household);
  const { date: today, hour } = zonedParts(now, tz);
  const settings = notifySettings(household);
  const members = household.members ?? [];

  const messages: OutMessage[] = [
    ...eventReminders(input.events, members, tz, today, now, reminderWindowStart(now, input.lastRunAt), sent),
    ...keyDateMessages(input.keyDates, today, hour, sent),
  ];
  const daily = dailySummary(input, sent);
  if (daily) messages.push(daily);
  if (settings.activity) messages.push(...activityDigest(input.activity, now));

  // Toda la actividad pendiente se marca (aunque el aviso esté desactivado o
  // sea antigua) para que no se acumule.
  const activityIdsToMark = input.activity.filter((a) => !a.notified).map((a) => a.id);
  return { messages, activityIdsToMark };
}

/** Dispositivos destinatarios de un mensaje (sin repetir endpoint). */
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

/** Lo que se envía al service worker. */
export function pushPayload(m: Pick<OutMessage, 'title' | 'body' | 'url' | 'tag'>): string {
  const body = m.body.length > 1500 ? `${m.body.slice(0, 1497)}…` : m.body;
  return JSON.stringify({ title: m.title, body, url: m.url, tag: m.tag });
}
