import type { TextStyle } from 'react-native';

export const fonts = {
  display: 'Jua_400Regular',
  body: 'Jua_400Regular',
  latin: 'Nunito_800ExtraBold',
  latinRegular: 'Nunito_600SemiBold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 19,
  xl: 23,
  xxl: 28,
  hero: 34,
} as const;

export const textStyles = {
  hero: { fontFamily: fonts.display, fontSize: fontSize.hero },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl },
  subtitle: { fontFamily: fonts.display, fontSize: fontSize.lg },
  body: { fontFamily: fonts.body, fontSize: fontSize.md },
  caption: { fontFamily: fonts.body, fontSize: fontSize.sm },
  tiny: { fontFamily: fonts.body, fontSize: fontSize.xs },
  number: { fontFamily: fonts.latin, fontSize: fontSize.md },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textStyles;
