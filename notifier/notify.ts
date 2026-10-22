// Notificador de Casa. Se ejecuta cada ~10 min desde GitHub Actions:
// recorre todas las casas de Firestore (Admin SDK), calcula qué avisar con la
// lógica pura de logic.ts, lo envía por Web Push (VAPID) y guarda el estado.
//
// Variables de entorno (también se leen de notifier/.env si existe):
//   FIREBASE_SERVICE_ACCOUNT  JSON completo de la clave de una cuenta de servicio
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (p. ej. mailto:alguien@ejemplo.com)
//   DRY_RUN=1                 solo muestra lo que mandaría (no envía ni escribe nada;
//                             en este modo las claves VAPID son opcionales)
//   NOW=2026-10-22T08:05:00+02:00   (solo con DRY_RUN) simula otro instante
//
// OJO: en un repositorio público los registros de Actions son públicos, así que
// en modo normal solo se registran identificadores y recuentos, nunca textos.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import {
  getFirestore, type CollectionReference, type DocumentData, type DocumentReference,
  type Firestore, type Query, type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import webpush from 'web-push';
import type { Activity, CalEvent, Device, Household, KeyDate, MenuDay, Task } from '../src/shared/types';
import { addDays, zonedParts, type DateStr } from '../src/shared/dates';
import {
  DAY, KEYDATE_HOUR, computeNotifications, dailyKey, householdTz, isDailyWindow, pushPayload, selectDevices,
  type Audience, type ComputeInput, type OutMessage,
} from './logic';

const TTL_SECONDS = 6 * 60 * 60;
const PUSH_TIMEOUT_MS = 15_000;
/** Eventos sueltos que se leen: los que empiezan en [hoy−1, hoy+14] (avisos de hasta ~2 semanas). */
const EVENT_QUERY_DAYS = 14;
const NOTIFY_LOG_KEEP = 14 * DAY;
const ACTIVITY_KEEP = 7 * DAY;
const RECURRING_FREQS = ['daily', 'weekly', 'monthly', 'yearly'];
const GRPC_NOT_FOUND = 5;

/** Error de BulkWriter (firebase-admin no reexporta su tipo). */
interface BulkWriterError extends Error { code: number; failedAttempts: number }

// ---------- configuración ----------

