import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { TreeGraphic } from '@/features/forest/TreeGraphic';
import { growthStageFor } from '@/features/library/growth';
import { colors, radius, spacing } from '@/theme';
import type { TreeSpeciesId } from '@/types';

export function GrowthBadge({
  percent,
  showLabel = true,
  species = 'round',
}: {
  percent: number;
  showLabel?: boolean;
  species?: TreeSpeciesId;
}) {
  const { t } = useTranslation();
  const stage = growthStageFor(percent).stage;
  return (
    <View style={styles.badge} accessibilityLabel={t(`growth.${stage}`)}>
      <TreeGraphic stage={stage} species={species} size={22} />
      {showLabel ? (
        <AppText variant="tiny" color={colors.primaryDeep}>
          {t(`growth.${stage}`)}
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
    paddingLeft: 2,
    paddingRight: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
});
