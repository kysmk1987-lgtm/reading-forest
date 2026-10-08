import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { colors, spacing } from '@/theme';

const COLLAPSED_LINES = 6;

/** Search APIs cut descriptions mid-sentence; mark those with an ellipsis instead of ending abruptly. */
export function withEllipsis(text: string): string {
  const trimmed = text.trim();
  return /[.!?。…"'”’」』）)\]》〉~]$/.test(trimmed) ? trimmed : `${trimmed}…`;
}

/**
 * 책 소개 text clamped to a few lines with a 더보기 / 접기 toggle. Overflow is detected by comparing the
 * clamped height with a hidden unclamped copy (`onLayout`), because react-native-web has no `onTextLayout`.
 */
export function BookDescription({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [clampedHeight, setClampedHeight] = useState(0);
  const [fullHeight, setFullHeight] = useState(0);
  const body = withEllipsis(text);
  const overflows = fullHeight > clampedHeight + 1;

  return (
    <View style={styles.wrap}>
      <AppText
        variant="caption"
        muted
        style={styles.text}
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
        onLayout={(e) => !expanded && setClampedHeight(e.nativeEvent.layout.height)}>
        {body}
      </AppText>
      <AppText
        variant="caption"
        style={[styles.text, styles.measure]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setFullHeight(e.nativeEvent.layout.height)}>
        {body}
      </AppText>
      {overflows || expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
          onPress={() => {
            tapFeedback();
            setExpanded((v) => !v);
          }}
          style={styles.toggle}>
          <AppText variant="caption" color={colors.primaryDeep} style={styles.toggleText}>
            {expanded ? t('book.showLess') : t('book.showMore')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  text: { lineHeight: 22 },
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0, pointerEvents: 'none' },
  toggle: { alignSelf: 'flex-end', marginTop: spacing.xs, paddingHorizontal: spacing.xs },
  toggleText: { fontWeight: '700' },
});
