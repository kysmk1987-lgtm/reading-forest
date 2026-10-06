import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, softShadow, spacing } from '@/theme';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Background tint; defaults to cream. */
  tint?: string;
  /** Color of the chunky bottom edge. */
  edgeColor?: string;
  padded?: boolean;
}

export function Card({ children, style, tint, edgeColor, padded = true }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tint ?? colors.surface, borderBottomColor: edgeColor ?? colors.border },
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    ...softShadow(),
  },
  padded: { padding: spacing.lg },
});
