import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { colors, palette } from '@/theme';

/** Minimal touch/mouse slider (0–1) built on the responder system — works on web and native without a native module. */
export function VolumeSlider({
  value,
  onChange,
  disabled,
  color = palette.leafDeep,
  accessibilityLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  color?: string;
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const update = (e: GestureResponderEvent) => {
    if (!width) return;
    onChange(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)));
  };
  const pct = `${Math.round(value * 100)}%` as const;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(1, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
      style={[styles.hit, disabled && styles.disabled]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={update}
      onResponderMove={update}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct, backgroundColor: color }]} />
      </View>
      <View style={[styles.thumb, { left: pct, borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 32, justifyContent: 'center', flex: 1 },
  disabled: { opacity: 0.4 },
  track: { pointerEvents: 'none', height: 10, borderRadius: 5, backgroundColor: colors.backgroundAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  thumb: {
    pointerEvents: 'none',
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: palette.cream,
  },
});
