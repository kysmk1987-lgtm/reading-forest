import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AppText, Button, showToast } from '@/components/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { AuthLayout, CheckRow, Field, LegalSheet, Notice, PasswordField, TextLink, useAuthText } from '@/features/auth/AuthUI';
import type { LegalDocId } from '@/features/auth/legal';
import { useAuthActions, type AuthOutcome } from '@/features/auth/useAuth';
import { NICKNAME_MAX, normalizeEmail, validateSignUp, type SignUpErrors, type SignUpInput } from '@/features/auth/validation';
import { colors, palette, radius, spacing } from '@/theme';

type FieldKey = keyof SignUpErrors;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const auth = useAuthActions();
  const { failureText, fieldText } = useAuthText();
  const hasAnonymous = useAuthStore((s) => s.hasAnonymousSession);
  const nicknameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [form, setForm] = useState<SignUpInput>({ email: '', nickname: '', password: '', confirm: '', agreeTerms: false, agreePrivacy: false });
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<AuthOutcome>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [legal, setLegal] = useState<LegalDocId | null>(null);

  const errors = validateSignUp(form);
  const shown = (key: FieldKey) => (submitted || touched[key] ? fieldText(errors[key]) : null);
  const update = (patch: Partial<SignUpInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    setFailure(null);
  };
  const touch = (key: FieldKey) => () => setTouched((s) => ({ ...s, [key]: true }));

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (Object.keys(errors).length) return;
    const result = await auth.signUpWithEmail({ email: form.email, password: form.password, nickname: form.nickname });
    if (result.failure) {
      setFailure(result.failure);
      return;
    }
    if (result.needsConfirmation) {
      setSentTo(normalizeEmail(form.email));
      return;
    }
    showToast(t('auth.welcome', { name: form.nickname.trim() }));
  };

  const resend = async () => {
    if (!sentTo) return;
    const outcome = await auth.resendConfirmation(sentTo);
    if (outcome) setFailure(outcome);
    else showToast(t('auth.resent'));
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.confirmSentTitle')}>
        <AppText style={styles.body}>{t('auth.confirmSentBody', { email: sentTo })}</AppText>
        <Notice message={failureText(failure)} />
        <Button label={t('auth.resend')} variant="soft" fullWidth loading={auth.pending === 'resend'} onPress={resend} />
        <Button label={t('auth.backToLogin')} fullWidth onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  const allAgreed = form.agreeTerms && form.agreePrivacy;

  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <View style={styles.footer}>
          <AppText variant="caption" muted>
            {t('auth.haveAccount')}
          </AppText>
          <TextLink label={t('auth.login')} onPress={back} />
        </View>
      }>
      {hasAnonymous ? <Notice tone="info" message={t('auth.anonymousNotice')} /> : null}
      <Field
        label={t('auth.email')}
        value={form.email}
        onChangeText={(email) => update({ email })}
        onBlur={touch('email')}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => nicknameRef.current?.focus()}
        error={shown('email')}
        left={<Ionicons name="mail-outline" size={20} color={colors.textMuted} />}
      />
      <Field
        ref={nicknameRef}
        label={t('auth.nickname')}
        value={form.nickname}
        onChangeText={(nickname) => update({ nickname })}
        onBlur={touch('nickname')}
        placeholder={t('auth.nicknamePlaceholder')}
        maxLength={NICKNAME_MAX}
        showCounter
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={shown('nickname')}
      />
      <PasswordField
        ref={passwordRef}
        label={t('auth.password')}
        value={form.password}
        onChangeText={(password) => update({ password })}
        onBlur={touch('password')}
        placeholder={t('auth.newPasswordPlaceholder')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={shown('password')}
        hint={t('auth.passwordRule')}
      />
      <PasswordField
        ref={confirmRef}
        label={t('auth.passwordConfirm')}
        value={form.confirm}
        onChangeText={(confirm) => {
          update({ confirm });
          if (confirm.length >= form.password.length) touch('confirm')();
        }}
        onBlur={touch('confirm')}
        placeholder={t('auth.passwordConfirmPlaceholder')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        error={shown('confirm')}
      />

      <View style={styles.agreements}>
        <CheckRow label={t('auth.agreeAll')} strong checked={allAgreed} onChange={(v) => update({ agreeTerms: v, agreePrivacy: v })} />
        <View style={styles.hr} />
        <CheckRow label={t('auth.agreeTerms')} checked={form.agreeTerms} onChange={(agreeTerms) => update({ agreeTerms })} onView={() => setLegal('terms')} />
        <CheckRow
          label={t('auth.agreePrivacy')}
          checked={form.agreePrivacy}
          onChange={(agreePrivacy) => update({ agreePrivacy })}
          onView={() => setLegal('privacy')}
        />
      </View>
      {submitted ? <Notice message={fieldText(errors.terms ?? errors.privacy)} /> : null}
      <Notice message={failureText(failure)} />

      <Button label={t('auth.signUp')} size="lg" fullWidth loading={auth.pending === 'signUp'} onPress={submit} />
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { lineHeight: 24 },
  agreements: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.beige,
    borderWidth: 2,
    borderColor: colors.border,
  },
  hr: { height: 2, borderRadius: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
});
