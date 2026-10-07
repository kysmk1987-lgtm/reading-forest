import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AppText, Button, showToast } from '@/components/ui';
import { authPrefsHydrated, useAuthPrefs } from '@/features/auth/authStore';
import { AuthLayout, CheckRow, Divider, Field, Notice, PasswordField, SocialButtons, TextLink, useAuthText } from '@/features/auth/AuthUI';
import { useMailCooldown } from '@/features/auth/cooldown';
import { useAuthActions, type AuthOutcome, type OAuthProvider } from '@/features/auth/useAuth';
import { normalizeEmail, validateEmail, type FieldError } from '@/features/auth/validation';
import { colors, spacing } from '@/theme';

/** `/login?notice=confirmed` after the sign-up mail link, `confirmExpired` when that link was stale. */
type LoginNotice = 'confirmed' | 'confirmExpired';

export default function LoginScreen() {
  const { t } = useTranslation();
  const auth = useAuthActions();
  const { failureText, fieldText } = useAuthText();
  const params = useLocalSearchParams<{ notice?: string; email?: string }>();
  const prefs = useAuthPrefs();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(prefs.rememberEmail);
  const [autoLogin, setAutoLogin] = useState(prefs.autoLogin);
  const [errors, setErrors] = useState<{ email?: FieldError | null; password?: FieldError | null }>({});
  const [failure, setFailure] = useState<{ outcome: AuthOutcome; provider?: OAuthProvider } | null>(null);
  const [notice, setNotice] = useState<LoginNotice | null>(
    params.notice === 'confirmed' || params.notice === 'confirmExpired' ? params.notice : null,
  );
  const resendLeft = useMailCooldown('confirm', email);

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
    if (busy) return;
    const next = { email: validateEmail(email), password: password ? null : ('passwordRequired' as const) };
    setErrors(next);
    setFailure(null);
    if (next.email || next.password) return;
    savePrefs(normalizeEmail(email));
    const outcome = await auth.signInWithEmail(email, password);
    if (outcome) setFailure({ outcome });
  };

  const social = async (provider: OAuthProvider) => {
    if (busy) return;
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

  const needsConfirmation = failure?.outcome === 'emailNotConfirmed' || notice === 'confirmExpired';

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      footer={
        <View style={styles.footer}>
          <AppText variant="caption" muted>
            {t('auth.noAccount')}
          </AppText>
          <TextLink label={t('auth.signUpLink')} onPress={() => router.push('/signup')} />
        </View>
      }>
      {notice ? <Notice tone={notice === 'confirmed' ? 'info' : 'error'} message={t(`auth.notices.${notice}`)} /> : null}

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
          if (notice === 'confirmed') setNotice(null);
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

      <Notice message={failure ? failureText(failure.outcome, failure.provider, resendLeft) : null} />
      {needsConfirmation && !validateEmail(email) ? (
        <Button
          size="sm"
          variant="soft"
          label={resendLeft ? t('auth.resendIn', { seconds: resendLeft }) : t('auth.resend')}
          loading={auth.pending === 'resend'}
          disabled={resendLeft > 0 || busy}
          onPress={resend}
        />
      ) : null}

      <Button label={t('auth.login')} size="lg" fullWidth loading={auth.pending === 'email'} disabled={busy} onPress={submit} />
      <View style={styles.center}>
        <TextLink label={t('auth.forgot')} onPress={() => router.push({ pathname: '/forgot-password', params: email ? { email } : {} })} small />
      </View>

      <Divider label={t('auth.or')} />
      <SocialButtons pending={auth.pending === 'kakao' || auth.pending === 'google' ? auth.pending : null} disabled={busy} onPress={social} />
      <AppText variant="tiny" muted center>
        {t('auth.socialHint')}
      </AppText>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  center: { alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
});
