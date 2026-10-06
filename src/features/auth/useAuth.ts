import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { startLibrarySync } from '@/features/library/cloudSync';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { isDefaultNickname, useProfileStore, type AuthMode } from '@/stores/profileStore';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'kakao' | 'google';

/** Where OAuth providers send the user back to (must be listed in Supabase → Authentication → URL Configuration). */
export function authRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/auth/callback`;
  return Linking.createURL('auth/callback');
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

/** Mount once at the root: keeps the profile store + library sync in step with Supabase Auth (no-op when not configured). */
export function useAuthListener() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let syncedUser: string | null = null;
    let stopSync: (() => void) | null = null;
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      // Supabase warns against awaiting other client calls inside this callback; defer the work.
      setTimeout(() => {
        applySession(session);
        const uid = session?.user.id ?? null;
        if (uid === syncedUser) return;
        stopSync?.();
        stopSync = uid ? startLibrarySync(uid) : null;
        syncedUser = uid;
      }, 0);
    });
    return () => {
      stopSync?.();
      data.subscription.unsubscribe();
    };
  }, []);
}

export type AuthErrorCode = 'not-configured' | 'cancelled' | 'failed';

async function signInWithProvider(provider: OAuthProvider): Promise<AuthErrorCode | null> {
  const sb = getSupabase();
  if (!sb) return 'not-configured';
  const redirectTo = authRedirectUrl();
  if (Platform.OS === 'web') {
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
  if (!code) return 'failed';
  const exchange = await sb.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
  return null;
}

/** Signs in anonymously if needed and returns the current user id (for sharing / watering). */
export async function ensureSession(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await sb.auth.signInAnonymously();
  if (res.error) throw res.error;
  return res.data.user?.id ?? null;
}

export function useAuthActions() {
  const [pending, setPending] = useState<null | 'kakao' | 'google' | 'anonymous' | 'signOut'>(null);

  const run = useCallback(
    async (kind: NonNullable<typeof pending>, fn: () => Promise<AuthErrorCode | null | void>): Promise<AuthErrorCode | null> => {
      if (!isSupabaseConfigured) return 'not-configured';
      setPending(kind);
      try {
        return (await fn()) ?? null;
      } catch (err) {
        console.warn('[auth]', err);
        return 'failed';
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const signInKakao = useCallback(() => run('kakao', () => signInWithProvider('kakao')), [run]);
  const signInGoogle = useCallback(() => run('google', () => signInWithProvider('google')), [run]);
  const signInAnon = useCallback(
    () =>
      run('anonymous', async () => {
        await ensureSession();
      }),
    [run],
  );
  const signOut = useCallback(
    () =>
      run('signOut', async () => {
        const { error } = await getSupabase()!.auth.signOut();
        if (error) throw error;
      }),
    [run],
  );

  return { isSupabaseConfigured, pending, signInKakao, signInGoogle, signInAnon, signOut };
}
