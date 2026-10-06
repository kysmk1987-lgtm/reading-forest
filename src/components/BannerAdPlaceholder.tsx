import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { colors, palette, radius, spacing } from '@/theme';

/** Free-tier banner slot. Sprint 5 swaps this for a real AdMob banner on native. */
export function BannerAdPlaceholder() {
  const { t } = useTranslation();
  const { showAds } = useEntitlements();
  if (!showAds) return null;
  return (
    <View style={styles.banner} accessibilityLabel={t('a11y.ad')}>
      <View style={styles.adTag}>
        <AppText variant="tiny" color={colors.textOnPrimary}>
          {t('ads.tag')}
        </AppText>
      </View>
      <AppText variant="caption" muted numberOfLines={1} style={styles.text}>
        🍃 {t('ads.placeholder')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 50,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.wood,
    backgroundColor: palette.woodSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  adTag: { backgroundColor: palette.woodDeep, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  text: { flex: 1 },
});
