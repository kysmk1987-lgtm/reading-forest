import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { GrowthBadge } from '@/components/GrowthBadge';
import { AppText, Button, Card, IconButton, ProgressBar, Screen, showToast } from '@/components/ui';
import { ForestGarden } from '@/features/forest/ForestGarden';
import { treeFromEntry } from '@/features/forest/model';
import { ShareForestSheet } from '@/features/forest/ShareForestSheet';
import { SpeciesSheet } from '@/features/forest/SpeciesSheet';
import { speciesOf } from '@/features/forest/species';
import type { Weather } from '@/features/forest/WeatherLayer';
import { currentPageOf, progressPercent } from '@/features/library/growth';
import { STATUS_META } from '@/features/library/statusMeta';
import { WrappedBanner } from '@/features/wrapped/WrappedBanner';
import { useEntitlements } from '@/lib/entitlements';
import { tapFeedback } from '@/lib/feedback';
import { useForestStore } from '@/stores/forestStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { colors, palette, radius, spacing } from '@/theme';

const WEATHERS: { value: Weather; emoji: string; premium: boolean }[] = [
  { value: 'clear', emoji: '☀️', premium: false },
  { value: 'rain', emoji: '🌧️', premium: true },
  { value: 'snow', emoji: '❄️', premium: true },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const nickname = useProfileStore((s) => s.nickname);
  const entriesMap = useLibraryStore((s) => s.entries);
  const { isPremium, can } = useEntitlements();
  const storedWeather = useForestStore((s) => s.weather);
  const setWeather = useForestStore((s) => s.setWeather);
  const weather = can('premiumTrees') ? storedWeather : 'clear';
  const [speciesFor, setSpeciesFor] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const gardenExtra = useForestStore((s) => s.gardenExtra);
  const expandGarden = useForestStore((s) => s.expandGarden);
  const plantTrees = useLibraryStore((s) => s.plantTrees);

  const trees = useMemo(() => Object.values(entriesMap).map((e) => treeFromEntry(e, isPremium)), [entriesMap, isPremium]);

  const summary = useMemo(() => {
    const entries = Object.values(entriesMap);
    const year = String(new Date().getFullYear());
    const reading = entries.filter((e) => e.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt);
    const finishedThisYear = entries.filter((e) => e.status === 'read' && (e.endDate ?? '').startsWith(year)).length;
    const want = entries.filter((e) => e.status === 'want').length;
    const pages = entries.reduce((sum, e) => sum + (currentPageOf(e) ?? 0), 0);
    const grown = entries.filter((e) => e.status === 'read').length;
    return { reading, finishedThisYear, want, pages, grown };
  }, [entriesMap]);

  const stats = [
    { label: t('home.readingNow'), value: summary.reading.length, color: palette.skySoft, emoji: '📖' },
    { label: t('home.finishedThisYear'), value: summary.finishedThisYear, color: palette.leafSoft, emoji: '🏁' },
    { label: t('home.wantToRead'), value: summary.want, color: palette.pinkSoft, emoji: '💗' },
    { label: t('home.pagesRead'), value: summary.pages, color: palette.yellowSoft, emoji: '📄' },
  ];

  const speciesEntry = speciesFor ? entriesMap[speciesFor] : undefined;

  return (
    <Screen
      title={t('common.appName')}
      subtitle={t('home.greeting', { name: nickname })}
      headerRight={<IconButton name="search" accessibilityLabel={t('search.title')} onPress={() => router.push('/search')} />}>
      <Card tint={palette.skySoft} edgeColor={palette.sky} padded={false} style={styles.forest}>
        <View style={styles.forestHeader}>
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('forest.myForest')}</AppText>
            <AppText variant="caption" muted>
              {trees.length ? t('forest.summary', { trees: trees.length, grown: summary.grown }) : t('home.forestEmptyShort')}
            </AppText>
          </View>
          {editing ? (
            <>
              <Button
                size="sm"
                variant="soft"
                label={`➕ ${t('forest.expand')}`}
                disabled={gardenExtra >= 6}
                onPress={() => {
                  tapFeedback();
                  expandGarden();
                  showToast(t('forest.expanded'));
                }}
              />
              <Button size="sm" label={t('forest.transplantDone')} onPress={() => setEditing(false)} />
            </>
          ) : (
            <>
              {trees.length > 0 ? (
                <Button size="sm" variant="soft" label={`🪴 ${t('forest.transplant')}`} onPress={() => setEditing(true)} />
              ) : null}
              <Button size="sm" variant="soft" label={`🔗 ${t('forest.share')}`} onPress={() => setShareOpen(true)} />
            </>
          )}
        </View>

        <ForestGarden
          trees={trees}
          weather={weather}
          emptyLabel={t('forest.emptySign')}
          editing={editing}
          extra={gardenExtra}
          onTransplant={plantTrees}
          onOpenBook={(tree) => router.push({ pathname: '/book/[id]', params: { id: tree.bookId } })}
          onChangeSpecies={(tree) => setSpeciesFor(tree.id)}
        />

        <View style={styles.weatherRow}>
          {WEATHERS.map((w) => {
            const locked = w.premium && !can('premiumTrees');
            const active = weather === w.value;
            return (
              <Pressable
                key={w.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: locked }}
                onPress={() => {
                  tapFeedback();
                  if (locked) showToast(t('forest.weatherLocked'));
                  else setWeather(w.value);
                }}
                style={[styles.weatherChip, active && styles.weatherActive, locked && styles.weatherLocked]}>
                <AppText variant="tiny" color={locked ? colors.textMuted : colors.text}>
                  {w.emoji} {t(`forest.weather.${w.value}`)}
                  {locked ? ' 🔒' : ''}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="tiny" muted center style={styles.hint}>
          {editing ? t('forest.transplantHint') : t('forest.tapHint')}
        </AppText>
        <Pressable accessibilityRole="link" onPress={() => router.push('/trees')} style={styles.guideLink}>
          <AppText variant="caption" color={palette.skyDeep}>
            {t('trees.open')} ›
          </AppText>
        </Pressable>
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

      <WrappedBanner variant="home" />

      <Card tint={palette.pinkSoft} edgeColor={palette.pinkDeep} style={styles.galleryCard}>
        <View style={styles.galleryHead}>
          <AppText style={styles.galleryEmoji}>✍️</AppText>
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('gallery.title')}</AppText>
            <AppText variant="caption" muted>
              {t('gallery.homeBody')}
            </AppText>
          </View>
        </View>
        <View style={styles.galleryButtons}>
          <Button size="sm" label={`🖋️ ${t('gallery.make')}`} onPress={() => router.push('/card/new')} />
          <Button size="sm" variant="soft" label={`🖼️ ${t('gallery.browse')}`} onPress={() => router.push('/gallery')} />
        </View>
      </Card>

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
                    <GrowthBadge percent={percent} showLabel={false} species={speciesOf(e, isPremium)} />
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

      <SpeciesSheet
        entryId={speciesFor}
        current={speciesEntry ? speciesOf(speciesEntry, isPremium) : undefined}
        onClose={() => setSpeciesFor(null)}
      />
      <ShareForestSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  forest: { paddingVertical: spacing.md, gap: spacing.sm, overflow: 'hidden' },
  forestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  weatherRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  weatherChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,253,246,0.85)',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  weatherActive: { backgroundColor: colors.surface, borderColor: palette.skyDeep },
  weatherLocked: { opacity: 0.7 },
  hint: { paddingHorizontal: spacing.lg },
  guideLink: { alignSelf: 'center', paddingVertical: 2 },
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
  galleryCard: { gap: spacing.sm },
  galleryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  galleryEmoji: { fontSize: 30, lineHeight: 38 },
  galleryButtons: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs },
});
