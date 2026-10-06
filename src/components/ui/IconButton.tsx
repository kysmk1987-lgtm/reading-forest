import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { tapFeedback } from '@/lib/feedback';
import { colors } from '@/theme';

export interface IconButtonProps {
  name: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  background?: string;
  size?: number;
}

export function IconButton({ name, onPress, accessibilityLabel, color = colors.text, background, size = 22 }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: background ?? colors.surface },
        pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
      ]}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
  },
});
