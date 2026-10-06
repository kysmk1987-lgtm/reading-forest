import { Platform, type ViewStyle } from 'react-native';

/** Soft drop shadow that works on iOS, Android and web. */
export function softShadow(color = '#8B6B4A', elevation = 4): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${elevation}px ${elevation * 3}px ${color}2E` },
    default: {
      shadowColor: color,
      shadowOpacity: 0.16,
      shadowRadius: elevation * 1.5,
      shadowOffset: { width: 0, height: elevation },
      elevation,
    },
  })!;
}

/** Height of the "3D" bottom edge on puffy buttons and cards. */
export const PUFFY_DEPTH = 5;
