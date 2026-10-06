import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

const useNativeDriver = Platform.OS !== 'web';
const PARTICLES = [
  [-22, -18, 4],
  [-12, -28, 3],
  [0, -32, 4.5],
  [12, -26, 3],
  [22, -16, 4],
  [-16, -8, 2.5],
  [16, -6, 2.5],
] as const;

/** Shovel dig + flying soil when a tree is transplanted. Re-runs whenever `runKey` changes. */
export function DirtBurst({ x, y, runKey }: { x: number; y: number; runKey: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    t.setValue(0);
    const anim = Animated.timing(t, { toValue: 1, duration: 750, easing: Easing.out(Easing.quad), useNativeDriver });
    anim.start();
    return () => anim.stop();
  }, [runKey, t]);

  const fade = t.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] });
  const dig = t.interpolate({ inputRange: [0, 0.35, 0.6, 1], outputRange: ['-35deg', '12deg', '-6deg', '-6deg'] });
  const lift = t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [-10, 4, -14] });
  return (
    <View style={[styles.wrap, { left: x - 40, top: y - 60 }]}>
      {PARTICLES.map(([dx, dy, r], i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: i % 2 ? '#B88E62' : '#8A5E3B',
              opacity: fade,
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy, dy + 14] }) },
              ],
            },
          ]}
        />
      ))}
      <Animated.View style={[styles.shovel, { opacity: fade, transform: [{ translateY: lift }, { rotate: dig }] }]}>
        <Svg width={34} height={46} viewBox="0 0 34 46">
          <G>
            <Rect x={14.5} y={2} width={5} height={24} rx={2} fill="#A07B55" />
            <Rect x={10} y={1} width={14} height={5} rx={2.5} fill="#8A5E3B" />
            <Path d="M8 25 L26 25 L25 36 Q17 46 9 36 Z" fill="#B9C3CC" />
            <Path d="M17 25 L26 25 L25 36 Q21 41 17 42 Z" fill="#98A4AF" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { pointerEvents: 'none', position: 'absolute', width: 80, height: 80, zIndex: 15 },
  particle: { position: 'absolute', left: 36, top: 58 },
  shovel: { position: 'absolute', left: 30, top: 6, transformOrigin: '50% 90%' },
});
