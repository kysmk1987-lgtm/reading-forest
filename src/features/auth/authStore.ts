import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { isSupabaseConfigured } from '@/lib/supabase';
import { persistStorage } from '@/lib/storage';

/**
 * Login gate switch. Off when Supabase env vars are missing (local mode) or with EXPO_PUBLIC_AUTH_GATE=false
 * (dev / e2e bypass: the old flow where anonymous sessions use the app directly).
 */
export const isAuthGateEnabled = isSupabaseConfigured && process.env.EXPO_PUBLIC_AUTH_GATE !== 'false';

/**
 * - `loading`: waiting for the stored session (root layout keeps the splash up)
 * - `signedOut`: no session or only an anonymous one → (auth) screens
 * - `signedIn`: a real account (email / kakao / google), or any session when the gate is off
 * - `local`: Supabase not configured — the app runs on-device only
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'local';

interface AuthState {
  status: AuthStatus;
  /** An anonymous session from before the login gate exists (its on-device records carry over on sign-in). */
  hasAnonymousSession: boolean;
  /** Set by the PASSWORD_RECOVERY event (reset link opened) until a new password is saved. */
  recovering: boolean;
  set: (patch: Partial<Omit<AuthState, 'set'>>) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: isSupabaseConfigured ? 'loading' : 'local',
  hasAnonymousSession: false,
  recovering: false,
  set: (patch) => set(patch),
}));

/** True when the main app (tabs etc.) may be shown. */
export function canEnterApp(status: AuthStatus) {
  return status === 'signedIn' || status === 'local';
}

interface AuthPrefsState {
  rememberEmail: boolean;
  savedEmail: string;
  autoLogin: boolean;
  setPrefs: (patch: Partial<Pick<AuthPrefsState, 'rememberEmail' | 'savedEmail' | 'autoLogin'>>) => void;
}

/** 아이디(이메일) 저장 · 자동 로그인 (this device only). */
export const useAuthPrefs = create<AuthPrefsState>()(
  persist(
    (set) => ({
      rememberEmail: false,
      savedEmail: '',
      autoLogin: true,
      setPrefs: (patch) => set(patch),
    }),
    { name: 'rf-auth-prefs', storage: persistStorage },
  ),
);

export function authPrefsHydrated(): Promise<void> {
  if (useAuthPrefs.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useAuthPrefs.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

// 자동 로그인 off: a session only survives while the app / browser tab that signed in stays open.
const ALIVE_KEY = 'rf-auth-alive';
let aliveThisLaunch = false;

function webSessionStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Call right before a sign-in starts (OAuth on web reloads the tab, so the marker lives in sessionStorage). */
export function markSessionAlive() {
  aliveThisLaunch = true;
  webSessionStorage()?.setItem(ALIVE_KEY, '1');
}

export function isSessionAlive() {
  return aliveThisLaunch || webSessionStorage()?.getItem(ALIVE_KEY) === '1';
}

// Which OAuth provider the web redirect came back from (for the callback's error message).
const PROVIDER_KEY = 'rf-auth-provider';

export function rememberOAuthProvider(provider: 'kakao' | 'google') {
  webSessionStorage()?.setItem(PROVIDER_KEY, provider);
}

export function lastOAuthProvider(): 'kakao' | 'google' | undefined {
  const value = webSessionStorage()?.getItem(PROVIDER_KEY);
  return value === 'kakao' || value === 'google' ? value : undefined;
}
