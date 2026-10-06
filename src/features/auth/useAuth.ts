import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { startLibrarySync } from '@/features/library/cloudSync';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import { isDefaultNickname, useProfileStore } from '@/stores/profileStore';

/** Mount once at the root: keeps the profile store in sync with Firebase Auth (no-op when not configured). */
export function useAuthListener() {
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return;
    let stopSync: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(fb.auth, (user) => {
      stopSync?.();
      stopSync = null;
      const { setAccount, setNickname, nickname } = useProfileStore.getState();
      if (!user) {
        setAccount({ authMode: 'guest', uid: null });
        return;
      }
      setAccount({
        authMode: user.isAnonymous ? 'anonymous' : 'google',
        uid: user.uid,
        email: user.email,
        photoURL: user.photoURL,
      });
      if (user.displayName && isDefaultNickname(nickname)) setNickname(user.displayName);
      stopSync = startLibrarySync(user.uid);
    });
    return () => {
      stopSync?.();
      unsubscribe();
    };
  }, []);
}

export type AuthErrorCode = 'not-configured' | 'native-google-unsupported' | 'failed';

export function useAuthActions() {
  const [pending, setPending] = useState(false);

  const run = useCallback(async (fn: () => Promise<unknown>): Promise<AuthErrorCode | null> => {
    setPending(true);
    try {
      await fn();
      return null;
    } catch (err) {
      console.warn('[auth]', err);
      return 'failed';
    } finally {
      setPending(false);
    }
  }, []);

  const signInAnon = useCallback(async () => {
    const fb = getFirebase();
    if (!fb) return 'not-configured' as const;
    return run(() => signInAnonymously(fb.auth));
  }, [run]);

  const signInGoogle = useCallback(async () => {
    const fb = getFirebase();
    if (!fb) return 'not-configured' as const;
    // Native Google sign-in needs a dev build + @react-native-google-signin (later sprint).
    if (Platform.OS !== 'web') return 'native-google-unsupported' as const;
    return run(() => signInWithPopup(fb.auth, new GoogleAuthProvider()));
  }, [run]);

  const signOut = useCallback(async () => {
    const fb = getFirebase();
    if (!fb) return 'not-configured' as const;
    return run(() => firebaseSignOut(fb.auth));
  }, [run]);

  return { isFirebaseConfigured, pending, signInAnon, signInGoogle, signOut };
}
