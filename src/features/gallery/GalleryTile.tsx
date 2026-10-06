import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, palette, radius, spacing } from '@/theme';

import type { GalleryCard } from './api';
import { CardImage } from './CardImage';

export function GalleryTile({ card, width }: { card: GalleryCard; width: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`card ${card.book_title}`}
      onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
      style={({ pressed }) => [styles.tile, { width }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <CardImage card={card} width={width - 8} compact />
      <View style={styles.meta}>
        <AppText variant="tiny" numberOfLines={1}>
          『{card.book_title}』
        </AppText>
        <View style={styles.row}>
          <AppText variant="tiny" muted numberOfLines={1} style={styles.flex}>
            {card.nickname ?? '독서가'}
          </AppText>
          <AppText variant="tiny" color={card.liked ? palette.pinkDeep : colors.textMuted}>
            ♥ {card.like_count}
          </AppText>
          <AppText variant="tiny" muted>
            💬 {card.comment_count}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
    gap: 4,
  },
  meta: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
