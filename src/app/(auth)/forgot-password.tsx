import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useAuthPrefs } from '@/features/auth/authStore';
import { AuthLayout, Field, Notice, TextLink, useAuthText } from '@/features/auth/AuthUI';
import { useMailCooldown } from '@/features/auth/cooldown';
import { useAuthActions, type AuthOutcome } from '@/features/auth/useAuth';
import { normalizeEmail, validateEmail, type FieldError } from '@/features/auth/validation';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const auth = useAuthActions();
  const { failureText, fieldText } = useAuthText();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(() => (typeof params.email === 'string' && params.email) || useAuthPrefs.getState().savedEmail);
  const [error, setError] = useState<FieldError | null>(null);
  const [failure, setFailure] = useState<AuthOutcome>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const cooldown = useMailCooldown('reset', sentTo ?? email);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const send = async (address: string) => {
    if (auth.pending || cooldown > 0) return;
    setFailure(null);
    const outcome = await auth.sendPasswordReset(address);
    if (outcome) setFailure(outcome);
    else setSentTo(normalizeEmail(address));
  };

  const submit = () => {
    const invalid = validateEmail(email);
    setError(invalid);
    setFailure(null);
    if (!invalid) send(email);
  };

  const sendLabel = (idle: string) => (cooldown ? t('auth.resendIn', { seconds: cooldown }) : idle);

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.resetSentTitle')}>
        <AppText style={styles.body}>{t('auth.resetSentBody', { email: sentTo })}</AppText>
        <AppText variant="caption" muted>
          {t('auth.resetSentHint')}
        </AppText>
        <Notice message={failureText(failure, undefined, cooldown)} />
        <Button
          label={sendLabel(t('auth.resendReset'))}
          variant="soft"
          fullWidth
          loading={auth.pending === 'reset'}
          disabled={cooldown > 0}
          onPress={() => send(sentTo)}
        />
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
          setFailure(null);
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
      <Notice message={failureText(failure, undefined, cooldown)} />
      <Button
        label={sendLabel(t('auth.sendReset'))}
        size="lg"
        fullWidth
        loading={auth.pending === 'reset'}
        disabled={cooldown > 0 || !!auth.pending}
        onPress={submit}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { lineHeight: 24 },
});
