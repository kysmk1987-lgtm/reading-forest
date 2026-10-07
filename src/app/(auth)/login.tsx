import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AppText, Button, showToast } from '@/components/ui';
import { authPrefsHydrated, useAuthPrefs, useAuthStore } from '@/features/auth/authStore';
import { AuthLayout, CheckRow, Divider, Field, Notice, PasswordField, TextLink, useAuthText } from '@/features/auth/AuthUI';
import { useAuthActions, type AuthOutcome, type OAuthProvider } from '@/features/auth/useAuth';
import { normalizeEmail, validateEmail, type FieldError } from '@/features/auth/validation';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const auth = useAuthActions();
  const { failureText, fieldText } = useAuthText();
  const hasAnonymous = useAuthStore((s) => s.hasAnonymousSession);
  const prefs = useAuthPrefs();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(prefs.rememberEmail);
  const [autoLogin, setAutoLogin] = useState(prefs.autoLogin);
  const [errors, setErrors] = useState<{ email?: FieldError | null; password?: FieldError | null }>({});
  const [failure, setFailure] = useState<{ outcome: AuthOutcome; provider?: OAuthProvider } | null>(null);

  useEffect(() => {
    let alive = true;
    authPrefsHydrated().then(() => {
      if (!alive) return;
      const p = useAuthPrefs.getState();
      setRememberEmail(p.rememberEmail);
      setAutoLogin(p.autoLogin);
      if (p.rememberEmail && p.savedEmail) setEmail((current) => current || p.savedEmail);
    });
    return () => {
      alive = false;
    };
  }, []);

  const busy = auth.pending !== null;

  const savePrefs = (signedInEmail?: string) => {
    prefs.setPrefs({
      rememberEmail,
      autoLogin,
      ...(signedInEmail !== undefined ? { savedEmail: rememberEmail ? signedInEmail : '' } : null),
    });
  };

  const submit = async () => {
    const next = { email: validateEmail(email), password: password ? null : ('passwordRequired' as const) };
    setErrors(next);
    setFailure(null);
    if (next.email || next.password) return;
    savePrefs(normalizeEmail(email));
    const outcome = await auth.signInWithEmail(email, password);
    if (outcome) setFailure({ outcome });
  };

  const social = async (provider: OAuthProvider) => {
    setFailure(null);
    savePrefs();
    const outcome = provider === 'kakao' ? await auth.signInKakao() : await auth.signInGoogle();
    if (outcome) setFailure({ outcome, provider });
  };

  const resend = async () => {
    const outcome = await auth.resendConfirmation(email);
    if (outcome) setFailure({ outcome });
    else showToast(t('auth.resent'));
  };

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('auth.tagline')}
      footer={
        <View style={styles.footer}>
          <AppText variant="caption" muted>
            {t('auth.noAccount')}
          </AppText>
          <TextLink label={t('auth.signUpLink')} onPress={() => router.push('/signup')} />
        </View>
      }>
      {hasAnonymous ? <Notice tone="info" message={t('auth.anonymousNotice')} /> : null}

      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errors.email) setErrors((e) => ({ ...e, email: null }));
        }}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={fieldText(errors.email)}
        left={<Ionicons name="mail-outline" size={20} color={colors.textMuted} />}
      />
      <PasswordField
        ref={passwordRef}
        label={t('auth.password')}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (errors.password) setErrors((e) => ({ ...e, password: null }));
        }}
        placeholder={t('auth.passwordPlaceholder')}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={fieldText(errors.password)}
        left={<Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />}
      />

      <View style={styles.options}>
        <CheckRow label={t('auth.rememberEmail')} checked={rememberEmail} onChange={setRememberEmail} />
        <CheckRow label={t('auth.autoLogin')} checked={autoLogin} onChange={setAutoLogin} />
      </View>

      <Notice message={failure ? failureText(failure.outcome, failure.provider) : null} />
      {failure?.outcome === 'emailNotConfirmed' ? (
        <Button size="sm" variant="soft" label={t('auth.resend')} loading={auth.pending === 'resend'} onPress={resend} />
      ) : null}

      <Button label={t('auth.login')} size="lg" fullWidth loading={auth.pending === 'email'} disabled={busy} onPress={submit} />
      <View style={styles.forgot}>
        <TextLink label={t('auth.forgot')} onPress={() => router.push('/forgot-password')} small />
      </View>

      <Divider label={t('auth.or')} />
      <Button
        label={t('auth.kakao')}
        variant="kakao"
        fullWidth
        icon={<Ionicons name="chatbubble" size={18} color="#3C1E1E" />}
        loading={auth.pending === 'kakao'}
        disabled={busy}
        onPress={() => social('kakao')}
      />
      <Button
        label={t('auth.google')}
        variant="soft"
        fullWidth
        icon={<Ionicons name="logo-google" size={18} color="#4285F4" />}
        loading={auth.pending === 'google'}
        disabled={busy}
        onPress={() => social('google')}
      />
      <AppText variant="tiny" muted center>
        {t('auth.socialHint')}
      </AppText>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  forgot: { alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
});
