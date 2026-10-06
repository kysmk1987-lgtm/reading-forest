import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tapFeedback } from '@/lib/feedback';
import { colors, MAX_APP_WIDTH, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bottom sheet built on Modal so it works the same on native and web. */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('a11y.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Pressable
              hitSlop={10}
              onPress={() => {
                tapFeedback();
                onClose();
              }}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.close')}>
              <AppText variant="title">✕</AppText>
            </Pressable>
            {title ? (
              <AppText variant="subtitle" center style={styles.title}>
                {title}
              </AppText>
            ) : null}
            <View style={styles.close} />
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    width: '100%',
    maxWidth: MAX_APP_WIDTH,
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  close: { width: 32, alignItems: 'flex-start' },
  title: { flex: 1 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
