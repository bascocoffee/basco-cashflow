import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Firebase Configuration with .env override support
const activeFirebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || firebaseConfig.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseConfig.authDomain,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || firebaseConfig.projectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseConfig.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseConfig.messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || firebaseConfig.appId,
};

// Initialize Firebase App
const app = initializeApp(activeFirebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth Provider
export const provider = new GoogleAuthProvider();

// Request necessary scopes for Google Sheets and Google Drive
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({ prompt: 'select_account' });

// Cache the access token in memory & localStorage so sessions persist across reloads and roles
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem('aruskas_google_access_token');
  } catch {
    return null;
  }
})();
let isSigningIn = false;

// Initialize auth listener
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const storedToken = cachedAccessToken || localStorage.getItem('aruskas_google_access_token');
    if (user && storedToken) {
      cachedAccessToken = storedToken;
      onAuthSuccess(user, storedToken);
    } else if (!isSigningIn) {
      onAuthFailure();
    }
  });
};

// Handle Google Sign In
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google OAuth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem('aruskas_google_access_token', cachedAccessToken);
      const activeSheetId = localStorage.getItem('aruskas_sheet_id') || '1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc';
      const activeSheetName = localStorage.getItem('aruskas_sheet_name') || 'Dasbor Arus Kas Keuangan';
      const activeSheetUrl = localStorage.getItem('aruskas_sheet_url') || `https://docs.google.com/spreadsheets/d/${activeSheetId}/edit?gid=0#gid=0`;
      fetch('/api/auth/shared-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: cachedAccessToken,
          spreadsheetId: activeSheetId,
          spreadsheetName: activeSheetName,
          spreadsheetUrl: activeSheetUrl
        })
      }).catch(() => {});
    } catch {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve current cached access token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('aruskas_google_access_token');
};

// Handle Log Out
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
