import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Input, showToast, StarRating } from '@/components/ui';
import { confirmAsync } from '@/lib/confirm';
import { formatDisplayDate } from '@/lib/date';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, palette, radius, spacing } from '@/theme';
import type { Book, LibraryEntry } from '@/types';

import { cleanReviewBody, distributionPercents, normalizeRating, REVIEW_BODY_MAX } from './aggregate';
import { deleteMyReview, fetchReviews, reportReview, saveReview, type BookReview } from './api';

export function useBookReviews(isbn13: string | undefined, entry?: LibraryEntry) {
  return useQuery({
    queryKey: ['reviews', isbn13 ?? 'none', entry?.updatedAt ?? 0],
    queryFn: () => fetchReviews(isbn13, entry),
    staleTime: 60_000,
    retry: 1,
  });
}

/** 리뷰 tab of the book detail page: summary, my review form, community list. */
export function ReviewsPanel({ book, entry }: { book: Book; entry?: LibraryEntry }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const visibility = useSettingsStore((s) => s.reviewVisibility);
  const updateEntry = useLibraryStore((s) => s.updateEntry);
  const query = useBookReviews(book.isbn13, entry);
  const data = query.data;
  const mine = data?.reviews.find((r) => r.mine);
  const [editing, setEditing] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ rating: number; body: string }>(() => ({
    rating: normalizeRating(entry?.rating) ?? 0,
    body: entry?.review ?? '',
  }));
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviews', book.isbn13 ?? 'none'] });
  const canKeepInRecord = entry && (entry.status === 'read' || entry.status === 'stopped');
  const server = data?.mode === 'server';
  const canWrite = server ? visibility === 'public' : !!canKeepInRecord;
  const showForm = canWrite && (editing || !mine);

  const startEdit = (review?: BookReview) => {
    setDraft({ rating: review?.rating ?? normalizeRating(entry?.rating) ?? 0, body: review?.body ?? entry?.review ?? '' });
    setEditing(true);
    setMenuFor(null);
  };

  const submit = async () => {
    const rating = normalizeRating(draft.rating);
    if (!rating) {
      showToast(t('reviews.needRating'));
      return;
    }
    setBusy(true);
    const body = cleanReviewBody(draft.body);
    if (canKeepInRecord) updateEntry(entry.id, { rating, review: body || undefined });
    const ok = server && book.isbn13 ? await saveReview(book.isbn13, rating, body) : !!canKeepInRecord;
    setBusy(false);
    showToast(ok ? t('reviews.saved') : t('reviews.failed'));
    if (ok) {
      setEditing(false);
      refresh();
    }
  };

  const remove = async () => {
    setMenuFor(null);
    if (!book.isbn13) return;
    if (!(await confirmAsync(t('reviews.delete'), t('reviews.deleteConfirm'), t('reviews.delete'), t('common.cancel')))) return;
    const ok = server ? await deleteMyReview(book.isbn13) : true;
    if (canKeepInRecord) updateEntry(entry.id, { rating: undefined, review: undefined });
    showToast(ok ? t('reviews.deleted') : t('reviews.failed'));
    refresh();
  };

  const report = async (review: BookReview) => {
    setMenuFor(null);
    if (!(await confirmAsync(t('reviews.report'), t('reviews.reportConfirm'), t('reviews.report'), t('common.cancel')))) return;
    const result = await reportReview(review.id, t('reviews.reportReason'));
    showToast(result === 'ok' ? t('reviews.reported') : result === 'already' ? t('reviews.alreadyReported') : t('reviews.failed'));
    refresh();
  };

  if (!book.isbn13) {
    return (
      <Card style={styles.section}>
        <AppText variant="caption" muted center>
          {t('reviews.noIsbn')}
        </AppText>
      </Card>
    );
  }
  if (query.isLoading || !data) {
    return <ActivityIndicator color={colors.primaryDeep} style={styles.loading} />;
  }

  const percents = distributionPercents(data.summary);
  return (
    <View style={styles.section}>
      <Card style={styles.summary}>
        <View style={styles.summaryLeft}>
          <AppText variant="number" style={styles.average}>
            {data.summary.count ? data.summary.average.toFixed(1) : '–'}
          </AppText>
          <StarRating value={Math.round(data.summary.average * 2) / 2} size={18} />
          <AppText variant="tiny" muted>
            {t('reviews.count', { count: data.summary.count })}
          </AppText>
        </View>
        <View style={styles.bars}>
          {[5, 4, 3, 2, 1].map((star) => (
            <View key={star} style={styles.barRow}>
              <AppText variant="tiny" muted style={styles.barLabel}>
                {star}★
              </AppText>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percents[star - 1]}%` }]} />
              </View>
              <AppText variant="tiny" muted style={styles.barCount}>
                {data.summary.dist[star - 1]}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      {data.mode !== 'server' ? (
        <AppText variant="tiny" muted center>
          {data.mode === 'local' ? t('reviews.local') : t('reviews.unavailable')}
        </AppText>
      ) : visibility === 'private' ? (
        <View style={[styles.note, styles.notePrivate]}>
          <AppText variant="tiny">{t('reviews.privateNote')}</AppText>
        </View>
      ) : null}

      {showForm ? (
        <Card tint={palette.leafSoft} edgeColor={palette.leaf} style={styles.form}>
          <View style={styles.formHead}>
            <AppText variant="subtitle">{mine ? t('reviews.mine') : t('reviews.write')}</AppText>
            <StarRating value={draft.rating} allowHalf size={30} onChange={(rating) => setDraft((d) => ({ ...d, rating }))} />
          </View>
          <Input
            multiline
            showCounter
            maxLength={REVIEW_BODY_MAX}
            value={draft.body}
            onChangeText={(body) => setDraft((d) => ({ ...d, body }))}
            placeholder={t('reviews.placeholder')}
          />
          {server ? (
            <AppText variant="tiny" muted>
              {t('reviews.publicNote')}
            </AppText>
          ) : null}
          <View style={styles.formButtons}>
            {editing && mine ? <Button size="sm" variant="soft" label={t('common.cancel')} onPress={() => setEditing(false)} /> : null}
            <Button size="sm" label={mine ? t('reviews.update') : t('reviews.submit')} loading={busy} onPress={submit} />
          </View>
        </Card>
      ) : null}

      {data.reviews.length === 0 ? (
        <Card style={styles.empty}>
          <AppText style={styles.emptyEmoji}>📝</AppText>
          <AppText>{t('reviews.empty')}</AppText>
          <AppText variant="caption" muted>
            {t('reviews.emptyHint')}
          </AppText>
        </Card>
      ) : (
        data.reviews.map((review) => (
          <Card key={review.id} style={[styles.review, review.mine && styles.reviewMine]}>
            <View style={styles.reviewHead}>
              <View style={styles.flex}>
                <AppText numberOfLines={1}>
                  {review.nickname || t('reviews.anonymous')}
                  {review.mine ? ` · ${t('reviews.mine')}` : ''}
                </AppText>
                <View style={styles.reviewMeta}>
                  <StarRating value={review.rating} size={14} />
                  <AppText variant="tiny" muted>
                    {formatDisplayDate(review.updated_at.slice(0, 10))}
                  </AppText>
                </View>
              </View>
              {review.mine ? (canWrite ? <MoreButton label={t('reviews.more')} onPress={() => setMenuFor(menuFor === review.id ? null : review.id)} /> : null) : server ? (
                <MoreButton label={t('reviews.more')} onPress={() => setMenuFor(menuFor === review.id ? null : review.id)} />
              ) : null}
            </View>
            {review.body ? <AppText variant="caption">{review.body}</AppText> : null}
            {menuFor === review.id ? (
              <View style={styles.menu}>
                {review.mine ? (
                  <>
                    <MenuItem icon="create-outline" label={t('reviews.edit')} onPress={() => startEdit(review)} />
                    <MenuItem icon="trash-outline" label={t('reviews.delete')} danger onPress={remove} />
                  </>
                ) : (
                  <MenuItem icon="flag-outline" label={t('reviews.report')} danger onPress={() => report(review)} />
                )}
              </View>
            ) : null}
          </Card>
        ))
      )}
    </View>
  );
}

function MoreButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={styles.more}>
      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: 'create-outline' | 'trash-outline' | 'flag-outline'; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.text} />
      <AppText variant="caption" color={danger ? colors.danger : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  loading: { marginVertical: spacing.xl },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryLeft: { alignItems: 'center', gap: 2, minWidth: 96 },
  average: { fontSize: 36, lineHeight: 42, color: colors.text },
  bars: { flex: 1, gap: 3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barLabel: { width: 24 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.backgroundAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.star },
  barCount: { width: 24, textAlign: 'right' },
  note: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  notePrivate: { backgroundColor: palette.stoneSoft },
  form: { gap: spacing.sm },
  formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  empty: { alignItems: 'center', gap: 4 },
  emptyEmoji: { fontSize: 30, lineHeight: 38 },
  review: { gap: spacing.xs, paddingVertical: spacing.md },
  reviewMine: { borderColor: palette.leaf },
  reviewHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  more: { padding: 4 },
  menu: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: spacing.sm },
  flex: { flex: 1 },
});
