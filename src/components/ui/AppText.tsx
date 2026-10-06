import { Text, type TextProps } from 'react-native';

import { colors, textStyles, type TextVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  center?: boolean;
}

export function AppText({ variant = 'body', color, muted, center, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        textStyles[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
