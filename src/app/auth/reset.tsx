import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, type TextInput } from 'react-native';

import { AppText, Button, showToast } from '@/components/ui';
import { markSessionAlive, useAuthStore } from '@/features/auth/authStore';
import { AuthLayout, Notice, PasswordField, useAuthText } from '@/features/auth/AuthUI';
import { useAuthActions, type AuthOutcome } from '@/features/auth/useAuth';
import { validateConfirm, validateNewPassword } from '@/features/auth/validation';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/theme';

/**
 * 새 비밀번호 설정 — the password-reset e-mail links here (outside the login gate).
 * Web: supabase-js exchanges `?code=` itself; native deep links carry the code, which we exchange here.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const auth = useAuthActions();
  const { failureText, fieldText } = useAuthText();
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; error_description?: string }>();
  const status = useAuthStore((s) => s.status);
  const confirmRef = useRef<TextInput>(null);
  const [exchanging, setExchanging] = useState((Platform.OS !== 'web' && !!params.code) || !!params.token_hash);
  const [linkFailed, setLinkFailed] = useState(false);

  // The Korean recovery template links `?token_hash=…&type=recovery`: verifiable in any browser / device,
  // unlike the default PKCE link that only works where the reset was requested.
  useEffect(() => {
    const sb = getSupabase();
    if (!params.token_hash || !sb) return;
    markSessionAlive();
    sb.auth
      .verifyOtp({ token_hash: params.token_hash, type: 'recovery' })
      .then(({ error }) => {
        if (error) {
          console.warn('[auth] reset verify', error);
          setLinkFailed(true);
        }
      })
      .finally(() => setExchanging(false));
  }, [params.token_hash]);
  const [timedOut, setTimedOut] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<AuthOutcome>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !params.code) return;
    markSessionAlive();
    getSupabase()
      ?.auth.exchangeCodeForSession(params.code)
      .then(({ error }) => error && console.warn('[auth] reset exchange', error))
      .finally(() => setExchanging(false));
  }, [params.code]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  // A failed token must not fall through to a session that was already open in this browser.
  const hasSession = status === 'signedIn' && !linkFailed;
  const checking = !params.error_description && !linkFailed && (exchanging || (!hasSession && (status === 'loading' || !timedOut)));
  const passwordError = validateNewPassword(password);
  const confirmError = validateConfirm(password, confirm);

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (passwordError || confirmError) return;
    const outcome = await auth.updatePassword(password);
    if (outcome) {
      setFailure(outcome);
      return;
    }
    showToast(t('auth.resetDone'));
    router.replace('/');
  };

  if (checking) {
    return (
      <AuthLayout title={t('auth.resetTitle')}>
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText muted center>
          {t('auth.resetChecking')}
        </AppText>
      </AuthLayout>
    );
  }

  if (!hasSession) {
    return (
      <AuthLayout title={t('auth.resetTitle')}>
        <Notice message={t('auth.resetNoSession')} />
        <Button label={t('auth.forgotTitle')} fullWidth onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetBody')}>
      <PasswordField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.newPasswordPlaceholder')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={submitted ? fieldText(passwordError) : null}
        hint={t('auth.passwordRule')}
      />
      <PasswordField
        ref={confirmRef}
        label={t('auth.passwordConfirm')}
        value={confirm}
        onChangeText={setConfirm}
        placeholder={t('auth.passwordConfirmPlaceholder')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={submitted ? fieldText(confirmError) : null}
      />
      <Notice message={failureText(failure)} />
      <Button label={t('auth.resetSave')} size="lg" fullWidth loading={auth.pending === 'password'} onPress={submit} />
    </AuthLayout>
  );
}
