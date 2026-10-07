import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { AppText, Button, Card, EmptyState, IconButton, Input, Screen, showToast } from '@/components/ui';
import {
  addComment,
  deleteCard,
  deleteComment,
  fetchCard,
  fetchComments,
  isMissingSchemaError,
  reportCard,
  revealCard,
  setLiked,
  setScrapped,
  type GalleryCard,
} from '@/features/gallery/api';
import { CardImage } from '@/features/gallery/CardImage';
import { translateText, useTranslationQuota } from '@/features/gallery/translate';
import { TRANSLATION_ENABLED } from '@/config/locale';
import { confirmAsync } from '@/lib/confirm';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, MAX_APP_WIDTH, palette, radius, spacing } from '@/theme';

export default function CardDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const uid = useProfileStore((s) => s.uid);
  const nickname = useProfileStore((s) => s.nickname);
  const blurUnowned = useSettingsStore((s) => s.blurUnownedQuotes);
  const [comment, setComment] = useState('');
  const [translated, setTranslated] = useState<string | null>(null);
  const quota = useTranslationQuota();
  const key = ['card', id, blurUnowned];
  const card = useQuery({ queryKey: key, queryFn: () => fetchCard(id, blurUnowned), enabled: !!id });
  const c = card.data;
  const comments = useQuery({ queryKey: ['card-comments', id], queryFn: () => fetchComments(id), enabled: !!c && !c.blurred });

  const patch = (p: Partial<GalleryCard>) => {
    qc.setQueryData<GalleryCard | null>(key, (old) => (old ? { ...old, ...p } : old));
    void qc.invalidateQueries({ queryKey: ['gallery'] });
  };

  const reveal = useMutation({
    mutationFn: () => revealCard(id),
    onSuccess: (res) => {
      if (res) patch({ blurred: false, quote: res.quote, image_path: res.image_path });
    },
    onError: () => showToast(t('gallery.actionFailed')),
  });
  const like = useMutation({
    mutationFn: (on: boolean) => setLiked(id, on),
    onMutate: (on) => c && patch({ liked: on, like_count: Math.max(0, c.like_count + (on ? 1 : -1)) }),
    onError: () => {
      showToast(t('gallery.actionFailed'));
      void card.refetch();
    },
  });
  const scrap = useMutation({
    mutationFn: (on: boolean) => setScrapped(id, on),
    onMutate: (on) => c && patch({ scrapped: on, scrap_count: Math.max(0, c.scrap_count + (on ? 1 : -1)) }),
    onSuccess: (_d, on) => showToast(on ? t('gallery.scrapped') : t('gallery.unscrapped')),
    onError: () => {
      showToast(t('gallery.actionFailed'));
      void card.refetch();
    },
  });
  const send = useMutation({
    mutationFn: (body: string) => addComment(id, nickname, body),
    onSuccess: () => {
      setComment('');
      if (c) patch({ comment_count: c.comment_count + 1 });
      void comments.refetch();
    },
    onError: () => showToast(t('gallery.actionFailed')),
  });

  const onReveal = async () => {
    if (!c) return;
    const ok = await confirmAsync(t('gallery.revealTitle'), t('gallery.revealBody', { percent: c.progress_percent }), t('gallery.revealOk'), t('common.cancel'));
    if (ok) reveal.mutate();
  };
  const onReport = async () => {
    const ok = await confirmAsync(t('gallery.reportTitle'), t('gallery.reportBody'), t('gallery.reportOk'), t('common.cancel'));
    if (!ok) return;
    try {
      await reportCard(id, 'user_report');
      showToast(t('gallery.reported'));
      void qc.invalidateQueries({ queryKey: ['gallery'] });
      if (router.canGoBack()) router.back();
      else router.navigate('/gallery');
    } catch {
      showToast(t('gallery.actionFailed'));
    }
  };
  const onDelete = async () => {
    if (!c) return;
    const ok = await confirmAsync(t('gallery.deleteTitle'), t('gallery.deleteBody'), t('common.delete'), t('common.cancel'));
    if (!ok) return;
    try {
      await deleteCard(c);
      showToast(t('gallery.deleted'));
      void qc.invalidateQueries({ queryKey: ['gallery'] });
      router.navigate('/gallery');
    } catch {
      showToast(t('gallery.actionFailed'));
    }
  };
  const onTranslate = async () => {
    if (!c?.quote) return;
    if (quota.remaining <= 0) {
      showToast(t('gallery.translateLimit'));
      return;
    }
    try {
      setTranslated(await translateText(c.quote, 'en'));
      quota.consume();
    } catch {
      showToast(t('gallery.translateOff'));
    }
  };

  const imageWidth = Math.round((Math.min(width, MAX_APP_WIDTH) - spacing.lg * 2) * (c?.aspect === 'story' ? 0.78 : 0.94));

  return (
    <Screen
      title={t('gallery.detailTitle')}
      headerLeft={<IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/gallery'))} />}>
      {card.isLoading ? (
        <ActivityIndicator color={palette.leafDeep} />
      ) : !c ? (
        <EmptyState
          emoji={card.error && isMissingSchemaError(card.error) ? '🛠️' : '🍂'}
          title={card.error && isMissingSchemaError(card.error) ? t('gallery.notReady') : t('gallery.notFound')}
          action={<Button size="sm" variant="soft" label={t('gallery.title')} onPress={() => router.navigate('/gallery')} />}
        />
      ) : (
        <>
          <View style={styles.center}>
            <CardImage card={c} width={imageWidth} />
            {c.blurred ? (
              <Button style={styles.reveal} variant="wood" label={`👀 ${t('gallery.reveal')}`} loading={reveal.isPending} onPress={onReveal} />
            ) : null}
          </View>

          {c.blurred ? (
            <Card tint={palette.yellowSoft} edgeColor={palette.yellowDeep} style={styles.gap}>
              <AppText variant="caption">{t('gallery.blurExplain', { percent: c.progress_percent, mine: c.viewer_progress ?? 0 })}</AppText>
            </Card>
          ) : (
            <Card style={styles.gap}>
              <AppText variant="body" selectable style={styles.quote}>
                “{c.quote}”
              </AppText>
              {TRANSLATION_ENABLED ? (
                <View style={styles.gap}>
                  {translated ? <AppText variant="caption" muted>{translated}</AppText> : null}
                  <Button size="sm" variant="soft" label={t('gallery.translate', { count: quota.remaining })} onPress={onTranslate} />
                </View>
              ) : null}
            </Card>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => (c.isbn13 ? router.navigate({ pathname: '/gallery', params: { isbn: c.isbn13 } }) : undefined)}
            style={styles.book}>
            <BookCover uri={c.book_cover ?? undefined} title={c.book_title} width={46} />
            <View style={styles.flex}>
              <AppText variant="body" numberOfLines={2}>
                『{c.book_title}』
              </AppText>
              {c.book_author ? (
                <AppText variant="caption" muted numberOfLines={1}>
                  {c.book_author}
                </AppText>
              ) : null}
              <AppText variant="tiny" muted>
                📍 {c.progress_page ? t('gallery.atPage', { page: c.progress_page, percent: c.progress_percent }) : t('gallery.atPercent', { percent: c.progress_percent })}
                {'  ·  '}
                {c.nickname ?? '독서가'} · {c.created_at.slice(0, 10)}
              </AppText>
            </View>
            {c.isbn13 ? <AppText variant="tiny" color={palette.leafDeep}>{t('gallery.moreFromBook')}</AppText> : null}
          </Pressable>

          <View style={styles.actions}>
            <ActionButton
              label={`${c.liked ? '♥' : '♡'} ${c.like_count}`}
              a11y={t('gallery.like')}
              active={c.liked}
              color={palette.pinkDeep}
              onPress={() => like.mutate(!c.liked)}
              disabled={c.blurred && !c.mine}
            />
            <ActionButton
              label={`🔖 ${c.scrap_count}`}
              a11y={t('gallery.scrap')}
              active={c.scrapped}
              color={palette.leafDeep}
              onPress={() => scrap.mutate(!c.scrapped)}
              disabled={c.blurred && !c.mine}
            />
            <ActionButton label={`💬 ${c.comment_count}`} a11y={t('gallery.comments')} />
            {c.mine ? (
              <ActionButton label={`🗑 ${t('common.delete')}`} a11y={t('common.delete')} color={palette.dangerDeep} onPress={onDelete} />
            ) : (
              <ActionButton label={`🚩 ${t('gallery.report')}`} a11y={t('gallery.report')} color={palette.stoneDeep} onPress={onReport} />
            )}
          </View>

          {c.blurred ? null : (
            <Card style={styles.gap}>
              <AppText variant="subtitle">💬 {t('gallery.comments')}</AppText>
              {comments.data?.length ? (
                comments.data.map((cm) => (
                  <View key={cm.id} style={styles.comment}>
                    <View style={styles.flex}>
                      <AppText variant="tiny" muted>
                        {cm.nickname ?? '독서가'} · {cm.created_at.slice(5, 16).replace('T', ' ')}
                      </AppText>
                      <AppText variant="caption">{cm.body}</AppText>
                    </View>
                    {cm.user_id === uid ? (
                      <IconButton
                        name="trash-outline"
                        size={16}
                        accessibilityLabel={t('common.delete')}
                        onPress={async () => {
                          try {
                            await deleteComment(cm.id);
                            patch({ comment_count: Math.max(0, c.comment_count - 1) });
                            void comments.refetch();
                          } catch {
                            showToast(t('gallery.actionFailed'));
                          }
                        }}
                      />
                    ) : null}
                  </View>
                ))
              ) : (
                <AppText variant="caption" muted>
                  {comments.isLoading ? '…' : t('gallery.noComments')}
                </AppText>
              )}
              <View style={styles.row}>
                <Input containerStyle={styles.flex} value={comment} onChangeText={setComment} placeholder={t('gallery.commentPlaceholder')} maxLength={300} />
                <Button size="sm" label={t('gallery.send')} loading={send.isPending} disabled={!comment.trim()} onPress={() => send.mutate(comment)} />
              </View>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function ActionButton({ label, a11y, active, color = colors.text, onPress, disabled }: { label: string; a11y: string; active?: boolean; color?: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.action, active && { borderColor: color, backgroundColor: palette.cream }, (pressed || disabled) && { opacity: 0.6 }]}>
      <AppText variant="caption" color={active ? color : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  reveal: { marginTop: -spacing.xs },
  gap: { gap: spacing.sm },
  quote: { lineHeight: 26 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  book: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  action: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  comment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
});
