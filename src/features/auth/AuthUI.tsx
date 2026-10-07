import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText, Card, Input, Screen, Sheet } from '@/components/ui';
import type { InputProps } from '@/components/ui/Input';
import { tapFeedback } from '@/lib/feedback';
import { colors, palette, PUFFY_DEPTH, radius, spacing } from '@/theme';

import { LEGAL_DOCS, type LegalDocId } from './legal';
import type { AuthOutcome, OAuthProvider } from './useAuth';
import type { FieldError as FieldErrorCode } from './validation';

/**
 * `failureText(outcome)` → Korean message (null for success / user cancel); `fieldText(code)` for inline field errors.
 * `seconds` fills the countdown of `rateLimitedWait` (0 = the wait is over, the message goes away).
 */
export function useAuthText() {
  const { t } = useTranslation();
  return {
    failureText: (outcome: AuthOutcome, provider?: OAuthProvider, seconds?: number) => {
      if (!outcome || outcome === 'cancelled') return null;
      if (outcome === 'rateLimitedWait' && seconds === 0) return null;
      return t(`auth.errors.${outcome}`, { provider: t(`auth.providers.${provider ?? 'email'}`), seconds: seconds ?? 60 });
    },
    fieldText: (code: FieldErrorCode | null | undefined) => (code ? t(`auth.fieldErrors.${code}`) : null),
  };
}

/**
 * Shared frame of the login / sign-up / password screens: forest logo + name + tagline on top,
 * the screen title above the puffy card that holds the form.
 */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation();
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
          <AppText variant="caption" color={palette.woodDeep} center>
            {t('auth.tagline')}
          </AppText>
        </View>
        <View style={styles.section}>
          <View style={styles.head}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" muted>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <Card style={styles.card}>{children}</Card>
        </View>
        {footer}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function KakaoLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.2c-5.3 0-9.6 3.38-9.6 7.55 0 2.7 1.8 5.07 4.5 6.4l-.92 3.38c-.08.3.26.54.52.37l4.02-2.66c.49.05.98.07 1.48.07 5.3 0 9.6-3.38 9.6-7.56S17.3 3.2 12 3.2z"
        fill="#191600"
      />
    </Svg>
  );
}

function GoogleLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const SOCIAL = {
  kakao: { face: '#FEE500', edge: '#D8BF00', border: '#F2D900', Logo: KakaoLogo, spinner: '#3C1E1E' },
  google: { face: palette.white, edge: '#DCD3C2', border: colors.border, Logo: GoogleLogo, spinner: '#4285F4' },
} as const;

/** Round 카카오 / 구글 buttons side by side (same OAuth flow as before, labelled for screen readers). */
export function SocialButtons({ pending, disabled, onPress }: { pending: OAuthProvider | null; disabled?: boolean; onPress: (provider: OAuthProvider) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.socialRow}>
      {(['kakao', 'google'] as const).map((provider) => {
        const look = SOCIAL[provider];
        const loading = pending === provider;
        return (
          <View key={provider} style={styles.socialItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`auth.${provider}`)}
              accessibilityState={{ disabled: !!disabled, busy: loading }}
              disabled={disabled}
              hitSlop={6}
              onPress={() => {
                tapFeedback();
                onPress(provider);
              }}
              style={[styles.socialEdge, { backgroundColor: look.edge }, disabled && !loading && styles.socialDisabled]}>
              {({ pressed }) => (
                <View style={[styles.socialFace, { backgroundColor: look.face, borderColor: look.border }, pressed && styles.socialPressed]}>
                  {loading ? <ActivityIndicator color={look.spinner} /> : <look.Logo size={provider === 'kakao' ? 30 : 26} />}
                </View>
              )}
            </Pressable>
            <AppText variant="tiny" muted>
              {t(`auth.providers.${provider}`)}
            </AppText>
          </View>
        );
      })}
    </View>
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
  section: { gap: spacing.sm },
  head: { gap: 2, paddingHorizontal: spacing.xs },
  card: { gap: spacing.md },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  socialItem: { alignItems: 'center', gap: spacing.xs },
  socialEdge: { width: 58, height: 62, borderRadius: 29, paddingBottom: PUFFY_DEPTH },
  socialFace: {
    flex: 1,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialPressed: { transform: [{ translateY: PUFFY_DEPTH - 1 }] },
  socialDisabled: { opacity: 0.6 },
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
