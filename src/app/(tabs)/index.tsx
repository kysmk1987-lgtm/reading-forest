import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { GrowthBadge } from '@/components/GrowthBadge';
import { SproutIllustration } from '@/components/SproutIllustration';
import { AppText, Button, Card, IconButton, ProgressBar, Screen } from '@/components/ui';
import { currentPageOf, growthStageFor, progressPercent } from '@/features/library/growth';
import { STATUS_META } from '@/features/library/statusMeta';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { colors, palette, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const nickname = useProfileStore((s) => s.nickname);
  const entriesMap = useLibraryStore((s) => s.entries);

  const summary = useMemo(() => {
    const entries = Object.values(entriesMap);
    const year = String(new Date().getFullYear());
    const reading = entries.filter((e) => e.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt);
    const finishedThisYear = entries.filter((e) => e.status === 'read' && (e.endDate ?? '').startsWith(year)).length;
    const want = entries.filter((e) => e.status === 'want').length;
    const pages = entries.reduce((sum, e) => sum + (currentPageOf(e) ?? 0), 0);
    const trees = entries.filter((e) => e.status === 'read').length;
    const bestPercent = Math.max(0, ...reading.map(progressPercent), trees ? 100 : 0);
    return { reading, finishedThisYear, want, pages, trees, bestPercent };
  }, [entriesMap]);

  const stats = [
    { label: t('home.readingNow'), value: summary.reading.length, color: palette.skySoft, emoji: '📖' },
    { label: t('home.finishedThisYear'), value: summary.finishedThisYear, color: palette.leafSoft, emoji: '🏁' },
    { label: t('home.wantToRead'), value: summary.want, color: palette.pinkSoft, emoji: '💗' },
    { label: t('home.pagesRead'), value: summary.pages, color: palette.yellowSoft, emoji: '📄' },
  ];

  return (
    <Screen
      title={t('common.appName')}
      subtitle={t('home.greeting', { name: nickname })}
      headerRight={<IconButton name="search" accessibilityLabel={t('search.title')} onPress={() => router.push('/search')} />}>
      <Card tint={palette.skySoft} edgeColor={palette.sky} style={styles.forest}>
        <AppText variant="subtitle">{t('home.forestTitle')}</AppText>
        <SproutIllustration emoji={growthStageFor(summary.bestPercent).emoji} size={210} />
        <AppText variant="caption" center muted style={styles.lines}>
          {summary.trees > 0 ? t('home.forestGrowing', { count: summary.trees }) : t('home.forestEmpty')}
        </AppText>
        <View style={styles.soonPill}>
          <AppText variant="tiny" color={palette.woodShadow}>
            {t('home.forestSoon')}
          </AppText>
        </View>
      </Card>

      <View style={styles.section}>
        <AppText variant="subtitle">{t('home.todayTitle')}</AppText>
        <View style={styles.statGrid}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: s.color }]}>
              <AppText style={styles.statEmoji}>{s.emoji}</AppText>
              <AppText variant="number" style={styles.statValue}>
                {s.value.toLocaleString()}
              </AppText>
              <AppText variant="tiny" muted>
                {s.label}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="subtitle">{t('home.continueReading')}</AppText>
        {summary.reading.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AppText style={styles.emptyEmoji}>🌰</AppText>
            <AppText muted>{t('home.noReading')}</AppText>
            <Button label={t('home.findBook')} onPress={() => router.push('/search')} />
          </Card>
        ) : (
          summary.reading.slice(0, 3).map((e) => {
            const percent = progressPercent(e);
            return (
              <Pressable
                key={e.id}
                onPress={() => {
                  tapFeedback();
                  router.push({ pathname: '/book/[id]', params: { id: e.book.id } });
                }}
                style={({ pressed }) => [styles.readingRow, pressed && styles.pressed]}>
                <BookCover uri={e.book.coverUrl} title={e.book.title} width={46} />
                <View style={styles.readingInfo}>
                  <View style={styles.readingTitle}>
                    <AppText numberOfLines={1} style={styles.flex}>
                      {e.book.title}
                    </AppText>
                    <GrowthBadge percent={percent} showLabel={false} />
                  </View>
                  <ProgressBar percent={percent} color={STATUS_META.reading.shadow} height={10} />
                  <AppText variant="tiny" muted>
                    {percent}%
                  </AppText>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  forest: { alignItems: 'center', gap: spacing.sm },
  lines: { lineHeight: 20 },
  soonPill: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  section: { gap: spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(91,70,54,0.12)',
    gap: 2,
  },
  statEmoji: { fontSize: 20 },
  statValue: { fontSize: 24, color: colors.text },
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyEmoji: { fontSize: 36 },
  readingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
  },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  readingInfo: { flex: 1, gap: 4 },
  readingTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
