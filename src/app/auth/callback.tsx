import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { AppText, showToast } from '@/components/ui';
import { canEnterApp, lastOAuthProvider, markSessionAlive, useAuthStore } from '@/features/auth/authStore';
import { useAuthText } from '@/features/auth/AuthUI';
import { oauthFailure } from '@/features/auth/useAuth';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

/**
 * OAuth providers and sign-up confirmation mails return here (outside the login gate).
 * Web: supabase-js reads `?code=` itself; native deep links (e-mail confirmation) carry the code, exchanged here.
 */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { failureText } = useAuthText();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string }>();
  const signedIn = useAuthStore((s) => canEnterApp(s.status));

  useEffect(() => {
    if (Platform.OS === 'web' || !params.code) return;
    markSessionAlive();
    getSupabase()
      ?.auth.exchangeCodeForSession(params.code)
      .then(({ error }) => error && console.warn('[auth] callback exchange', error));
  }, [params.code]);

  useEffect(() => {
    if (params.error) {
      showToast(failureText(oauthFailure(params), lastOAuthProvider()) ?? t('auth.callbackFailed'));
      router.replace('/login');
      return;
    }
    if (signedIn) {
      showToast(t('my.signedIn'));
      router.replace('/');
      return;
    }
    const timer = setTimeout(() => {
      showToast(t('auth.callbackFailed'));
      router.replace('/login');
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the error / sign-in only, not every param object
  }, [params.error, signedIn, t]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText muted>{t('my.signingIn')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
});
