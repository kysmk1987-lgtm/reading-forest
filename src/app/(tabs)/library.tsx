import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, EmptyState, IconButton, Screen } from '@/components/ui';
import { LibraryCard } from '@/features/library/LibraryCard';
import { ProgressSheet } from '@/features/library/ProgressSheet';
import { RecordSheet } from '@/features/library/RecordSheet';
import { SORT_OPTIONS, sortEntries, type SortOption } from '@/features/library/sort';
import { STATUS_META } from '@/features/library/statusMeta';
import { confirmAsync } from '@/lib/confirm';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, radius, softShadow, spacing } from '@/theme';
import { READING_STATUSES, type LibraryEntry, type ReadingStatus } from '@/types';

type Filter = ReadingStatus | 'all';

export default function LibraryScreen() {
  const { t } = useTranslation();
  const entriesMap = useLibraryStore((s) => s.entries);
  const removeEntry = useLibraryStore((s) => s.removeEntry);
  const [filter, setFilter] = useState<Filter>('reading');
  const [sort, setSort] = useState<SortOption>('createdDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const [progressFor, setProgressFor] = useState<LibraryEntry | null>(null);

  const entries = useMemo(() => Object.values(entriesMap), [entriesMap]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: entries.length, read: 0, reading: 0, want: 0, stopped: 0 };
    entries.forEach((e) => c[e.status]++);
    return c;
  }, [entries]);
  const visible = useMemo(
    () => sortEntries(filter === 'all' ? entries : entries.filter((e) => e.status === filter), sort),
    [entries, filter, sort],
  );

  const handleDelete = async (entry: LibraryEntry) => {
    const ok = await confirmAsync(
      t('library.deleteConfirmTitle'),
      t('library.deleteConfirmBody', { title: entry.book.title }),
      t('common.delete'),
      t('common.cancel'),
    );
    if (ok) removeEntry(entry.id);
  };

  const filters: Filter[] = ['all', ...READING_STATUSES];

  return (
    <Screen
      title={t('library.title')}
      headerRight={<IconButton name="add" accessibilityLabel={t('library.addBook')} onPress={() => router.push('/search')} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filters.map((f) => (
          <Chip
            key={f}
            label={f === 'all' ? t('library.all') : t(`status.${f}`)}
            count={counts[f]}
            selected={filter === f}
            color={f === 'all' ? colors.accent : STATUS_META[f].color}
            edgeColor={f === 'all' ? colors.accentShadow : STATUS_META[f].shadow}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        <AppText variant="caption" muted>
          {t('library.count', { count: visible.length })}
        </AppText>
        <View>
          <Pressable
            onPress={() => {
              tapFeedback();
              setSortOpen((o) => !o);
            }}
            style={styles.sortButton}
            accessibilityRole="button">
            <AppText variant="caption">
              {t(`library.sort.${sort}`)} {sortOpen ? '▴' : '▾'}
            </AppText>
          </Pressable>
          {sortOpen ? (
            <View style={styles.sortMenu}>
              {SORT_OPTIONS.map((o) => (
                <Pressable
                  key={o}
                  onPress={() => {
                    tapFeedback();
                    setSort(o);
                    setSortOpen(false);
                  }}
                  style={[styles.sortItem, o === sort && styles.sortItemActive]}>
                  <AppText variant="caption" color={o === sort ? colors.primaryDeep : colors.text}>
                    {t(`library.sort.${o}`)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {visible.length === 0 ? (
        <EmptyState
          emoji={filter === 'all' ? '🪵' : STATUS_META[filter].emoji}
          tint={filter === 'all' ? undefined : STATUS_META[filter].soft}
          title={t('library.empty')}
          body={t('library.emptyHint')}
          action={<Button label={t('home.findBook')} onPress={() => router.push('/search')} />}
        />
      ) : (
        <View style={styles.list}>
          {visible.map((entry) => (
            <LibraryCard
              key={entry.id}
              entry={entry}
              onOpen={() => router.push({ pathname: '/book/[id]', params: { id: entry.book.id } })}
              onEdit={() => setEditing(entry)}
              onDelete={() => handleDelete(entry)}
              onUpdateProgress={() => setProgressFor(entry)}
            />
          ))}
        </View>
      )}

      {editing ? (
        <RecordSheet visible book={editing.book} entry={editing} onClose={() => setEditing(null)} />
      ) : null}
      <ProgressSheet entry={progressFor} onClose={() => setProgressFor(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  sortButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  sortMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 150,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    ...softShadow(),
  },
  sortItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  sortItemActive: { backgroundColor: colors.primarySoft },
  list: { gap: spacing.md },
});
