import { StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export const dateFieldStyles = StyleSheet.create({
  box: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
