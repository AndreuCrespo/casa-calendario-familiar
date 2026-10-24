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
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { configureVapid } from './push';
import { processActivity, processAllHouseholds } from './run';

/**
 * Region of the Firestore database: the trigger must be in the same one.
 * If you picked another location when creating Firestore, change it here (e.g. 'eur3' → 'europe-west1').
 */
const FIRESTORE_REGION = 'europe-southwest1';
/** Cloud Scheduler isn't available in Madrid: the scheduled job runs in Belgium. */
const SCHEDULER_REGION = 'europe-west1';
/** How long to wait for more activity from the same person before notifying. */
const ACTIVITY_DEBOUNCE_MS = 6_000;

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY', {
  description: 'VAPID public key (the same as VITE_VAPID_PUBLIC_KEY in the app)',
});
const VAPID_SUBJECT = defineString('VAPID_SUBJECT', {
  description: 'Contact for the push services, e.g. mailto:you@example.com',
});

initializeApp();
const db = getFirestore();

let vapidReady = false;
function useVapid() {
  if (vapidReady) return;
  configureVapid({
    publicKey: VAPID_PUBLIC_KEY.value(),
    privateKey: VAPID_PRIVATE_KEY.value(),
    subject: VAPID_SUBJECT.value(),
  });
  vapidReady = true;
}

export const notificationsTick = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Madrid', // irrelevant for an interval; each household uses its own zone
    region: SCHEDULER_REGION,
    secrets: [VAPID_PRIVATE_KEY],
    memory: '256MiB',
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 0, // the next run catches up
  },
  async () => {
    useVapid();
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
    // Only the latest activity of a burst waits; the rest return at once.
    maxInstances: 5,
  },
  async (event) => {
    useVapid();
    const { hid, activityId } = event.params;
    await processActivity(db, db.collection('households').doc(hid), activityId, {
      createTime: event.data?.createTime.toMillis() ?? Date.now(),
      debounceMs: ACTIVITY_DEBOUNCE_MS,
    });
  },
);
