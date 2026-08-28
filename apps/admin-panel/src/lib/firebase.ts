import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

export type AdminRuntimeConfig = {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
};

declare global {
  interface Window {
    __ADMIN_CONFIG__?: AdminRuntimeConfig;
  }
}

function readFirebaseConfig() {
  const runtime = typeof window !== 'undefined' ? window.__ADMIN_CONFIG__ ?? {} : {};
  return {
    apiKey: runtime.firebaseApiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: runtime.firebaseAuthDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: runtime.firebaseProjectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: runtime.firebaseStorageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: runtime.firebaseMessagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: runtime.firebaseAppId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  };
}

const firebaseConfig = readFirebaseConfig();

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        isFirebaseConfigured
          ? firebaseConfig
          : { apiKey: 'unconfigured', authDomain: 'localhost', projectId: 'unconfigured' },
      );
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase web config is missing. Set FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, and FIREBASE_APP_ID on the admin-panel container.',
    );
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { User };
