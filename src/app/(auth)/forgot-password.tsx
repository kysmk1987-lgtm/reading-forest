import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useAuthPrefs } from '@/features/auth/authStore';
import { AuthLayout, Field, Notice, TextLink, useAuthText } from '@/features/auth/AuthUI';
import { useAuthActions, type AuthOutcome } from '@/features/auth/useAuth';
import { normalizeEmail, validateEmail, type FieldError } from '@/features/auth/validation';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const auth = useAuthActions();
  const { failureText, fieldText } = useAuthText();
  const [email, setEmail] = useState(() => useAuthPrefs.getState().savedEmail);
  const [error, setError] = useState<FieldError | null>(null);
  const [failure, setFailure] = useState<AuthOutcome>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = async () => {
    const invalid = validateEmail(email);
    setError(invalid);
    setFailure(null);
    if (invalid) return;
    const outcome = await auth.sendPasswordReset(email);
    if (outcome) setFailure(outcome);
    else setSentTo(normalizeEmail(email));
  };

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.resetSentTitle')}>
        <AppText style={styles.body}>{t('auth.resetSentBody', { email: sentTo })}</AppText>
        <Button label={t('auth.backToLogin')} fullWidth onPress={back} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotBody')} footer={<TextLink label={t('auth.backToLogin')} onPress={back} />}>
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
        }}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
        error={fieldText(error)}
        left={<Ionicons name="mail-outline" size={20} color={colors.textMuted} />}
      />
      <Notice message={failureText(failure)} />
      <Button label={t('auth.sendReset')} size="lg" fullWidth loading={auth.pending === 'reset'} onPress={submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { lineHeight: 24 },
});
