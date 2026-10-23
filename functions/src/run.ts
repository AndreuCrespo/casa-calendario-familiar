// Firestore reads, Web Push delivery and state saving. The decision of what
// to notify lives in logic.ts (pure and tested).
import {
  type CollectionReference, type DocumentData, type DocumentReference,
  type Firestore, type Query, type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import webpush from 'web-push';
import type { Activity, CalEvent, Device, Household, KeyDate, Lang, MenuDay, Task } from '../../src/shared/types';
import { addDays, zonedParts, type DateStr } from '../../src/shared/dates';
import {
  DAY, KEYDATE_HOUR, MINUTE, activityDigest, computeNotifications, dailyKey, deviceLang, householdTz,
  isDailyWindow, notifySettings, pushPayload, selectDevices, type ComputeInput, type OutMessage,
} from './logic';
import { DEFAULT_LANG } from './i18n';

const TTL_SECONDS = 6 * 60 * 60;
const PUSH_TIMEOUT_MS = 15_000;
/** One-off events that are read: those starting in [today−1, today+14] (reminders up to ~2 weeks ahead). */
const EVENT_QUERY_DAYS = 14;
const NOTIFY_LOG_KEEP = 14 * DAY;
const ACTIVITY_KEEP = 7 * DAY;
const RECURRING_FREQS = ['daily', 'weekly', 'monthly', 'yearly'];
/** Whatever someone adds within this interval is grouped into a single notification. */
export const ACTIVITY_BURST = 10 * MINUTE;
/** The scheduled job only picks up activity that the instant function didn't notify. */
const ACTIVITY_FALLBACK_AGE = 3 * MINUTE;

// ---------- reading ----------

const withId = <T>(d: QueryDocumentSnapshot | { id: string; data(): DocumentData | undefined }): T =>
  ({ ...(d.data() ?? {}), id: d.id }) as T;

async function loadDocs<T>(q: Query): Promise<T[]> {
  return (await q.get()).docs.map((d) => withId<T>(d));
}

function asEvent(d: QueryDocumentSnapshot): CalEvent {
  const e = withId<CalEvent>(d);
  return { ...e, memberIds: Array.isArray(e.memberIds) ? e.memberIds : [], exdates: Array.isArray(e.exdates) ? e.exdates : [] };
}

/**
 * To avoid reading the whole collection on every run (Firestore free tier),
 * only these are read: events starting near today, all recurring ones and,
 * when the daily summary is due, multi-day events still in progress.
 */
async function loadEvents(col: CollectionReference, today: DateStr, withOngoing: boolean): Promise<CalEvent[]> {
  const queries: Query[] = [
    col.where('date', '>=', addDays(today, -1)).where('date', '<=', addDays(today, EVENT_QUERY_DAYS)),
    col.where('recurrence.freq', 'in', RECURRING_FREQS),
  ];
  if (withOngoing) queries.push(col.where('endDate', '>=', today));
  const byId = new Map<string, CalEvent>();
  for (const snap of await Promise.all(queries.map((q) => q.get()))) {
    for (const d of snap.docs) byId.set(d.id, asEvent(d));
  }
  return [...byId.values()];
}

function asActivity(a: Activity): Activity {
  // In case the app ever stored the date as a Timestamp instead of a number.
  const c = a.createdAt as unknown as { toMillis?: () => number } | number;
  return typeof c === 'object' && c?.toMillis ? { ...a, createdAt: c.toMillis() } : a;
}

async function existingKeys(db: Firestore, col: CollectionReference, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const snaps = await db.getAll(...keys.map((k) => col.doc(k)));
  return new Set(snaps.filter((s) => s.exists).map((s) => s.id));
}

// ---------- delivery ----------

export interface Vapid { publicKey: string; privateKey: string; subject: string }

export function configureVapid(v: Vapid) {
  webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
}

type SendOutcome = 'ok' | 'gone' | 'error';

async function sendOne(device: Device, m: OutMessage): Promise<SendOutcome> {
  try {
    await webpush.sendNotification(device.subscription, pushPayload(m), {
      TTL: TTL_SECONDS, urgency: m.urgency, timeout: PUSH_TIMEOUT_MS,
    });
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    console.warn(`Failed to send to device ${device.id}: ${status ?? ''} ${(e as Error).message ?? e}`.trim());
    return 'error';
  }
}

/**
 * The same messages worded in a given language. Must return the same list
 * (same order, keys, tags and audiences) for every language; only the text
 * changes. computeNotifications and activityDigest guarantee that.
 */
type Render = (lang: Lang) => OutMessage[];

/**
 * Sends each message to its devices, each device in its own language, and
 * deletes the devices that no longer exist. Messages are only rendered for
 * the languages that have devices (DEFAULT_LANG if there are none at all).
 *
 * A message counts as delivered (and its dedupe key is returned) unless every
 * target, across all languages, failed with a temporary error: then it's
 * retried on the next run.
 */
async function deliver(devicesCol: CollectionReference, devices: Device[], render: Render) {
  const rendered = new Map<Lang, OutMessage[]>();
  const inLang = (lang: Lang): OutMessage[] => {
    let ms = rendered.get(lang);
    if (!ms) rendered.set(lang, (ms = render(lang)));
    return ms;
  };
  // Canonical list (audiences and keys): any language present gives the same one.
  const messages = inLang(devices.length ? deviceLang(devices[0]) : DEFAULT_LANG);

  /** Message i in the device's language (the canonical one if, against the contract, they don't match). */
  const localized = (d: Device, i: number, m: OutMessage): OutMessage => {
    const local = inLang(deviceLang(d))[i];
    if (local?.tag === m.tag && local.key === m.key) return local;
    console.error(`Localized message mismatch (${deviceLang(d)}) for ${m.tag}`);
    return m;
  };

  const gone = new Set<string>();
  const delivered: OutMessage[] = [];
  const langs = new Set<Lang>();
  let sent = 0;
  let failed = 0;
  for (const [i, m] of messages.entries()) {
    const targets = selectDevices(devices, m.toUids).filter((d) => !gone.has(d.id));
    for (const d of targets) langs.add(deviceLang(d));
    const outcomes = await Promise.all(targets.map((d) => sendOne(d, localized(d, i, m))));
    let ok = 0;
    let err = 0;
    outcomes.forEach((o, j) => {
      if (o === 'ok') ok++;
      else if (o === 'gone') gone.add(targets[j].id);
      else err++;
    });
    sent += ok;
    failed += err;
    // If everything failed with temporary errors it's not considered sent: retried on the next run.
    if (ok > 0 || err === 0) delivered.push(m);
  }
  await Promise.all([...gone].map((id) => devicesCol.doc(id).delete()));
  return { delivered, sent, failed, gone: gone.size, langs: [...langs] };
}

// ---------- scheduled job: reminders, daily summary and key dates ----------

export async function processHousehold(db: Firestore, doc: QueryDocumentSnapshot, now: number) {
  const ref: DocumentReference = doc.ref;
  const household = withId<Household>(doc);
  const tz = householdTz(household);
  const { date: today, hour, time } = zonedParts(now, tz);
  const metaRef = ref.collection('meta').doc('notifier');
  const logCol = ref.collection('notifyLog');
  const activityCol = ref.collection('activity');
  const devicesCol = ref.collection('devices');

  const meta = await metaRef.get();
  const last = Number(meta.get('lastRunAt'));
  const lastRunAt = meta.exists && Number.isFinite(last) && last > 0 ? last : null;

  // Tasks, menu and long events are only needed when the daily summary is due.
  const needDaily = isDailyWindow(household, now) && !(await logCol.doc(dailyKey(today)).get()).exists;
  const needKeyDates = needDaily || hour >= KEYDATE_HOUR;

  const [events, tasks, menuToday, keyDates, pending] = await Promise.all([
    loadEvents(ref.collection('events'), today, needDaily),
    needDaily ? loadDocs<Task>(ref.collection('tasks').where('done', '==', false)) : Promise.resolve([]),
    needDaily
      ? ref.collection('menu').doc(today).get().then((s) => (s.exists ? withId<MenuDay>(s) : null))
      : Promise.resolve(null),
    needKeyDates ? loadDocs<KeyDate>(ref.collection('dates')) : Promise.resolve([]),
    loadDocs<Activity>(activityCol.where('notified', '==', false)).then((xs) => xs.map(asActivity)),
  ]);
  // Recent activity is notified right away by onActivityCreated; here only what it missed.
  const activity = pending.filter((a) => (a.createdAt ?? 0) < now - ACTIVITY_FALLBACK_AGE);

  const input: ComputeInput = { household, events, tasks, menuToday, keyDates, activity, now, lastRunAt, sentKeys: [] };
  // 1st pass without keys to know which ones to look up in notifyLog; 2nd with the ones already sent.
  // Keys don't depend on the language, so these passes use the default one.
  const draft = computeNotifications(input);
  const candidateKeys = [...new Set(draft.messages.flatMap((m) => (m.key ? [m.key] : [])))];
  const final: ComputeInput = { ...input, sentKeys: await existingKeys(db, logCol, candidateKeys) };
  const { messages, activityIdsToMark } = computeNotifications(final);

  const devices = messages.length ? await loadDocs<Device>(devicesCol) : [];
  const result = await deliver(devicesCol, devices,
    (lang) => (lang === DEFAULT_LANG ? messages : computeNotifications(final, lang).messages));

  // State and cleanup (activity older than 7 days and notification log older than 14).
  const [oldActivity, oldLog] = await Promise.all([
    activityCol.where('createdAt', '<', now - ACTIVITY_KEEP).select().get(),
    logCol.where('at', '<', now - NOTIFY_LOG_KEEP).select().get(),
  ]);
  const writer = db.bulkWriter();
  for (const k of new Set(result.delivered.flatMap((m) => (m.key ? [m.key] : [])))) writer.set(logCol.doc(k), { at: now });
  const deleted = new Set(oldActivity.docs.map((d) => d.id));
  for (const id of activityIdsToMark) if (!deleted.has(id)) writer.update(activityCol.doc(id), { notified: true });
  for (const d of [...oldActivity.docs, ...oldLog.docs]) writer.delete(d.ref);
  writer.set(metaRef, { lastRunAt: now }, { merge: true });
  await writer.close();

  if (messages.length) {
    const kinds = messages.map((m) => m.kind).join(',');
    console.log(`Household ${doc.id} · ${time} ${tz} · messages ${kinds} · sent ${result.sent}` +
      (result.langs.length ? ` (${result.langs.join(',')})` : '') +
      (result.failed ? ` · failed ${result.failed}` : '') + (result.gone ? ` · expired ${result.gone}` : ''));
  }
}

export async function processAllHouseholds(db: Firestore, now = Date.now()) {
  const households = await db.collection('households').get();
  let failed = 0;
  for (const doc of households.docs) {
    try {
      await processHousehold(db, doc, now);
    } catch (e) {
      failed++;
      console.error(`Household ${doc.id}: ${(e as Error).stack ?? e}`);
    }
  }
  if (failed) throw new Error(`${failed} household(s) failed`);
}

// ---------- instant: "Sam added milk to the shopping list" ----------

/**
 * Called when an activity document is created. If another one from the same
 * person arrives within a few seconds, that one is left to notify (so "milk,
 * bread, eggs" added in a row arrive as a single notification).
 */
export async function processActivity(db: Firestore, householdRef: DocumentReference, activityId: string, debounceMs: number) {
  if (debounceMs > 0) await new Promise((r) => setTimeout(r, debounceMs));
  const now = Date.now();
  const activityCol = householdRef.collection('activity');

  const [hSnap, me] = await Promise.all([householdRef.get(), activityCol.doc(activityId).get()]);
  if (!hSnap.exists || !me.exists) return;
  const mine = asActivity(withId<Activity>(me));
  if (mine.notified) return; // another run already notified it

  const recent = (await loadDocs<Activity>(activityCol.where('createdAt', '>=', now - ACTIVITY_BURST)))
    .map(asActivity)
    .filter((a) => a.actorUid === mine.actorUid)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const latest = recent[recent.length - 1];
  if (latest && latest.id !== mine.id && !latest.notified) return; // there's a newer one: let it notify

  const pending = recent.filter((a) => !a.notified);
  const household = withId<Household>(hSnap);
  if (notifySettings(household).activity && pending.length) {
    // Rebuilt with the whole burst so the new notification replaces the previous one.
    const devicesCol = householdRef.collection('devices');
    const devices = await loadDocs<Device>(devicesCol);
    await deliver(devicesCol, devices, (lang) => activityDigest(recent, now, { includeNotified: true }, lang));
  }
  // Marked once, whatever the languages.
  const batch = db.batch();
  for (const a of pending) batch.update(activityCol.doc(a.id), { notified: true });
  await batch.commit();
}
