import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { resetAccountPrefs, startLibrarySync } from '@/features/library/cloudSync';
import { fetchAuthSettings, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useCardsStore } from '@/stores/cardsStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { isDefaultNickname, useProfileStore, type AuthMode } from '@/stores/profileStore';
import { resetSyncMeta } from '@/stores/syncMetaStore';

import {
  authPrefsHydrated,
  isAuthGateEnabled,
  isSessionAlive,
  markSessionAlive,
  rememberOAuthProvider,
  useAuthPrefs,
  useAuthStore,
} from './authStore';
import { startMailCooldown, type MailKind } from './cooldown';
import { LEGAL_VERSION } from './legal';
import { classifyAuthError, MAIL_COOLDOWN_SECONDS, normalizeEmail, retryAfterSeconds, signUpResponseKind, type AuthFailure } from './validation';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'kakao' | 'google';

/**
 * Where Supabase sends the user back to (must match Supabase → Authentication → URL Configuration → Redirect URLs):
 * OAuth → `auth/callback`, sign-up confirmation → `auth/confirmed` (shows the login screen), password reset → `auth/reset`.
 */
export function authRedirectUrl(path: 'auth/callback' | 'auth/confirmed' | 'auth/reset' = 'auth/callback') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/${path}`;
  return Linking.createURL(path);
}

function authModeOf(session: Session): AuthMode {
  const user = session.user;
  if (user.is_anonymous) return 'anonymous';
  const provider = user.app_metadata?.provider;
  return provider === 'kakao' || provider === 'google' ? provider : 'email';
}

function applySession(session: Session | null) {
  const { setAccount, setNickname, nickname } = useProfileStore.getState();
  if (!session) {
    setAccount({ authMode: 'guest', uid: null });
    return;
  }
  const meta = session.user.user_metadata ?? {};
  setAccount({
    authMode: authModeOf(session),
    uid: session.user.id,
    email: session.user.email ?? null,
    photoURL: (meta.avatar_url as string | undefined) ?? null,
  });
  const displayName = (meta.nickname ?? meta.name ?? meta.full_name) as string | undefined;
  if (displayName && isDefaultNickname(nickname)) setNickname(displayName);
}

/**
 * On-device records follow the account: guest / anonymous data (no owner) carries over into the account that signs in;
 * another account's data is dropped locally first (it is already on the server) so it never leaks into this account.
 */
function claimLocalData(uid: string) {
  const profile = useProfileStore.getState();
  if (profile.dataOwner === uid) return;
  if (profile.dataOwner) {
    useLibraryStore.getState().clearLocal();
    useCardsStore.getState().clearLocal();
    profile.resetIdentity();
    resetAccountPrefs();
  }
  resetSyncMeta();
  profile.setDataOwner(uid);
}

function webPath() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : '';
}

function onAuthRoute() {
  return webPath().startsWith('/auth/');
}

/** Mount once at the root: keeps the gate status, profile store and library sync in step with Supabase Auth. */
export function useAuthListener() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let syncedUser: string | null = null;
    let stopSync: (() => void) | null = null;
    let chain = Promise.resolve();
    const auth = useAuthStore.getState();

    // A slow token refresh must not leave the splash up forever; a late session flips the gate back.
    const fallback = setTimeout(() => {
      if (useAuthStore.getState().status === 'loading') auth.set({ status: 'signedOut' });
    }, 8000);

    const handle = async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        markSessionAlive();
        auth.set({ recovering: true });
      }
      const permanent = !!session && !session.user.is_anonymous;
      // The sign-up confirmation link may sign the browser in (same-browser PKCE exchange); the product wants the
      // login screen after confirming, so drop that session before it claims the device's records.
      if (permanent && isAuthGateEnabled && webPath() === '/auth/confirmed') {
        await sb.auth.signOut({ scope: 'local' });
        return; // SIGNED_OUT follows.
      }
      if (event === 'INITIAL_SESSION' && permanent && isAuthGateEnabled && !onAuthRoute()) {
        await authPrefsHydrated();
        if (!useAuthPrefs.getState().autoLogin && !isSessionAlive()) {
          await sb.auth.signOut({ scope: 'local' });
          return; // SIGNED_OUT follows.
        }
      }
      if (permanent && syncedUser && syncedUser !== session.user.id) {
        // Account changed without a sign-out in between: stop the old sync before the device data is handed over.
        stopSync?.();
        stopSync = null;
        syncedUser = null;
      }
      if (permanent) claimLocalData(session.user.id);
      applySession(session);
      const allowed = permanent || (!!session && !isAuthGateEnabled);
      clearTimeout(fallback);
      auth.set({
        status: allowed ? 'signedIn' : 'signedOut',
        hasAnonymousSession: !!session?.user.is_anonymous,
        ...(event === 'SIGNED_OUT' ? { recovering: false } : null),
      });
      const uid = allowed ? session!.user.id : null;
      if (uid === syncedUser) return;
      stopSync?.();
      stopSync = uid ? startLibrarySync(uid) : null;
      syncedUser = uid;
    };

    const { data } = sb.auth.onAuthStateChange((event, session) => {
      // Supabase warns against awaiting other client calls inside this callback; defer and serialize the work.
      setTimeout(() => {
        chain = chain.then(() => handle(event, session)).catch((err) => console.warn('[auth]', err));
      }, 0);
    });
    return () => {
      clearTimeout(fallback);
      stopSync?.();
      data.subscription.unsubscribe();
    };
  }, []);
}

/** `null` = success. */
export type AuthOutcome = AuthFailure | 'cancelled' | null;

async function providerDisabled(provider: OAuthProvider) {
  const settings = await fetchAuthSettings();
  return settings?.external?.[provider] === false;
}

async function signInWithProvider(provider: OAuthProvider): Promise<AuthOutcome> {
  const sb = getSupabase();
  if (!sb) return 'notConfigured';
  // Without this check the browser would land on Supabase's raw JSON error page.
  if (await providerDisabled(provider)) return 'providerDisabled';
  markSessionAlive();
  const redirectTo = authRedirectUrl();
  if (Platform.OS === 'web') {
    rememberOAuthProvider(provider);
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
    return null; // The browser navigates away and comes back to /auth/callback.
  }
  const { data, error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';
  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (!code) return oauthFailure(queryParams ?? {});
  const exchange = await sb.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
  return null;
}

/** Error query params Supabase appends to the redirect URL after a failed OAuth round trip. */
export function oauthFailure(params: Record<string, unknown>): AuthOutcome {
  const description = String(params.error_description ?? '').toLowerCase();
  if (description.includes('email')) return 'providerEmail';
  const failure = classifyAuthError({ code: String(params.error_code ?? ''), message: description });
  return failure === 'unknown' && params.error === 'access_denied' ? 'cancelled' : failure;
}

/** Signs in anonymously if needed and returns the current user id (sharing / watering / reviews / gallery). */
export async function ensureSession(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await sb.auth.signInAnonymously();
  if (res.error) throw res.error;
  return res.data.user?.id ?? null;
}

/** Locks the resend button: a full minute after a sent mail, or whatever Supabase says is left after a refusal. */
function lockAfterMail(kind: MailKind, email: string, error: unknown) {
  const wait = error ? retryAfterSeconds(error) : MAIL_COOLDOWN_SECONDS;
  if (wait) startMailCooldown(kind, email, wait);
}

export interface SignUpResult {
  failure: AuthOutcome;
  /** Supabase has e-mail confirmation on: no session yet, a confirmation mail was sent. */
  needsConfirmation?: boolean;
}

type Pending = 'kakao' | 'google' | 'email' | 'signUp' | 'resend' | 'reset' | 'password' | 'signOut';

export function useAuthActions() {
  const [pending, setPending] = useState<Pending | null>(null);

  const run = useCallback(async <T,>(kind: Pending, fn: () => Promise<T>, onError: (failure: AuthFailure) => T): Promise<T> => {
    if (!isSupabaseConfigured) return onError('notConfigured');
    setPending(kind);
    try {
      return await fn();
    } catch (err) {
      const failure = classifyAuthError(err);
      if (failure === 'unknown') console.warn('[auth]', err);
      return onError(failure);
    } finally {
      setPending(null);
    }
  }, []);

  const asOutcome = (failure: AuthFailure): AuthOutcome => failure;

  const signInKakao = useCallback(() => run('kakao', () => signInWithProvider('kakao'), asOutcome), [run]);
  const signInGoogle = useCallback(() => run('google', () => signInWithProvider('google'), asOutcome), [run]);

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      run(
        'email',
        async (): Promise<AuthOutcome> => {
          markSessionAlive();
          const { error } = await getSupabase()!.auth.signInWithPassword({ email: normalizeEmail(email), password });
          if (error) throw error;
          return null;
        },
        asOutcome,
      ),
    [run],
  );

  const signUpWithEmail = useCallback(
    (input: { email: string; password: string; nickname: string }) =>
      run(
        'signUp',
        async (): Promise<SignUpResult> => {
          markSessionAlive();
          const nickname = input.nickname.trim();
          const email = normalizeEmail(input.email);
          const agreedAt = new Date().toISOString();
          const { data, error } = await getSupabase()!.auth.signUp({
            email,
            password: input.password,
            options: {
              emailRedirectTo: authRedirectUrl('auth/confirmed'),
              data: { nickname, terms_agreed_at: agreedAt, privacy_agreed_at: agreedAt, legal_version: LEGAL_VERSION },
            },
          });
          if (error) throw error;
          const kind = signUpResponseKind(data);
          if (kind === 'exists') return { failure: 'userExists' };
          const { dataOwner, setNickname } = useProfileStore.getState();
          if (!dataOwner || dataOwner === data.user?.id) setNickname(nickname);
          if (kind === 'needsConfirmation') startMailCooldown('confirm', email, MAIL_COOLDOWN_SECONDS);
          return { failure: null, needsConfirmation: kind === 'needsConfirmation' };
        },
        (failure) => ({ failure }),
      ),
    [run],
  );

  const resendConfirmation = useCallback(
    (email: string) =>
      run(
        'resend',
        async (): Promise<AuthOutcome> => {
          const address = normalizeEmail(email);
          const { error } = await getSupabase()!.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: authRedirectUrl('auth/confirmed') } });
          lockAfterMail('confirm', address, error);
          if (error) throw error;
          return null;
        },
        asOutcome,
      ),
    [run],
  );

  const sendPasswordReset = useCallback(
    (email: string) =>
      run(
        'reset',
        async (): Promise<AuthOutcome> => {
          const address = normalizeEmail(email);
          const { error } = await getSupabase()!.auth.resetPasswordForEmail(address, { redirectTo: authRedirectUrl('auth/reset') });
          lockAfterMail('reset', address, error);
          if (error) throw error;
          return null;
        },
        asOutcome,
      ),
    [run],
  );

  const updatePassword = useCallback(
    (password: string) =>
      run(
        'password',
        async (): Promise<AuthOutcome> => {
          const { error } = await getSupabase()!.auth.updateUser({ password });
          if (error) throw error;
          useAuthStore.getState().set({ recovering: false });
          return null;
        },
        asOutcome,
      ),
    [run],
  );

  const signOut = useCallback(
    () =>
      run(
        'signOut',
        async (): Promise<AuthOutcome> => {
          const sb = getSupabase()!;
          const { error } = await sb.auth.signOut();
          if (error) {
            // e.g. offline: the server call failed and the session is kept — still sign out on this device.
            console.warn('[auth] sign-out', error);
            await sb.auth.signOut({ scope: 'local' });
          }
          return null;
        },
        asOutcome,
      ),
    [run],
  );

  return {
    isSupabaseConfigured,
    pending,
    signInKakao,
    signInGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
    signOut,
  };
}
