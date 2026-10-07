import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  headerLeft?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Apply top safe-area padding (disable when a navigator header is shown). */
  safeTop?: boolean;
  /** Pinned below the content, outside the scroll view (e.g. `StackTabBar`). */
  footer?: ReactNode;
}

export function Screen({
  children,
  title,
  subtitle,
  headerLeft,
  headerRight,
  scroll = true,
  contentStyle,
  safeTop = true,
  footer,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const header =
    title || headerLeft || headerRight ? (
      <View style={styles.header}>
        {headerLeft}
        <View style={styles.headerText}>
          {title ? <AppText variant="title">{title}</AppText> : null}
          {subtitle ? (
            <AppText variant="caption" muted>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {headerRight}
      </View>
    ) : null;

  const padding = [styles.content, { paddingTop: (safeTop ? insets.top : 0) + spacing.md }, contentStyle];

  return (
    <View style={styles.root}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={padding}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[padding, styles.fill]}>
          {header}
          {children}
        </View>
      )}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  blobA: {
    pointerEvents: 'none',
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#EAF5DC',
  },
  blobB: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 120,
    left: -90,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FCEFD9',
  },
});
