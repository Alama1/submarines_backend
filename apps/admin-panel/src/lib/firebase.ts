import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    // Popups can be blocked in installed-PWA / standalone mode — fall back to a
    // full-page redirect. onAuthStateChanged fires after the redirect completes.
    const code = (err as { code?: string })?.code ?? '';
    if (
      code === 'auth/popup-blocked' ||
      ((code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') &&
        isStandalone())
    ) {
      await signInWithRedirect(auth, googleProvider);
      // Redirect navigates away; resolve with a never-settling promise so the
      // caller does not surface a spurious error while the page unloads.
      return new Promise<User>(() => {});
    }
    throw err;
  }
}

/** True when running as an installed PWA (standalone display). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Complete a redirect sign-in (must be called once on load). Returns the user
 * or null; surfaces redirect errors to the caller.
 */
export async function completeRedirectSignIn(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked') return null;
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { User };
