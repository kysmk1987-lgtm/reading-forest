import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Screen } from '@/components/ui';
import { palette, radius, spacing } from '@/theme';

const SAMPLE_CARDS = [
  { key: 'sample1', tint: palette.leafSoft },
  { key: 'sample2', tint: palette.skySoft },
  { key: 'sample3', tint: palette.pinkSoft },
] as const;

export default function GalleryScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('gallery.title')}>
      <EmptyState
        emoji="🖼️"
        tint={palette.pinkSoft}
        badge={t('common.nextUpdate')}
        title={t('common.comingSoon')}
        body={t('gallery.body')}
      />
      <View style={styles.cards}>
        {SAMPLE_CARDS.map((c, i) => (
          <View
            key={c.key}
            style={[styles.card, { backgroundColor: c.tint, transform: [{ rotate: `${(i - 1) * 2.5}deg` }] }]}>
            <AppText center>{t(`gallery.${c.key}`)}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: spacing.md, paddingHorizontal: spacing.sm, opacity: 0.85 },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(91,70,54,0.12)',
  },
});
