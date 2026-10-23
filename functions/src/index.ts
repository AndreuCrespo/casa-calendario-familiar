// Casa's Cloud Functions (Blaze plan; family usage fits in the free tier).
//
// · notificationsTick   every 5 min: event reminders, morning summary and key
//                       dates (also picks up any activity that slipped through).
// · onActivityCreated   right away: "Sam added to the shopping list: milk, bread…".
//
// Each device gets its notifications in its own language (devices/{id}.lang).
//
// Configuration (see README):
//   firebase functions:secrets:set VAPID_PRIVATE_KEY
//   VAPID_PUBLIC_KEY and VAPID_SUBJECT are asked for on the first `firebase deploy`
//   and saved in functions/.env.<project> (not committed to the repository).
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { configureVapid, processActivity, processAllHouseholds } from './run';

/**
 * Region of the Firestore database: the trigger must be in the same one.
 * If you picked another location when creating Firestore, change it here (e.g. 'eur3' → 'europe-west1').
 */
const FIRESTORE_REGION = 'europe-southwest1';
/** Cloud Scheduler isn't available in Madrid: the scheduled job runs in Belgium. */
const SCHEDULER_REGION = 'europe-west1';

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY', {
  description: 'VAPID public key (the same as VITE_VAPID_PUBLIC_KEY in the app)',
});
const VAPID_SUBJECT = defineString('VAPID_SUBJECT', {
  description: 'Contact for the push services, e.g. mailto:you@example.com',
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
    // Wait a few seconds in case more things are added in a row (a single notification).
    await processActivity(db, db.collection('households').doc(hid), activityId, 6_000);
  },
);
