import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, showToast } from '@/components/ui';
import { useProfileStore } from '@/stores/profileStore';
import { colors, spacing } from '@/theme';

/** OAuth providers return here; Supabase reads `?code=` itself, we just wait for the session and move on. */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ error?: string; error_description?: string }>();
  const signedIn = useProfileStore((s) => s.authMode !== 'guest' && s.authMode !== 'anonymous');

  useEffect(() => {
    if (params.error) {
      showToast(t('my.authError'));
      router.replace('/my');
      return;
    }
    if (signedIn) {
      showToast(t('my.signedIn'));
      router.replace('/my');
      return;
    }
    const timer = setTimeout(() => router.replace('/my'), 8000);
    return () => clearTimeout(timer);
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
