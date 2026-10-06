import { Pressable, StyleSheet, View } from 'react-native';

import { tapFeedback } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tapFeedback();
              onChange(o.value);
            }}
            style={[styles.segment, active && styles.active]}>
            <AppText variant="caption" color={active ? colors.textOnPrimary : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  active: { backgroundColor: colors.primary, borderBottomWidth: 3, borderBottomColor: colors.primaryShadow },
});
