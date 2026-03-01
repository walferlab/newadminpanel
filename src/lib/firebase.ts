import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'

function envValue(key: string): string | undefined {
  const value = process.env[key]
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const projectId = envValue('NEXT_PUBLIC_FIREBASE_PROJECT_ID') ?? 'demo-project'

const rawFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: envValue('NEXT_PUBLIC_FIREBASE_API_KEY'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: envValue('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: envValue('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: envValue('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: envValue('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  NEXT_PUBLIC_FIREBASE_APP_ID: envValue('NEXT_PUBLIC_FIREBASE_APP_ID'),
}

const missingFirebaseEnv = Object.entries(rawFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key)

const firebaseConfig = {
  apiKey: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? projectId,
  storageBucket: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
  messagingSenderId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL:
    envValue('NEXT_PUBLIC_FIREBASE_DATABASE_URL') ?? `https://${projectId}-default-rtdb.firebaseio.com`,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const rtdb = getDatabase(app)
export const auth = getAuth(app)

let authPromise: Promise<void> | null = null

function assertFirebaseConfig() {
  if (missingFirebaseEnv.length > 0) {
    throw new Error(
      `Missing Firebase env vars: ${missingFirebaseEnv.join(', ')}. Set them in Vercel (Production scope) and redeploy.`,
    )
  }
}

export async function ensureFirebaseClientAuth() {
  if (typeof window === 'undefined') {
    return
  }

  assertFirebaseConfig()

  if (auth.currentUser) {
    return
  }

  if (!authPromise) {
    authPromise = signInAnonymously(auth)
      .then(() => undefined)
      .catch((error) => {
        authPromise = null
        throw error
      })
  }

  await authPromise
}

export function getFirebaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '')

    if (code.includes('permission-denied')) {
      return 'Firebase permission denied. Update Firestore rules or authenticate client users.'
    }

    if (code.includes('unauthenticated')) {
      return 'Firebase requires authentication. Enable anonymous sign-in in Firebase Auth.'
    }

    if (code.includes('operation-not-allowed')) {
      return 'Anonymous Firebase Auth is disabled. Enable it in Firebase Console > Authentication.'
    }

    if (code.includes('invalid-api-key')) {
      return 'Invalid Firebase API key. Check NEXT_PUBLIC_FIREBASE_API_KEY in Vercel (Production), remove key restrictions mismatch, and redeploy.'
    }

    if (code.includes('unavailable')) {
      return 'Firebase is temporarily unavailable. Please retry.'
    }

    return `Firebase error: ${code}`
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Firebase request failed.'
}
