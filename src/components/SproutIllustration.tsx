import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { palette } from '@/theme';

/** Placeholder for the full forest view: a small garden mound with a swaying sprout. */
export function SproutIllustration({ emoji = '🌱', size = 200 }: { emoji?: string; size?: number }) {
  const [sway] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1600, easing, useNativeDriver }),
        Animated.timing(sway, { toValue: -1, duration: 1600, easing, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sway]);

  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const gardenW = size;
  const gardenH = size * 0.42;

  return (
    <View style={[styles.wrap, { width: size, height: size * 0.85 }]}>
      <AppText style={[styles.cloud, { left: 0, top: 6 }]}>☁️</AppText>
      <AppText style={[styles.cloud, { right: 4, top: 26, fontSize: 18 }]}>☁️</AppText>
      <AppText style={[styles.deco, { left: size * 0.12, bottom: gardenH * 0.55 }]}>🌼</AppText>
      <AppText style={[styles.deco, { right: size * 0.14, bottom: gardenH * 0.6 }]}>🍄</AppText>
      <View style={[styles.garden, { width: gardenW, height: gardenH, borderRadius: gardenW }]}>
        <View style={[styles.grass, { borderRadius: gardenW, height: gardenH * 0.62 }]} />
      </View>
      <Animated.View style={[styles.sprout, { bottom: gardenH * 0.45, transform: [{ rotate }] }]}>
        <AppText style={{ fontSize: size * 0.32, lineHeight: size * 0.4 }}>{emoji}</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  garden: { backgroundColor: palette.woodDeep, overflow: 'hidden', alignItems: 'center' },
  grass: { width: '100%', backgroundColor: palette.leaf, borderBottomWidth: 6, borderBottomColor: palette.leafDeep },
  sprout: { position: 'absolute', alignItems: 'center', transformOrigin: 'bottom' },
  cloud: { position: 'absolute', fontSize: 24, opacity: 0.85 },
  deco: { position: 'absolute', fontSize: 20, zIndex: 2 },
});
