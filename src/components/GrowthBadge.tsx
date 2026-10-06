import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { growthStageFor } from '@/features/library/growth';
import { colors, radius, spacing } from '@/theme';

export function GrowthBadge({ percent, showLabel = true }: { percent: number; showLabel?: boolean }) {
  const { t } = useTranslation();
  const stage = growthStageFor(percent);
  return (
    <View style={styles.badge} accessibilityLabel={t(`growth.${stage.stage}`)}>
      <AppText style={styles.emoji}>{stage.emoji}</AppText>
      {showLabel ? (
        <AppText variant="tiny" color={colors.primaryDeep}>
          {t(`growth.${stage.stage}`)}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  emoji: { fontSize: 14 },
});
