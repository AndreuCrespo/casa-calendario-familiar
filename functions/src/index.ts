// Cloud Functions de Casa (plan Blaze; a uso familiar entra en la capa gratuita).
//
// · notificationsTick   cada 5 min: recordatorios de eventos, resumen de la mañana
//                       y fechas clave (también recoge actividad que se escapara).
// · onActivityCreated   al momento: «Sam ha añadido a la compra: leche, pan…».
//
// Configuración (ver README):
//   firebase functions:secrets:set VAPID_PRIVATE_KEY
//   VAPID_PUBLIC_KEY y VAPID_SUBJECT se piden la primera vez en `firebase deploy`
//   y se guardan en functions/.env.<proyecto> (no se sube al repositorio).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { configureVapid, processActivity, processAllHouseholds } from './run';

/**
 * Región de la base de datos de Firestore: el disparador debe estar en la misma.
 * Si al crear Firestore elegiste otra ubicación, cámbiala aquí (p. ej. 'eur3' → 'europe-west1').
 */
const FIRESTORE_REGION = 'europe-southwest1';
/** Cloud Scheduler no está disponible en Madrid: la tarea programada va en Bélgica. */
const SCHEDULER_REGION = 'europe-west1';

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY', {
  description: 'Clave pública VAPID (la misma que VITE_VAPID_PUBLIC_KEY de la app)',
});
const VAPID_SUBJECT = defineString('VAPID_SUBJECT', {
  description: 'Contacto para los servicios push, p. ej. mailto:tu-correo@ejemplo.com',
});

initializeApp();
const db = getFirestore();

function vapid() {
  configureVapid({
    publicKey: VAPID_PUBLIC_KEY.value(),
    privateKey: VAPID_PRIVATE_KEY.value(),
    subject: VAPID_SUBJECT.value(),
  });
}

export const notificationsTick = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Madrid',
    region: SCHEDULER_REGION,
    secrets: [VAPID_PRIVATE_KEY],
    memory: '256MiB',
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    vapid();
    await processAllHouseholds(db);
  },
);

export const onActivityCreated = onDocumentCreated(
  {
    document: 'households/{hid}/activity/{activityId}',
    region: FIRESTORE_REGION,
    secrets: [VAPID_PRIVATE_KEY],
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 3,
  },
  async (event) => {
    vapid();
    const { hid, activityId } = event.params;
    // Espera unos segundos por si se añaden más cosas seguidas (un solo aviso).
    await processActivity(db, db.collection('households').doc(hid), activityId, 6_000);
  },
);
