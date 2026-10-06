import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

const useNativeDriver = Platform.OS !== 'web';
const DROPS = [0.2, 0.38, 0.5, 0.62, 0.8, 0.3, 0.7];

/** Water drops falling over the garden; re-runs whenever `runKey` changes. */
export function WaterDrops({ runKey, width, height }: { runKey: number; width: number; height: number }) {
  const [fall] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!runKey) return;
    fall.setValue(0);
    const anim = Animated.timing(fall, { toValue: 1, duration: 1300, easing: Easing.in(Easing.quad), useNativeDriver });
    anim.start();
    return () => anim.stop();
  }, [runKey, fall]);

  if (!runKey) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      {DROPS.map((x, i) => {
        const start = (i % 3) * 0.12;
        const translateY = fall.interpolate({ inputRange: [0, start, 1], outputRange: [-30, -30, height * (0.55 + (i % 4) * 0.1)] });
        const opacity = fall.interpolate({ inputRange: [0, start, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.Text key={i} style={[styles.drop, { left: x * width - 10, opacity, transform: [{ translateY }] }]}>
            💧
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { pointerEvents: 'none', overflow: 'hidden', zIndex: 30 },
  drop: { position: 'absolute', top: 0, fontSize: 22 },
});
