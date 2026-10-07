import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, Button, Chip, EmptyState, IconButton, Screen, SegmentedControl } from '@/components/ui';
import { fetchFeed, isMissingSchemaError, type FeedScope, type FeedSort, type GalleryCard } from '@/features/gallery/api';
import { GalleryTile } from '@/features/gallery/GalleryTile';
import { aspectRatio } from '@/features/gallery/templates';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { MAX_APP_WIDTH, palette, spacing } from '@/theme';

type Tab = 'latest' | 'popular' | 'scraps' | 'mine';

const tabFromParam = (value?: string): Tab => (['latest', 'popular', 'scraps', 'mine'].includes(value ?? '') ? (value as Tab) : 'latest');

function tabQuery(tab: Tab): { sort: FeedSort; scope: FeedScope } {
  if (tab === 'popular') return { sort: 'popular', scope: 'all' };
  if (tab === 'scraps') return { sort: 'latest', scope: 'scraps' };
  if (tab === 'mine') return { sort: 'latest', scope: 'mine' };
  return { sort: 'latest', scope: 'all' };
}

/** Two columns, each card goes to the currently shorter column. */
function masonry(cards: GalleryCard[], colWidth: number) {
  const cols: GalleryCard[][] = [[], []];
  const heights = [0, 0];
  for (const c of cards) {
    const i = heights[0] <= heights[1] ? 0 : 1;
    cols[i].push(c);
    heights[i] += colWidth / aspectRatio(c.aspect) + 50;
  }
  return cols;
}

/** 문장 갤러리: public quote cards (최신 / 인기 / 스크랩 / 내 카드), filter by book. */
export default function GalleryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string; isbn?: string }>();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(params.tab));
  const [isbn, setIsbn] = useState<string | null>(params.isbn ?? null);
  // This screen stays mounted as a hidden tab, so later visits arrive as param changes, not a fresh mount.
  const paramKey = `${params.tab ?? ''}|${params.isbn ?? ''}`;
  const [seenParamKey, setSeenParamKey] = useState(paramKey);
  if (paramKey !== seenParamKey) {
    setSeenParamKey(paramKey);
    setTab(tabFromParam(params.tab));
    setIsbn(params.isbn ?? null);
  }
  const blurUnowned = useSettingsStore((s) => s.blurUnownedQuotes);
  const entries = useLibraryStore((s) => s.entries);
  const myBooks = useMemo(
    () => Object.values(entries).filter((e) => e.book.isbn13 && e.status !== 'want').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10),
    [entries],
  );
  const { sort, scope } = tabQuery(tab);
  const feed = useQuery({
    queryKey: ['gallery', sort, scope, isbn, blurUnowned],
    queryFn: () => fetchFeed({ sort, scope, isbn, blurUnowned }),
    enabled: isSupabaseConfigured,
    retry: (count, err) => !isMissingSchemaError(err) && count < 2,
  });
  const colWidth = Math.floor((Math.min(width, MAX_APP_WIDTH) - spacing.lg * 2 - spacing.sm) / 2);
  const columns = useMemo(() => masonry(feed.data ?? [], colWidth), [feed.data, colWidth]);
  const filterTitle = isbn ? (feed.data?.find((c) => c.isbn13 === isbn)?.book_title ?? myBooks.find((e) => e.book.isbn13 === isbn)?.book.title ?? isbn) : null;

  return (
    <Screen
      title={t('gallery.title')}
      subtitle={t('gallery.subtitle')}
      headerLeft={<IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      headerRight={<Button size="sm" label={`✍️ ${t('gallery.make')}`} onPress={() => router.push('/card/new')} />}>
      {!isSupabaseConfigured ? (
        <EmptyState
          emoji="🖼️"
          tint={palette.pinkSoft}
          title={t('gallery.serverOff')}
          body={t('gallery.serverOffBody')}
          action={<Button label={`✍️ ${t('gallery.make')}`} onPress={() => router.push('/card/new')} />}
        />
      ) : (
        <>
          <View style={styles.center}>
            <SegmentedControl<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'latest', label: t('gallery.latest') },
                { value: 'popular', label: t('gallery.popular') },
                { value: 'scraps', label: t('gallery.scraps') },
                { value: 'mine', label: t('gallery.mine') },
              ]}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Chip label={t('gallery.allBooks')} selected={!isbn} onPress={() => setIsbn(null)} />
            {isbn && !myBooks.some((e) => e.book.isbn13 === isbn) ? <Chip label={`📖 ${filterTitle}`} selected onPress={() => setIsbn(null)} /> : null}
            {myBooks.map((e) => (
              <Chip
                key={e.id}
                label={`📖 ${e.book.title.length > 12 ? `${e.book.title.slice(0, 12)}…` : e.book.title}`}
                selected={isbn === e.book.isbn13}
                onPress={() => setIsbn(isbn === e.book.isbn13 ? null : e.book.isbn13!)}
              />
            ))}
          </ScrollView>
          {feed.isLoading ? (
            <ActivityIndicator color={palette.leafDeep} />
          ) : feed.error ? (
            <EmptyState
              emoji={isMissingSchemaError(feed.error) ? '🛠️' : '🌧️'}
              title={isMissingSchemaError(feed.error) ? t('gallery.notReady') : t('gallery.loadFailed')}
              body={isMissingSchemaError(feed.error) ? t('gallery.notReadyBody') : undefined}
              action={<Button size="sm" variant="soft" label={t('common.retry')} onPress={() => feed.refetch()} />}
            />
          ) : !feed.data?.length ? (
            <EmptyState
              emoji={tab === 'scraps' ? '🔖' : '✍️'}
              tint={palette.leafSoft}
              title={t(`gallery.empty.${tab}`)}
              action={tab === 'scraps' ? undefined : <Button label={`✍️ ${t('gallery.make')}`} onPress={() => router.push('/card/new')} />}
            />
          ) : (
            <View style={styles.grid}>
              {columns.map((col, i) => (
                <View key={i} style={styles.col}>
                  {col.map((c) => (
                    <GalleryTile key={c.id} card={c} width={colWidth} />
                  ))}
                </View>
              ))}
            </View>
          )}
          <AppText variant="tiny" muted center>
            {t('gallery.blurNote')}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  filters: { gap: spacing.xs, paddingVertical: 2 },
  grid: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  col: { flex: 1, gap: spacing.sm },
});
