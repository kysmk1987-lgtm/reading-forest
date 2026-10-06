import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { palette, spacing } from '@/theme';

import { wrappedBannerPeriod, type WrappedPeriod } from './compute';

function open(period: WrappedPeriod, sample = false) {
  router.push({
    pathname: '/wrapped',
    params: {
      period: period.kind,
      y: String(period.year),
      ...(period.kind === 'month' ? { m: String(period.month) } : {}),
      ...(sample ? { sample: '1' } : {}),
    },
  });
}

/** 기록 tab: monthly / yearly report + sample. On home (`variant="home"`) it only shows at month end or in December. */
export function WrappedBanner({ variant = 'records' }: { variant?: 'records' | 'home' }) {
  const { t } = useTranslation();
  const now = new Date();
  const month: WrappedPeriod = { kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1 };
  const year: WrappedPeriod = { kind: 'year', year: now.getFullYear() };
  const homePeriod = wrappedBannerPeriod(now);
  if (variant === 'home' && !homePeriod) return null;

  return (
    <Card tint={palette.lavender} edgeColor="#8E78C9" style={styles.card}>
      <View style={styles.row}>
        <AppText style={styles.emoji}>🧬</AppText>
        <View style={styles.flex}>
          <AppText variant="subtitle">{variant === 'home' && homePeriod?.kind === 'year' ? t('wrapped.bannerYear', { year: now.getFullYear() }) : t('wrapped.bannerTitle')}</AppText>
          <AppText variant="caption" muted>
            {t('wrapped.bannerBody')}
          </AppText>
        </View>
      </View>
      <View style={styles.buttons}>
        {variant === 'home' && homePeriod ? (
          <Button size="sm" label={t('wrapped.open')} onPress={() => open(homePeriod)} />
        ) : (
          <>
            <Button size="sm" label={`📅 ${t('wrapped.monthly', { month: month.kind === 'month' ? month.month : '' })}`} onPress={() => open(month)} />
            <Button size="sm" variant="wood" label={`🗓️ ${t('wrapped.yearly', { year: year.year })}`} onPress={() => open(year)} />
          </>
        )}
        <Button size="sm" variant="soft" label={`✨ ${t('wrapped.sample')}`} onPress={() => open(variant === 'home' && homePeriod ? homePeriod : year, true)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 30, lineHeight: 38 },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
