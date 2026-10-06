import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { palette, radius, spacing } from '@/theme';

import { blurImageUrl, signedImageUrl, type GalleryCard } from './api';
import { aspectRatio, templateById } from './templates';

/** Card artwork: the full image (signed URL) when visible, otherwise the public blurred thumbnail + a spoiler notice. */
export function CardImage({ card, width, compact }: { card: GalleryCard; width: number; compact?: boolean }) {
  const { t } = useTranslation();
  const height = Math.round(width / aspectRatio(card.aspect));
  const tpl = templateById(card.template);
  const full = useQuery({
    queryKey: ['card-image', card.image_path],
    queryFn: () => signedImageUrl(card.image_path!),
    enabled: !card.blurred && !!card.image_path,
    staleTime: 50 * 60 * 1000,
  });
  const blurUrl = card.blurred ? blurImageUrl(card.blur_path) : null;
  return (
    <View style={[styles.frame, { width, height, backgroundColor: tpl.bg[1] }]}>
      {card.blurred ? (
        <>
          {blurUrl ? <Image source={{ uri: blurUrl }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={compact ? 12 : 18} /> : null}
          <View style={styles.veil} accessibilityLabel="spoiler-veil">
            <AppText style={compact ? styles.eyeSmall : styles.eye}>🙈</AppText>
            <AppText variant={compact ? 'tiny' : 'caption'} center color={palette.brown}>
              {t('gallery.spoiler', { percent: card.progress_percent })}
            </AppText>
          </View>
        </>
      ) : full.data ? (
        <Image source={{ uri: full.data }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={card.quote ?? card.book_title} />
      ) : (
        <ActivityIndicator style={StyleSheet.absoluteFill} color={tpl.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.md, overflow: 'hidden' },
  veil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,253,246,0.45)',
  },
  eye: { fontSize: 34, lineHeight: 42 },
  eyeSmall: { fontSize: 24, lineHeight: 30 },
});
