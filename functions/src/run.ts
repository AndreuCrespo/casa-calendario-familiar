// Lectura de Firestore, envío Web Push y guardado del estado. La decisión de
// qué avisar está en logic.ts (pura y con tests).
import {
  type CollectionReference, type DocumentData, type DocumentReference,
  type Firestore, type Query, type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import webpush from 'web-push';
import type { Activity, CalEvent, Device, Household, KeyDate, MenuDay, Task } from '../../src/shared/types';
import { addDays, zonedParts, type DateStr } from '../../src/shared/dates';
import {
  DAY, KEYDATE_HOUR, MINUTE, activityDigest, computeNotifications, dailyKey, householdTz, isDailyWindow,
  notifySettings, pushPayload, selectDevices, type ComputeInput, type OutMessage,
} from './logic';

const TTL_SECONDS = 6 * 60 * 60;
const PUSH_TIMEOUT_MS = 15_000;
/** Eventos sueltos que se leen: los que empiezan en [hoy−1, hoy+14] (avisos de hasta ~2 semanas). */
const EVENT_QUERY_DAYS = 14;
const NOTIFY_LOG_KEEP = 14 * DAY;
const ACTIVITY_KEEP = 7 * DAY;
const RECURRING_FREQS = ['daily', 'weekly', 'monthly', 'yearly'];
/** Lo que alguien añade en este intervalo se agrupa en un solo aviso. */
export const ACTIVITY_BURST = 10 * MINUTE;
/** La tarea programada solo recoge actividad que la función instantánea no avisó. */
const ACTIVITY_FALLBACK_AGE = 3 * MINUTE;

// ---------- lectura ----------

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
 * Para no leer toda la colección en cada ejecución (cuota gratuita de Firestore),
 * solo se leen: los eventos que empiezan cerca de hoy, todos los repetidos y,
 * si toca resumen diario, los de varios días que siguen en curso.
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
  // Por si la app guardara la fecha como Timestamp en vez de número.
  const c = a.createdAt as unknown as { toMillis?: () => number } | number;
  return typeof c === 'object' && c?.toMillis ? { ...a, createdAt: c.toMillis() } : a;
}

async function existingKeys(db: Firestore, col: CollectionReference, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const snaps = await db.getAll(...keys.map((k) => col.doc(k)));
  return new Set(snaps.filter((s) => s.exists).map((s) => s.id));
}

// ---------- envío ----------

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
    console.warn(`Fallo al enviar al dispositivo ${device.id}: ${status ?? ''} ${(e as Error).message ?? e}`.trim());
    return 'error';
  }
}

/** Envía cada mensaje a sus dispositivos y borra los que ya no existen. */
async function deliver(devicesCol: CollectionReference, devices: Device[], messages: OutMessage[]) {
  const gone = new Set<string>();
  const delivered: OutMessage[] = [];
  let sent = 0;
  let failed = 0;
  for (const m of messages) {
    const targets = selectDevices(devices, m.toUids).filter((d) => !gone.has(d.id));
    const outcomes = await Promise.all(targets.map((d) => sendOne(d, m)));
    let ok = 0;
    let err = 0;
    outcomes.forEach((o, i) => {
      if (o === 'ok') ok++;
      else if (o === 'gone') gone.add(targets[i].id);
      else err++;
    });
    sent += ok;
    failed += err;
    // Si todo fueron errores temporales no se da por enviado: se reintenta en la próxima ejecución.
    if (ok > 0 || err === 0) delivered.push(m);
  }
  await Promise.all([...gone].map((id) => devicesCol.doc(id).delete()));
  return { delivered, sent, failed, gone: gone.size };
}

// ---------- tarea programada: recordatorios, resumen diario y fechas ----------

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

  // Tareas, menú y eventos largos solo hacen falta si toca el resumen diario.
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
  // La actividad reciente la avisa onActivityCreated al momento; aquí solo lo que se le escapó.
  const activity = pending.filter((a) => (a.createdAt ?? 0) < now - ACTIVITY_FALLBACK_AGE);

  const input: ComputeInput = { household, events, tasks, menuToday, keyDates, activity, now, lastRunAt, sentKeys: [] };
  // 1ª pasada sin claves para saber cuáles consultar en notifyLog; 2ª ya con las enviadas.
  const draft = computeNotifications(input);
  const candidateKeys = [...new Set(draft.messages.flatMap((m) => (m.key ? [m.key] : [])))];
  const sentKeys = await existingKeys(db, logCol, candidateKeys);
  const { messages, activityIdsToMark } = computeNotifications({ ...input, sentKeys });

  const devices = messages.length ? await loadDocs<Device>(devicesCol) : [];
  const result = await deliver(devicesCol, devices, messages);

  // Estado y limpieza (actividad de hace más de 7 días y registro de avisos de más de 14).
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
    console.log(`Casa ${doc.id} · ${time} ${tz} · avisos ${kinds} · enviados ${result.sent}` +
      (result.failed ? ` · fallidos ${result.failed}` : '') + (result.gone ? ` · caducados ${result.gone}` : ''));
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
      console.error(`Casa ${doc.id}: ${(e as Error).stack ?? e}`);
    }
  }
  if (failed) throw new Error(`${failed} casa(s) con errores`);
}

// ---------- al momento: "Sam ha añadido leche a la compra" ----------

/**
 * Se llama al crearse un documento de actividad. Si en unos segundos llega otro
 * de la misma persona, se deja que lo avise ese (así «leche, pan, huevos»
 * añadidos seguidos llegan en un único aviso).
 */
export async function processActivity(db: Firestore, householdRef: DocumentReference, activityId: string, debounceMs: number) {
  if (debounceMs > 0) await new Promise((r) => setTimeout(r, debounceMs));
  const now = Date.now();
  const activityCol = householdRef.collection('activity');

  const [hSnap, me] = await Promise.all([householdRef.get(), activityCol.doc(activityId).get()]);
  if (!hSnap.exists || !me.exists) return;
  const mine = asActivity(withId<Activity>(me));
  if (mine.notified) return; // ya lo avisó otra ejecución

  const recent = (await loadDocs<Activity>(activityCol.where('createdAt', '>=', now - ACTIVITY_BURST)))
    .map(asActivity)
    .filter((a) => a.actorUid === mine.actorUid)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const latest = recent[recent.length - 1];
  if (latest && latest.id !== mine.id && !latest.notified) return; // hay uno más nuevo: que avise él

  const pending = recent.filter((a) => !a.notified);
  const household = withId<Household>(hSnap);
  if (notifySettings(household).activity && pending.length) {
    // Se reconstruye con toda la ráfaga para que el aviso nuevo sustituya al anterior.
    const messages = activityDigest(recent, now, { includeNotified: true });
    const devicesCol = householdRef.collection('devices');
    const devices = await loadDocs<Device>(devicesCol);
    await deliver(devicesCol, devices, messages);
  }
  const batch = db.batch();
  for (const a of pending) batch.update(activityCol.doc(a.id), { notified: true });
  await batch.commit();
}
