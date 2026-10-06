import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

export type Weather = 'clear' | 'rain' | 'snow';

const useNativeDriver = Platform.OS !== 'web';
const COUNT = 18;

function Particle({ kind, width, height, index }: { kind: 'rain' | 'snow'; width: number; height: number; index: number }) {
  const [fall] = useState(() => new Animated.Value(0));
  const seed = (Math.sin(index * 91.7) + 1) / 2;
  const left = ((index + seed) / COUNT) * width;
  const duration = kind === 'rain' ? 900 + seed * 500 : 4200 + seed * 2600;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(seed * duration),
      Animated.loop(Animated.timing(fall, { toValue: 1, duration, easing: Easing.linear, useNativeDriver })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [fall, duration, seed]);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-20, height] });
  const translateX = fall.interpolate({ inputRange: [0, 0.5, 1], outputRange: kind === 'snow' ? [0, 8, -4] : [0, -6, -12] });
  return (
    <Animated.View
      style={[kind === 'rain' ? styles.rain : styles.snow, { left, transform: [{ translateY }, { translateX }, { rotate: kind === 'rain' ? '12deg' : '0deg' }] }]}
    />
  );
}

/** Lightweight falling rain/snow overlay (premium garden weather). */
export function WeatherLayer({ kind, width, height }: { kind: 'rain' | 'snow'; width: number; height: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      {Array.from({ length: COUNT }, (_, i) => (
        <Particle key={`${kind}-${i}`} kind={kind} width={width} height={height} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { pointerEvents: 'none', overflow: 'hidden' },
  rain: { position: 'absolute', top: 0, width: 2, height: 14, borderRadius: 1, backgroundColor: 'rgba(95,180,217,0.65)' },
  snow: { position: 'absolute', top: 0, width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.95)' },
});
