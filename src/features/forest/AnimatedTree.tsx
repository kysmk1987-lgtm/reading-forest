import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

import { stageIndex } from '@/features/library/growth';

import { TreeGraphic, type TreeGraphicProps } from './TreeGraphic';

const useNativeDriver = Platform.OS !== 'web';

export interface AnimatedTreeProps extends TreeGraphicProps {
  /** Idle sway amplitude in degrees (0 disables). */
  swayDegrees?: number;
  /** Delay before the sway starts so neighbouring trees don't move in lockstep. */
  phaseMs?: number;
}

/** Tree with a gentle idle sway and a springy "pop" whenever it reaches a higher stage. */
export function AnimatedTree({ swayDegrees = 3, phaseMs = 0, ...tree }: AnimatedTreeProps) {
  const [sway] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const prevStage = useRef(tree.stage);

  useEffect(() => {
    if (!swayDegrees || tree.variant === 'pot') return;
    const easing = Easing.inOut(Easing.sin);
    const anim = Animated.sequence([
      Animated.delay(phaseMs),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sway, { toValue: 1, duration: 1800, easing, useNativeDriver }),
          Animated.timing(sway, { toValue: -1, duration: 1800, easing, useNativeDriver }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [sway, swayDegrees, phaseMs, tree.variant]);

  useEffect(() => {
    if (stageIndex(tree.stage) > stageIndex(prevStage.current)) {
      pop.setValue(0.55);
      Animated.spring(pop, { toValue: 1, friction: 3.2, tension: 80, useNativeDriver }).start();
    }
    prevStage.current = tree.stage;
  }, [tree.stage, pop]);

  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: [`${-swayDegrees}deg`, `${swayDegrees}deg`] });
  const size = tree.size ?? 96;
  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ rotate }, { scale: pop }] }]}>
      <TreeGraphic {...tree} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { transformOrigin: '50% 92%' },
});
