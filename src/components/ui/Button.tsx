import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tapFeedback } from '@/lib/feedback';
import { colors, fontSize, palette, PUFFY_DEPTH, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'wood' | 'soft' | 'danger' | 'sky' | 'kakao';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, { face: string; edge: string; text: string }> = {
  primary: { face: colors.primary, edge: colors.primaryShadow, text: colors.textOnPrimary },
  wood: { face: palette.wood, edge: palette.woodShadow, text: colors.textOnPrimary },
  sky: { face: palette.sky, edge: palette.skyDeep, text: colors.textOnPrimary },
  soft: { face: palette.cream, edge: '#E2D4B8', text: colors.text },
  danger: { face: colors.danger, edge: colors.dangerShadow, text: colors.textOnPrimary },
  // Kakao login brand colours (yellow + dark brown label).
  kakao: { face: '#FEE500', edge: '#D8BF00', text: '#3C1E1E' },
};

const SIZES: Record<Size, { height: number; font: number; padX: number }> = {
  sm: { height: 38, font: fontSize.sm, padX: spacing.md },
  md: { height: 50, font: fontSize.md, padX: spacing.lg },
  lg: { height: 58, font: fontSize.lg, padX: spacing.xl },
};

export interface ButtonProps {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
}

/** Puffy 3D button: the face sits on a darker edge and sinks into it while pressed. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  fullWidth,
  style,
  children,
  accessibilityLabel,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const depth = size === 'sm' ? PUFFY_DEPTH - 1 : PUFFY_DEPTH;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={inactive}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        tapFeedback();
        onPress?.();
      }}
      style={[
        styles.edge,
        { backgroundColor: v.edge, paddingBottom: depth, borderRadius: radius.lg },
        fullWidth && styles.fullWidth,
        inactive && styles.disabled,
        style,
      ]}>
      <View
        style={[
          styles.face,
          {
            backgroundColor: v.face,
            minHeight: s.height,
            paddingHorizontal: s.padX,
            borderRadius: radius.lg,
            transform: [{ translateY: pressed ? depth - 1 : 0 }],
          },
        ]}>
        <View style={styles.highlight} />
        {loading ? (
          <ActivityIndicator color={v.text} />
        ) : (
          <>
            {icon}
            {label ? (
              <AppText style={{ fontSize: s.font, color: v.text }} numberOfLines={1}>
                {label}
              </AppText>
            ) : null}
            {children}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    height: '38%',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    pointerEvents: 'none',
  },
  disabled: { opacity: 0.5 },
});
