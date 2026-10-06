import { Pressable, StyleSheet, View } from 'react-native';

import { tapFeedback } from '@/lib/feedback';
import { colors } from '@/theme';

import { AppText } from './AppText';

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: number;
  /** `star` for ratings, `heart` for 기대지수. */
  kind?: 'star' | 'heart';
  /** Half-star steps: the left half of a star sets n − 0.5. */
  allowHalf?: boolean;
}

const GLYPHS = {
  star: { on: '★', off: '☆', color: colors.star },
  heart: { on: '♥', off: '♡', color: colors.heart },
};

/** Tap the current value again to clear it. Read-only when `onChange` is omitted. */
export function StarRating({ value, onChange, max = 5, size = 30, kind = 'star', allowHalf = false }: StarRatingProps) {
  const g = GLYPHS[kind];
  const text = { fontSize: size, lineHeight: size * 1.15 };
  const pick = (n: number) => {
    tapFeedback();
    onChange?.(n === value ? 0 : n);
  };
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max, now: value }}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const fill = value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0;
        const glyph = (
          <View>
            <AppText style={[text, { color: fill === 1 ? g.color : colors.border }]}>{fill === 1 ? g.on : g.off}</AppText>
            {fill === 0.5 ? (
              <View style={[styles.half, { width: '50%' }]}>
                <AppText style={[text, { color: g.color, width: size * 1.2 }]}>{g.on}</AppText>
              </View>
            ) : null}
          </View>
        );
        if (!onChange) return <View key={n}>{glyph}</View>;
        if (allowHalf) {
          return (
            <View key={n}>
              {glyph}
              <Pressable accessibilityLabel={`${n - 0.5}`} hitSlop={{ top: 4, bottom: 4, left: 4 }} onPress={() => pick(n - 0.5)} style={[styles.zone, styles.left]} />
              <Pressable accessibilityLabel={`${n}`} hitSlop={{ top: 4, bottom: 4, right: 4 }} onPress={() => pick(n)} style={[styles.zone, styles.right]} />
            </View>
          );
        }
        return (
          <Pressable
            key={n}
            hitSlop={4}
            accessibilityLabel={`${n}`}
            onPress={() => pick(n)}
            style={({ pressed }) => pressed && { transform: [{ scale: 0.85 }] }}>
            {glyph}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  half: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  zone: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  left: { left: 0 },
  right: { right: 0 },
});
