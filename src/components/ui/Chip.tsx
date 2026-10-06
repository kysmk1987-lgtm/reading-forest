import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tapFeedback } from '@/lib/feedback';
import { colors, fontSize, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
  color?: string;
  edgeColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, count, color = colors.primary, edgeColor, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tapFeedback();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: color, borderColor: edgeColor ?? color, borderBottomColor: edgeColor ?? colors.primaryShadow }
          : styles.idle,
        pressed && styles.pressed,
        style,
      ]}>
      <AppText style={styles.label} color={selected ? colors.textOnPrimary : colors.text}>
        {label}
      </AppText>
      {count !== undefined ? (
        <View style={[styles.badge, selected && styles.badgeSelected]}>
          <AppText variant="tiny" color={selected ? colors.text : colors.textMuted}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  label: { fontSize: fontSize.sm },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
  },
  badgeSelected: { backgroundColor: 'rgba(255,255,255,0.85)' },
});
