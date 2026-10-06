import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, IconButton, Input, Screen, SegmentedControl } from '@/components/ui';
import { BookListItem } from '@/features/books/BookListItem';
import { useBookSearch } from '@/features/books/hooks';
import { BookApiError, type SearchMode } from '@/lib/api/books';
import { notify } from '@/lib/confirm';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, spacing } from '@/theme';

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SearchMode>('keyword');
  const [text, setText] = useState('');
  const query = useDebounced(text);
  const search = useBookSearch(query, mode);
  const entries = useLibraryStore((s) => s.entries);
  const statusByBook = new Map(Object.values(entries).map((e) => [e.book.id, e.status] as const));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      title={t('search.title')}
      headerLeft={<IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={back} />}>
      <View style={styles.modeRow}>
        <SegmentedControl
          value={mode}
          onChange={(m) => {
            setMode(m);
            setText('');
          }}
          options={[
            { value: 'keyword', label: t('search.modeKeyword') },
            { value: 'isbn', label: t('search.modeIsbn') },
          ]}
        />
        <Button
          size="sm"
          variant="soft"
          label={t('search.scan')}
          icon={<Ionicons name="barcode-outline" size={18} color={colors.text} />}
          onPress={() => notify(t('search.scanSoon'))}
        />
      </View>

      <Input
        value={text}
        onChangeText={setText}
        placeholder={mode === 'isbn' ? t('search.isbnPlaceholder') : t('search.placeholder')}
        keyboardType={mode === 'isbn' ? 'number-pad' : 'default'}
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
        <EmptyState emoji="🔍" title={t('search.idle')} body={t('search.idleHint')} />
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
            return (
              <BookListItem
                key={book.id}
                book={book}
                badge={status ? t(`status.${status}`) : undefined}
                onPress={() => router.push({ pathname: '/book/[id]', params: { id: book.id } })}
              />
            );
          })}
        </View>
      ) : null}
    </Screen>
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
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  loading: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
});
