import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { StackTabBar } from '@/components/ForestTabBar';
import { AppText, Button, EmptyState, IconButton, Input, Screen } from '@/components/ui';
import { BookListItem } from '@/features/books/BookListItem';
import { useBestsellers, useBookSearch } from '@/features/books/hooks';
import { BookApiError, looksLikeIsbn } from '@/lib/api/books';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, palette, radius, spacing } from '@/theme';
import type { Book } from '@/types';

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const openBook = (book: Book) => router.push({ pathname: '/book/[id]', params: { id: book.id } });

export default function SearchScreen() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const query = useDebounced(text);
  // One box for 제목·저자·출판사; an ISBN typed there is looked up by ISBN without a separate tab.
  const search = useBookSearch(query, looksLikeIsbn(query) ? 'isbn' : 'keyword');
  const entries = useLibraryStore((s) => s.entries);
  const statusByBook = new Map(Object.values(entries).map((e) => [e.book.id, e.status] as const));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      title={t('search.title')}
      headerLeft={<IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={back} />}
      footer={<StackTabBar />}>
      <Input
        value={text}
        onChangeText={setText}
        placeholder={t('search.placeholder')}
        returnKeyType="search"
        autoFocus
        autoCorrect={false}
        left={<Ionicons name="search" size={20} color={colors.textMuted} />}
        right={
          text ? (
            <Ionicons name="close-circle" size={20} color={colors.textMuted} onPress={() => setText('')} />
          ) : null
        }
      />

      {!query.trim() ? (
        <>
          <EmptyState emoji="🔍" title={t('search.idle')} body={t('search.idleHint')} />
          <Bestsellers />
        </>
      ) : search.isLoading ? (
        <ActivityIndicator color={colors.primaryDeep} size="large" style={styles.loading} />
      ) : search.isError ? (
        <SearchError error={search.error} onRetry={() => search.refetch()} />
      ) : search.data && search.data.books.length === 0 ? (
        <EmptyState emoji="🫧" title={t('search.empty')} body={t('search.emptyHint')} />
      ) : search.data ? (
        <View style={styles.list}>
          {search.data.source ? (
            <AppText variant="tiny" muted>
              {t('search.source', { source: t(`source.${search.data.source}`) })}
            </AppText>
          ) : null}
          {search.data.books.map((book) => {
            const status = statusByBook.get(book.id);
            return <BookListItem key={book.id} book={book} badge={status ? t(`status.${status}`) : undefined} onPress={() => openBook(book)} />;
          })}
        </View>
      ) : null}
    </Screen>
  );
}

/** 베스트셀러 추천 below the empty state; hidden when the list can't be loaded. Shown without source attribution. */
function Bestsellers() {
  const { t } = useTranslation();
  const best = useBestsellers();
  if (best.isError) return null;
  return (
    <View style={styles.best} testID="bestsellers">
      <AppText variant="subtitle">📚 {t('search.bestTitle')}</AppText>
      {best.isLoading || !best.data ? (
        <ActivityIndicator color={colors.primaryDeep} style={styles.loading} />
      ) : (
        <View style={styles.grid}>
          {best.data.books.slice(0, 21).map((book, i) => (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityLabel={book.title}
              onPress={() => {
                tapFeedback();
                openBook(book);
              }}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
              <View>
                <BookCover uri={book.coverUrl} title={book.title} width={92} />
                <View style={styles.rank}>
                  <AppText variant="tiny" color={colors.textOnPrimary}>
                    {i + 1}
                  </AppText>
                </View>
              </View>
              <AppText variant="tiny" numberOfLines={2} center style={styles.cellTitle}>
                {book.title}
              </AppText>
              <AppText variant="tiny" muted numberOfLines={1} center>
                {book.authors[0] ?? ''}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SearchError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const code = error instanceof BookApiError ? error.code : 'UPSTREAM';
  if (code === 'NO_KEYS') {
    return <EmptyState emoji="🔑" title={t('search.noKeys')} body={t('search.noKeysHint')} />;
  }
  const title =
    code === 'NETWORK' ? t('search.network') : code === 'RATE_LIMITED' ? t('search.rateLimited') : t('search.error');
  return (
    <EmptyState
      emoji="🍂"
      title={title}
      body={t('search.errorHint')}
      action={<Button label={t('common.retry')} onPress={onRetry} />}
    />
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xl },
  list: { gap: spacing.sm },
  best: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.yellowSoft,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  cell: { width: '33.33%', paddingHorizontal: 4, alignItems: 'center', gap: 4 },
  cellTitle: { minHeight: 32 },
  pressed: { opacity: 0.7 },
  rank: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.pinkDeep,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
