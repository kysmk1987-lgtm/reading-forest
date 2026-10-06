import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Card } from './Card';

export interface EmptyStateProps {
  emoji: string;
  title: string;
  body?: string;
  badge?: string;
  tint?: string;
  action?: ReactNode;
}

export function EmptyState({ emoji, title, body, badge, tint, action }: EmptyStateProps) {
  return (
    <Card tint={tint} style={styles.card}>
      <View style={[styles.bubble, { backgroundColor: tint ? 'rgba(255,255,255,0.7)' : colors.primarySoft }]}>
        <AppText style={styles.emoji}>{emoji}</AppText>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="caption" color={colors.textOnPrimary}>
            {badge}
          </AppText>
        </View>
      ) : null}
      <AppText variant="subtitle" center>
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" muted center style={styles.body}>
          {body}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  bubble: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, lineHeight: 58 },
  badge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: 999,
  },
  body: { lineHeight: 21 },
  action: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xs },
});