export interface Config {
  serviceAccount: { project_id: string; client_email: string; private_key: string };
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  dryRun: boolean;
  now: number;
}

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function loadConfig(): Config {
  const envFile = fileURLToPath(new URL('./.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const env = (k: string) => process.env[k]?.trim() ?? '';

  const dryRun = /^(1|true|yes|s[ií])$/i.test(env('DRY_RUN'));
  const required = ['FIREBASE_SERVICE_ACCOUNT', ...(dryRun ? [] : ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])];
  const missing = required.filter((k) => !env(k));
  if (missing.length) {
    fail(`Faltan variables de entorno: ${missing.join(', ')}.\n` +
      '  En GitHub: Settings → Secrets and variables → Actions → New repository secret.\n' +
      '  En local: crea notifier/.env (no lo subas) o expórtalas antes de "npm start".\n' +
      '  Las claves VAPID se generan con "npm run vapid".');
  }

  // Cuenta de servicio: JSON tal cual (o en base64, por si acaso).
  let raw = env('FIREBASE_SERVICE_ACCOUNT');
  if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8').trim();
  let sa: Record<string, unknown>;
  try {
    sa = JSON.parse(raw);
  } catch {
    fail('FIREBASE_SERVICE_ACCOUNT no es un JSON válido: pega el contenido completo del archivo .json de la clave ' +
      '(Consola de Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada).');
  }
  for (const k of ['project_id', 'client_email', 'private_key']) {
    if (typeof sa[k] !== 'string' || !sa[k]) fail(`FIREBASE_SERVICE_ACCOUNT no tiene "${k}". ¿Es una clave de cuenta de servicio?`);
  }
  const serviceAccount = {
    project_id: sa.project_id as string,
    client_email: sa.client_email as string,
    private_key: (sa.private_key as string).replace(/\\n/g, '\n'),
  };

  let vapid: Config['vapid'] = null;
  if (env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY') && env('VAPID_SUBJECT')) {
    vapid = { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') };
    try {
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    } catch (e) {
      fail(`Claves VAPID no válidas: ${(e as Error).message}\n` +
        '  VAPID_SUBJECT debe ser "mailto:tu@correo" o una URL https://, y las claves las de "npm run vapid".');
    }
  }

  let now = Date.now();
  if (env('NOW')) {
    if (!dryRun) fail('NOW solo se puede usar junto con DRY_RUN=1.');
    now = Date.parse(env('NOW'));
    if (!Number.isFinite(now)) fail(`NOW no es una fecha válida: ${env('NOW')}`);
  }
  return { serviceAccount, vapid, dryRun, now };
}

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
 * Para no leer toda la colección cada 10 minutos (cuota gratuita de Firestore),
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

type SendOutcome = 'ok' | 'gone' | 'error';

const endpointHost = (ep: string) => { try { return new URL(ep).host; } catch { return '?'; } };

async function sendOne(device: Device, m: OutMessage): Promise<SendOutcome> {
  try {
    await webpush.sendNotification(device.subscription, pushPayload(m), {
      TTL: TTL_SECONDS, urgency: m.urgency, timeout: PUSH_TIMEOUT_MS,
    });
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    console.warn(`  ! Fallo al enviar al dispositivo ${device.id} (${endpointHost(device.subscription.endpoint)}): ` +
      `${status ?? ''} ${(e as Error).message ?? e}`.trim());
    return 'error';
  }
}

const audienceText = (a: Audience) => (a === 'all' ? 'todos' : `todos menos uid ${a.excludeUid}`);

// ---------- una casa ----------

interface Stats { messages: number; sent: number; failed: number; gone: number; marked: number }

export async function processHousehold(db: Firestore, doc: QueryDocumentSnapshot, cfg: Config): Promise<Stats> {
  const { now, dryRun } = cfg;
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

  const [events, tasks, menuToday, keyDates, activity] = await Promise.all([
    loadEvents(ref.collection('events'), today, needDaily),
    needDaily ? loadDocs<Task>(ref.collection('tasks').where('done', '==', false)) : Promise.resolve([]),
    needDaily
      ? ref.collection('menu').doc(today).get().then((s) => (s.exists ? withId<MenuDay>(s) : null))
      : Promise.resolve(null),
    needKeyDates ? loadDocs<KeyDate>(ref.collection('dates')) : Promise.resolve([]),
    loadDocs<Activity>(activityCol.where('notified', '==', false)).then((xs) => xs.map(asActivity)),
  ]);

  const input: ComputeInput = { household, events, tasks, menuToday, keyDates, activity, now, lastRunAt, sentKeys: [] };
  // 1ª pasada sin claves para saber cuáles consultar en notifyLog; 2ª ya con las enviadas.
  const draft = computeNotifications(input);
  const candidateKeys = [...new Set(draft.messages.flatMap((m) => (m.key ? [m.key] : [])))];
  const sentKeys = await existingKeys(db, logCol, candidateKeys);
  const { messages, activityIdsToMark } = computeNotifications({ ...input, sentKeys });

  const stats: Stats = { messages: messages.length, sent: 0, failed: 0, gone: 0, marked: 0 };
  const label = `Casa ${doc.id}`;
  const devices = messages.length ? await loadDocs<Device>(devicesCol) : [];

  if (dryRun) {
    console.log(`\n── ${label} «${household.name ?? ''}» · ${today} ${time} ${tz} · última ejecución: ` +
      `${lastRunAt ? new Date(lastRunAt).toISOString() : 'nunca'} · ${devices.length} dispositivos`);
    for (const m of messages) {
      const n = selectDevices(devices, m.toUids).length;
      console.log(`  [${m.kind}] ${m.key ?? '(sin clave)'} → ${audienceText(m.toUids)} (${n} disp.) · ${m.urgency} · ${m.url} · tag=${m.tag}`);
      console.log(`    ${m.title}`);
      for (const line of m.body.split('\n')) console.log(`    │ ${line}`);
    }
    if (!messages.length) console.log('  (nada que enviar)');
    if (activityIdsToMark.length) console.log(`  marcaría ${activityIdsToMark.length} actividades como notificadas`);
    stats.marked = activityIdsToMark.length;
    return stats;
  }

  if (!cfg.vapid) throw new Error('Faltan las claves VAPID');

  // Enviar
  const gone = new Set<string>();
  const keysToLog: string[] = [];
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
    stats.sent += ok;
    stats.failed += err;
    // Si todo fueron errores temporales, no se apunta: se reintentará en la próxima ejecución
    // (resumen y fechas clave; los recordatorios solo dentro de su ventana).
    if (m.key && (ok > 0 || err === 0)) keysToLog.push(m.key);
  }
  stats.gone = gone.size;

  // Mantenimiento: actividad antigua y registro de avisos de hace más de 14 días.
  const [oldActivity, oldLog] = await Promise.all([
    activityCol.where('createdAt', '<', now - ACTIVITY_KEEP).select().get(),
    logCol.where('at', '<', now - NOTIFY_LOG_KEEP).select().get(),
  ]);
  const deletedActivity = new Set(oldActivity.docs.map((d) => d.id));
  const toMark = activityIdsToMark.filter((id) => !deletedActivity.has(id));
  stats.marked = toMark.length;

  // Escrituras en bloque (BulkWriter agrupa en lotes y reintenta errores temporales).
  const writer = db.bulkWriter();
  writer.onWriteError((e: BulkWriterError) => e.code !== GRPC_NOT_FOUND && e.failedAttempts < 5);
  const writeErrors: string[] = [];
  const pending: Promise<unknown>[] = [];
  const track = (p: Promise<unknown>, what: string) => pending.push(p.catch((e: BulkWriterError) => {
    if (e.code !== GRPC_NOT_FOUND) writeErrors.push(`${what}: ${e.message}`);
  }));
  for (const k of new Set(keysToLog)) track(writer.set(logCol.doc(k), { at: now }), `notifyLog/${k}`);
  for (const id of toMark) track(writer.update(activityCol.doc(id), { notified: true }), `activity/${id}`);
  for (const d of oldActivity.docs) track(writer.delete(d.ref), `borrar activity/${d.id}`);
  for (const d of oldLog.docs) track(writer.delete(d.ref), `borrar notifyLog/${d.id}`);
  for (const id of gone) track(writer.delete(devicesCol.doc(id)), `borrar devices/${id}`);
  track(writer.set(metaRef, { lastRunAt: now }, { merge: true }), 'meta/notifier');
  await writer.close();
  await Promise.all(pending);
  if (writeErrors.length) throw new Error(`Errores al guardar el estado:\n  ${writeErrors.join('\n  ')}`);

  const kinds = messages.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.kind]: (acc[m.kind] ?? 0) + 1 }), {});
  const kindsTxt = Object.entries(kinds).map(([k, n]) => `${k}:${n}`).join(' ') || '-';
  console.log(`${label} · ${time} ${tz} · avisos ${kindsTxt} · enviados ${stats.sent}` +
    (stats.failed ? ` · fallidos ${stats.failed}` : '') +
    (stats.gone ? ` · dispositivos caducados borrados ${stats.gone}` : '') +
    (stats.marked ? ` · actividad marcada ${stats.marked}` : '') +
    (oldActivity.size || oldLog.size ? ` · limpieza ${oldActivity.size + oldLog.size}` : ''));
  return stats;
}

// ---------- principal ----------

async function main(): Promise<number> {
  const cfg = loadConfig();
  const sa = cfg.serviceAccount;
  initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
    projectId: sa.project_id,
  });
  const db = getFirestore();
  console.log(`Notificador de Casa · ${new Date(cfg.now).toISOString()}${cfg.dryRun ? ' · DRY_RUN (no envía ni escribe)' : ''}`);

  let failed = 0;
  try {
    const households = await db.collection('households').get();
    console.log(`${households.size} casa(s)`);
    for (const doc of households.docs) {
      try {
        await processHousehold(db, doc, cfg);
      } catch (e) {
        failed++;
        console.error(`✖ Casa ${doc.id}: ${(e as Error).stack ?? e}`);
      }
    }
  } finally {
    await db.terminate().catch(() => {});
  }
  return failed ? 1 : 0;
}

// Solo se ejecuta al lanzarlo directamente (no al importarlo desde otro script).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error('✖', (e as Error).stack ?? e);
      const code = (e as { code?: number }).code;
      if (code === 16 || code === 7) {
        console.error('  → Revisa FIREBASE_SERVICE_ACCOUNT: debe ser una clave válida del proyecto con acceso a Firestore.');
      }
      process.exit(1);
    },
  );
}
