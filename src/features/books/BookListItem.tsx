import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { AppText } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';
import type { Book } from '@/types';

export function BookListItem({ book, onPress, badge }: { book: Book; onPress: () => void; badge?: string }) {
  const { t } = useTranslation();
  const meta = [book.publisher, book.publishedDate, book.pageCount ? t('common.pages', { count: book.pageCount }) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <BookCover uri={book.coverUrl} title={book.title} width={62} />
      <View style={styles.info}>
        <AppText numberOfLines={2}>{book.title}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {book.authors.join(', ') || t('common.unknown')}
        </AppText>
        {meta ? (
          <AppText variant="tiny" muted numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
        {badge ? (
          <View style={styles.badge}>
            <AppText variant="tiny" color={colors.primaryDeep}>
              {badge}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
  },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  info: { flex: 1, gap: 3, justifyContent: 'center' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
});
