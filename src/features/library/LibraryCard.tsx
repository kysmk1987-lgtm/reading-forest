import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { GrowthBadge } from '@/components/GrowthBadge';
import { AppText, Button, IconButton, ProgressBar, StarRating } from '@/components/ui';
import { formatDisplayDate, formatTimestamp } from '@/lib/date';
import { tapFeedback } from '@/lib/feedback';
import { colors, radius, softShadow, spacing } from '@/theme';
import type { LibraryEntry } from '@/types';

import { currentPageOf, progressPercent } from './growth';
import { STATUS_META } from './statusMeta';

export interface LibraryCardProps {
  entry: LibraryEntry;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateProgress: () => void;
}

export function LibraryCard({ entry, onOpen, onEdit, onDelete, onUpdateProgress }: LibraryCardProps) {
  const { t } = useTranslation();
  const meta = STATUS_META[entry.status];
  const percent = progressPercent(entry);
  const page = currentPageOf(entry);
  const total = entry.book.pageCount;

  const dateLine = (() => {
    switch (entry.status) {
      case 'read':
        return [entry.startDate && t('library.started', { date: formatDisplayDate(entry.startDate) }), entry.endDate && t('library.finished', { date: formatDisplayDate(entry.endDate) })];
      case 'stopped':
        return [entry.startDate && t('library.started', { date: formatDisplayDate(entry.startDate) }), entry.endDate && t('library.stoppedAt', { date: formatDisplayDate(entry.endDate) })];
      case 'reading':
        return [entry.startDate && t('library.started', { date: formatDisplayDate(entry.startDate) })];
      case 'want':
        return [t('library.savedAt', { date: formatTimestamp(entry.createdAt) })];
    }
  })()
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View style={[styles.card, { borderBottomColor: meta.color }]}>
      <Pressable
        style={styles.main}
        accessibilityRole="button"
        onPress={() => {
          tapFeedback();
          onOpen();
        }}>
        <BookCover uri={entry.book.coverUrl} title={entry.book.title} width={70} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <View style={[styles.statusPill, { backgroundColor: meta.soft }]}>
              <AppText variant="tiny" color={meta.shadow}>
                {meta.emoji} {t(`status.${entry.status}`)}
              </AppText>
            </View>
            {entry.status === 'reading' ? <GrowthBadge percent={percent} /> : null}
          </View>
          <AppText numberOfLines={2}>{entry.book.title}</AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {entry.book.authors.join(', ') || t('common.unknown')}
          </AppText>
          {dateLine ? (
            <AppText variant="tiny" muted>
              {dateLine}
            </AppText>
          ) : null}
          {(entry.status === 'read' || entry.status === 'stopped') && entry.rating ? (
            <StarRating value={entry.rating} size={16} />
          ) : null}
          {entry.status === 'want' && entry.expectation ? (
            <StarRating kind="heart" value={entry.expectation} size={16} />
          ) : null}
          {entry.review || entry.expectationNote ? (
            <AppText variant="caption" numberOfLines={2} style={styles.review}>
              “{entry.review ?? entry.expectationNote}”
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {entry.status === 'reading' || entry.status === 'read' ? (
        <View style={styles.progressRow}>
          <ProgressBar percent={percent} color={meta.shadow} height={12} style={styles.flex} />
          <AppText variant="tiny" style={styles.progressText}>
            {percent}%{page !== undefined && total ? `  ${t('library.pageProgress', { current: page, total })}` : ''}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {entry.status === 'reading' ? (
          <Button label={t('library.updateProgress')} size="sm" variant="sky" onPress={onUpdateProgress} />
        ) : (
          <View />
        )}
        <View style={styles.iconRow}>
          <IconButton name="create-outline" accessibilityLabel={t('common.edit')} onPress={onEdit} size={18} />
          <IconButton
            name="trash-outline"
            accessibilityLabel={t('common.delete')}
            onPress={onDelete}
            size={18}
            color={colors.danger}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    padding: spacing.md,
    gap: spacing.md,
    ...softShadow(),
  },
  main: { flexDirection: 'row', gap: spacing.md },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  review: { color: colors.textMuted, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: { minWidth: 92, textAlign: 'right' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconRow: { flexDirection: 'row', gap: spacing.sm },
});
