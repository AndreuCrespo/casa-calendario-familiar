// Firebase setup. Without configuration (no .env.local) the app runs in demo mode.
import { initializeApp } from 'firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  type Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getLang, onLangChange } from '../i18n';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export interface FirebaseServices {
  auth: Auth;
  db: Firestore;
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId);

let services: FirebaseServices | null = null;

/** Firebase Auth and Firestore. Only call when `firebaseEnabled`. */
export function firebase(): FirebaseServices {
  if (services) return services;
  if (!firebaseEnabled) throw new Error('Firebase is not configured');
  const app = initializeApp(config);
  // Without a popup/redirect resolver here: the sign-in screen passes one, so
  // that code is only loaded there.
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  // Sign-in emails and Google's screens in the app's language.
  auth.languageCode = getLang();
  onLangChange(() => {
    auth.languageCode = getLang();
  });
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  // `npm run dev:emulators`: local Auth and Firestore with the real rules.
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  services = { auth, db };
  return services;
}
