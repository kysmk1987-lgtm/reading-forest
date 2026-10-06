import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

export interface ProgressBarProps {
  /** 0–100 */
  percent: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ percent, color = colors.primary, height = 14, style }: ProgressBarProps) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: p }}
      style={[styles.track, { height, borderRadius: height }, style]}>
      <View style={[styles.fill, { width: `${p}%`, backgroundColor: color, borderRadius: height }]}>
        <View style={[styles.shine, { borderRadius: height }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', minWidth: 0 },
  shine: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    height: '35%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.pill,
  },
});
