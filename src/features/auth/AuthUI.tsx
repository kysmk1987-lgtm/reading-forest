import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AppText, Card, Input, Screen, Sheet } from '@/components/ui';
import type { InputProps } from '@/components/ui/Input';
import { tapFeedback } from '@/lib/feedback';
import { colors, palette, radius, spacing } from '@/theme';

import { LEGAL_DOCS, type LegalDocId } from './legal';
import type { AuthOutcome, OAuthProvider } from './useAuth';
import type { FieldError as FieldErrorCode } from './validation';

/** `failureText(outcome)` → Korean message (null for success / user cancel); `fieldText(code)` for inline field errors. */
export function useAuthText() {
  const { t } = useTranslation();
  return {
    failureText: (outcome: AuthOutcome, provider?: OAuthProvider) =>
      outcome && outcome !== 'cancelled' ? t(`auth.errors.${outcome}`, { provider: t(`auth.providers.${provider ?? 'email'}`) }) : null,
    fieldText: (code: FieldErrorCode | null | undefined) => (code ? t(`auth.fieldErrors.${code}`) : null),
  };
}

/** Shared frame of the login / sign-up / password screens: little forest logo on top, form in a puffy card. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={styles.screen}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <AppText style={styles.logoEmoji}>🌳</AppText>
            <AppText style={styles.logoBook}>📖</AppText>
          </View>
          <AppText variant="hero" color={palette.leafShadow}>
            독서의숲
          </AppText>
        </View>
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <AppText variant="title">{title}</AppText>
            {subtitle ? (
              <AppText variant="caption" muted>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {children}
        </Card>
        {footer}
      </Screen>
    </KeyboardAvoidingView>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <AppText variant="tiny" color={palette.dangerDeep} style={styles.fieldError} accessibilityLiveRegion="polite">
      {message}
    </AppText>
  );
}

export const Field = forwardRef<TextInput, InputProps & { error?: string | null; hint?: string }>(function Field({ error, hint, ...rest }, ref) {
  return (
    <View>
      <Input ref={ref} {...rest} />
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <AppText variant="tiny" muted style={styles.fieldError}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

/** Password input with a show / hide eye button. */
export const PasswordField = forwardRef<TextInput, InputProps & { error?: string | null; hint?: string }>(function PasswordField(props, ref) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          onPress={() => setVisible((v) => !v)}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
        </Pressable>
      }
    />
  );
});

export function CheckRow({
  label,
  checked,
  onChange,
  strong,
  onView,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  strong?: boolean;
  onView?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.checkRow}>
      <Pressable
        style={styles.checkPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        hitSlop={6}
        onPress={() => {
          tapFeedback();
          onChange(!checked);
        }}>
        <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} /> : null}</View>
        <AppText variant={strong ? 'body' : 'caption'} style={styles.shrink}>
          {label}
        </AppText>
      </Pressable>
      {onView ? <TextLink label={t('auth.view')} onPress={onView} small /> : null}
    </View>
  );
}

export function TextLink({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      onPress={() => {
        tapFeedback();
        onPress();
      }}>
      <AppText variant={small ? 'caption' : 'body'} color={palette.woodDeep} style={styles.link}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Form-level error / info banner. */
export function Notice({ message, tone = 'error' }: { message?: string | null; tone?: 'error' | 'info' }) {
  if (!message) return null;
  const error = tone === 'error';
  return (
    <View style={[styles.notice, error ? styles.noticeError : styles.noticeInfo]} accessibilityLiveRegion="polite" accessibilityRole={error ? 'alert' : undefined}>
      <AppText variant="caption" color={error ? palette.dangerDeep : colors.text}>
        {error ? '⚠️ ' : '🌱 '}
        {message}
      </AppText>
    </View>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={styles.line} />
    </View>
  );
}

export function LegalSheet({ doc, onClose }: { doc: LegalDocId | null; onClose: () => void }) {
  const content = doc ? LEGAL_DOCS[doc] : null;
  return (
    <Sheet visible={!!doc} onClose={onClose} title={content?.title}>
      {content?.sections.map((s, i) => (
        <View key={i} style={styles.legalSection}>
          {s.heading ? <AppText variant="body">{s.heading}</AppText> : null}
          <AppText variant="caption" muted={!s.heading} style={styles.legalBody}>
            {s.body}
          </AppText>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.xs },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.leafSoft,
    borderWidth: 3,
    borderColor: palette.leaf,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 42, lineHeight: 50 },
  logoBook: { position: 'absolute', right: -4, bottom: -2, fontSize: 26, lineHeight: 32 },
  card: { gap: spacing.md },
  cardHead: { gap: 2 },
  fieldError: { marginTop: 4, marginLeft: spacing.xs },
  shrink: { flexShrink: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 32 },
  checkPress: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primaryDeep },
  link: { textDecorationLine: 'underline' },
  notice: { borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 2 },
  noticeError: { backgroundColor: palette.pinkSoft, borderColor: palette.pink },
  noticeInfo: { backgroundColor: palette.leafSoft, borderColor: palette.leaf },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.border },
  legalSection: { gap: spacing.xs },
  legalBody: { lineHeight: 21 },
});
