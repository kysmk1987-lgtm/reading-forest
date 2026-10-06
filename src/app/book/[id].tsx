import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { GrowthBadge } from '@/components/GrowthBadge';
import { AppText, Button, Card, EmptyState, IconButton, ProgressBar, Screen } from '@/components/ui';
import { useBook } from '@/features/books/hooks';
import { progressPercent } from '@/features/library/growth';
import { RecordSheet } from '@/features/library/RecordSheet';
import { STATUS_META } from '@/features/library/statusMeta';
import { ReviewsPanel, useBookReviews } from '@/features/reviews/ReviewsPanel';
import { formatDisplayDate } from '@/lib/date';
import { tapFeedback } from '@/lib/feedback';
import { findEntryByBookId, useLibraryStore } from '@/stores/libraryStore';
import { colors, palette, radius, spacing } from '@/theme';

export default function BookDetailScreen() {
  const { t } = useTranslation();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { book, isLoading, isEnriching } = useBook(id);
  const entry = useLibraryStore((s) => findEntryByBookId(s.entries, id));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<'intro' | 'reviews'>(tabParam === 'reviews' ? 'reviews' : 'intro');
  const reviews = useBookReviews(book?.isbn13, entry);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const header = <IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={back} />;

  if (!book) {
    return (
      <Screen title={t('book.detail')} headerLeft={header}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primaryDeep} style={styles.loading} />
        ) : (
          <EmptyState emoji="🍂" title={t('book.notFound')} />
        )}
      </Screen>
    );
  }

  const rows = [
    { label: t('book.authors'), value: book.authors.join(', ') },
    { label: t('book.translators'), value: book.translators?.join(', ') },
    { label: t('book.publisher'), value: book.publisher },
    { label: t('book.publishedDate'), value: book.publishedDate && formatDisplayDate(book.publishedDate) },
    { label: t('book.pages'), value: book.pageCount ? t('common.pages', { count: book.pageCount }) : undefined },
    { label: t('book.isbn'), value: book.isbn13 ?? book.isbn10 },
    { label: t('book.price'), value: book.price ? t('book.priceValue', { price: book.price.toLocaleString('ko-KR') }) : undefined },
    { label: t('book.category'), value: book.category },
  ].filter((r) => r.value);
  const meta = entry ? STATUS_META[entry.status] : null;
  const percent = entry ? progressPercent(entry) : 0;
  const byline = [
    book.authors.join(', ') || t('common.unknown'),
    book.translators?.length ? `${book.translators.join(', ')} ${t('book.translators')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen title={t('book.detail')} headerLeft={header}>
      <View style={styles.hero}>
        <BookCover uri={book.coverUrl} title={book.title} width={170} />
        <AppText variant="title" center>
          {book.title}
        </AppText>
        <AppText muted center>
          {byline}
          {book.pageCount ? ` (${t('common.pages', { count: book.pageCount })})` : ''}
        </AppText>
      </View>

      {entry && meta ? (
        <Card tint={meta.soft} edgeColor={meta.color} style={styles.statusCard}>
          <View style={styles.statusRow}>
            <AppText color={meta.shadow}>{t('book.inLibrary', { status: `${meta.emoji} ${t(`status.${entry.status}`)}` })}</AppText>
            {entry.status === 'reading' ? <GrowthBadge percent={percent} /> : null}
          </View>
          {entry.status === 'reading' ? <ProgressBar percent={percent} color={meta.shadow} /> : null}
          <Button label={t('book.editRecord')} variant="soft" fullWidth onPress={() => setSheetOpen(true)} />
        </Card>
      ) : (
        <Button label={`🌱 ${t('book.addToLibrary')}`} size="lg" fullWidth onPress={() => setSheetOpen(true)} />
      )}

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['intro', 'reviews'] as const).map((key) => {
          const active = tab === key;
          const label = key === 'intro' ? t('reviews.tabIntro') : t('reviews.tabReviews');
          const count = key === 'reviews' && reviews.data?.summary.count ? ` ${reviews.data.summary.count}` : '';
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                tapFeedback();
                setTab(key);
              }}
              style={[styles.tab, active && styles.tabActive]}>
              <AppText color={active ? colors.text : colors.textMuted} style={active ? styles.tabTextActive : undefined}>
                {label}
                {count}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {tab === 'intro' ? (
        <>
          <Card style={styles.section}>
            <AppText variant="subtitle">{t('book.intro')}</AppText>
            {book.description ? (
              <AppText variant="caption" muted style={styles.description}>
                {book.description}
              </AppText>
            ) : isEnriching ? (
              <ActivityIndicator color={colors.primaryDeep} />
            ) : (
              <AppText variant="caption" muted>
                {t('common.unknown')}
              </AppText>
            )}
          </Card>

          <Card style={styles.section}>
            {rows.map((r) => (
              <View key={r.label} style={styles.infoRow}>
                <AppText variant="caption" muted style={styles.infoLabel}>
                  {r.label}
                </AppText>
                <AppText variant="caption" style={styles.flex}>
                  {r.value}
                </AppText>
              </View>
            ))}
          </Card>

          {book.link ? (
            <Button
              label={`📖 ${t('book.link')}`}
              variant="soft"
              fullWidth
              onPress={() => WebBrowser.openBrowserAsync(book.link!).catch(() => {})}
            />
          ) : null}
        </>
      ) : (
        <ReviewsPanel book={book} entry={entry} />
      )}

      <RecordSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} book={book} entry={entry} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm },
  statusCard: { gap: spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { gap: spacing.sm },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.leaf, paddingVertical: spacing.sm - 2 },
  tabTextActive: { fontWeight: '700' },
  description: { lineHeight: 22 },
  infoRow: { flexDirection: 'row', gap: spacing.md },
  infoLabel: { width: 56 },
  flex: { flex: 1 },
});
