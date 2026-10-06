import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Screen } from '@/components/ui';
import { palette, radius, spacing } from '@/theme';

const PREVIEW_KEYS = ['previewPomodoro', 'previewNoise', 'previewGlobe', 'previewCheer'] as const;

export default function TimerScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('timer.title')}>
      <EmptyState
        emoji="⏰"
        tint={palette.yellowSoft}
        badge={t('common.nextUpdate')}
        title={t('common.comingSoon')}
        body={t('timer.body')}
      />
      <View style={styles.grid}>
        {PREVIEW_KEYS.map((key) => (
          <View key={key} style={styles.tile}>
            <AppText variant="caption">{t(`timer.${key}`)}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.yellowDeep,
  },
});
