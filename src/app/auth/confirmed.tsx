import type { EmailOtpType } from '@supabase/supabase-js';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { AppText, showToast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

/** Supabase puts link errors in the query (PKCE) or, for older links, in the URL hash. */
function linkError(params: { error?: string; error_code?: string }) {
  if (params.error || params.error_code) return true;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return /(^|[#&])error(_code)?=/.test(window.location.hash);
}

/**
 * Sign-up confirmation mails land here (outside the login gate). The address is already verified by Supabase
 * before the redirect, so this screen only makes sure no session is left behind and shows the login screen
 * with a "인증 완료" notice (the auth listener drops a same-browser session on this route).
 * A custom template may link here with `?token_hash=…&type=email` instead; that is verified here.
 */
export default function AuthConfirmedScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token_hash?: string; type?: string; error?: string; error_code?: string }>();
  const status = useAuthStore((s) => s.status);
  const [verified, setVerified] = useState(!params.token_hash);
  const [failed, setFailed] = useState(() => linkError(params));

  useEffect(() => {
    const sb = getSupabase();
    if (!params.token_hash || !sb) return;
    const type = (params.type === 'signup' ? 'signup' : 'email') as EmailOtpType;
    sb.auth
      .verifyOtp({ token_hash: params.token_hash, type })
      .then(async ({ error }) => {
        if (error) setFailed(true);
        await sb.auth.signOut({ scope: 'local' });
      })
      .finally(() => setVerified(true));
  }, [params.token_hash, params.type]);

  useEffect(() => {
    if (!verified || status === 'loading') return;
    if (failed) {
      router.replace({ pathname: '/login', params: { notice: 'confirmExpired' } });
      return;
    }
    if (status === 'signedIn') {
      // Native app already signed in with some account (the link itself never signs in there).
      showToast(t('auth.notices.confirmed'));
      router.replace('/');
      return;
    }
    router.replace({ pathname: '/login', params: { notice: 'confirmed' } });
  }, [verified, failed, status, t]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText muted>{t('auth.confirming')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
});
