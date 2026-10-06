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
}

const GLYPHS = {
  star: { on: '★', off: '☆', color: colors.star },
  heart: { on: '♥', off: '♡', color: colors.heart },
};

/** Tap the current value again to clear it. Read-only when `onChange` is omitted. */
export function StarRating({ value, onChange, max = 5, size = 30, kind = 'star' }: StarRatingProps) {
  const g = GLYPHS[kind];
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max, now: value }}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const on = n <= value;
        const glyph = (
          <AppText style={{ fontSize: size, lineHeight: size * 1.15, color: on ? g.color : colors.border }}>
            {on ? g.on : g.off}
          </AppText>
        );
        if (!onChange) return <View key={n}>{glyph}</View>;
        return (
          <Pressable
            key={n}
            hitSlop={4}
            accessibilityLabel={`${n}`}
            onPress={() => {
              tapFeedback();
              onChange(n === value ? 0 : n);
            }}
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
});
