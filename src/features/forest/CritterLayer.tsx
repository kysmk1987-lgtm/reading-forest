import { memo, useEffect, useState, type ReactElement } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import type { CritterKind } from './critters';

const useNativeDriver = Platform.OS !== 'web';

export interface CritterSpot {
  x: number;
  y: number;
}

type ArtProps = { size: number };

function seeded(i: number) {
  return (Math.sin((i + 1) * 78.233) + 1) / 2;
}

function useAnimatedValue(initial = 0) {
  return useState(() => new Animated.Value(initial))[0];
}

// ─── Art (static SVG, also used in the picker chips) ────────────────────────
export const ButterflyArt = memo(function ButterflyArt({ size }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Ellipse cx={6} cy={7} rx={5} ry={4.4} fill="#F7B7C5" />
      <Ellipse cx={14} cy={7} rx={5} ry={4.4} fill="#F7B7C5" />
      <Ellipse cx={7} cy={13.5} rx={3.6} ry={3} fill="#F9DC7A" />
      <Ellipse cx={13} cy={13.5} rx={3.6} ry={3} fill="#F9DC7A" />
      <Circle cx={6} cy={7} r={1.5} fill="#FFFDF6" />
      <Circle cx={14} cy={7} r={1.5} fill="#FFFDF6" />
      <Ellipse cx={10} cy={10.5} rx={1.2} ry={5} fill="#5B4636" />
      <Path d="M9.6 5.8 Q8.4 3 7 2.4 M10.4 5.8 Q11.6 3 13 2.4" stroke="#5B4636" strokeWidth={0.7} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

export const LadybugArt = memo(function LadybugArt({ size }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M5 15 L3.6 17 M9 15.6 L8.6 18 M13 15.4 L13.8 17.8" stroke="#3D3A36" strokeWidth={1} strokeLinecap="round" />
      <Circle cx={16} cy={11.6} r={3} fill="#3D3A36" />
      <Circle cx={17} cy={10.8} r={0.7} fill="#FFFDF6" />
      <Path d="M2 15 Q2 5.5 9.5 5.5 Q16 5.5 16 15 Z" fill="#E77B6E" />
      <Path d="M9.5 5.5 L9.5 15" stroke="#3D3A36" strokeWidth={0.8} />
      <Circle cx={6} cy={10} r={1.4} fill="#3D3A36" />
      <Circle cx={12.6} cy={9.4} r={1.3} fill="#3D3A36" />
      <Circle cx={5.4} cy={13.4} r={1} fill="#3D3A36" />
      <Circle cx={13.4} cy={13.2} r={1} fill="#3D3A36" />
      <Ellipse cx={6.4} cy={7.6} rx={1.6} ry={0.8} fill="#FFFDF6" opacity={0.6} />
    </Svg>
  );
});

export const FrogArt = memo(function FrogArt({ size }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Ellipse cx={10} cy={18.4} rx={7} ry={1.3} fill="rgba(91,70,54,0.16)" />
      <Ellipse cx={4.6} cy={16} rx={3.2} ry={2} fill="#6FB05A" />
      <Ellipse cx={15.4} cy={16} rx={3.2} ry={2} fill="#6FB05A" />
      <Ellipse cx={10} cy={12.6} rx={7} ry={5.4} fill="#8BCB6B" />
      <Ellipse cx={10} cy={14.4} rx={4.2} ry={2.8} fill="#DDF1CF" />
      <Circle cx={6} cy={7.4} r={2.8} fill="#8BCB6B" />
      <Circle cx={14} cy={7.4} r={2.8} fill="#8BCB6B" />
      <Circle cx={6} cy={7.2} r={1.7} fill="#FFFDF6" />
      <Circle cx={14} cy={7.2} r={1.7} fill="#FFFDF6" />
      <Circle cx={6.3} cy={7.4} r={0.9} fill="#3D3A36" />
      <Circle cx={13.7} cy={7.4} r={0.9} fill="#3D3A36" />
      <Path d="M7.4 11.2 Q10 12.8 12.6 11.2" stroke="#4C8A47" strokeWidth={0.8} fill="none" strokeLinecap="round" />
      <Circle cx={5} cy={10.8} r={1} fill="#F7B7C5" opacity={0.8} />
      <Circle cx={15} cy={10.8} r={1} fill="#F7B7C5" opacity={0.8} />
    </Svg>
  );
});

export const BeeArt = memo(function BeeArt({ size }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Ellipse cx={8} cy={6.4} rx={3.6} ry={2.6} fill="#DDF2FB" opacity={0.9} />
      <Ellipse cx={12.4} cy={5.8} rx={3.2} ry={2.4} fill="#DDF2FB" opacity={0.9} />
      <Ellipse cx={10} cy={11.6} rx={6.4} ry={4.6} fill="#F9DC7A" />
      <Path d="M8 7.4 Q7 11.6 8 15.8 M11.6 7.2 Q10.6 11.6 11.6 16" stroke="#5B4636" strokeWidth={1.6} fill="none" />
      <Path d="M3.4 11.6 L1.8 12" stroke="#5B4636" strokeWidth={1} strokeLinecap="round" />
      <Circle cx={15.6} cy={10.8} r={0.8} fill="#3D3A36" />
      <Circle cx={15} cy={13} r={0.8} fill="#F7B7C5" />
    </Svg>
  );
});

export const DragonflyArt = memo(function DragonflyArt({ size }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Ellipse cx={6.6} cy={6} rx={5} ry={1.8} fill="#DDF2FB" opacity={0.95} transform="rotate(-14 6.6 6)" />
      <Ellipse cx={13.4} cy={6} rx={5} ry={1.8} fill="#DDF2FB" opacity={0.95} transform="rotate(14 13.4 6)" />
      <Ellipse cx={7} cy={9} rx={4.4} ry={1.5} fill="#DDF2FB" opacity={0.85} transform="rotate(12 7 9)" />
      <Ellipse cx={13} cy={9} rx={4.4} ry={1.5} fill="#DDF2FB" opacity={0.85} transform="rotate(-12 13 9)" />
      <Path d="M10 8 L10 18.6" stroke="#5FB4D9" strokeWidth={1.8} strokeLinecap="round" />
      <Ellipse cx={10} cy={7.6} rx={1.8} ry={2.2} fill="#5FB4D9" />
      <Circle cx={9} cy={5.6} r={1.2} fill="#3D7FA0" />
      <Circle cx={11} cy={5.6} r={1.2} fill="#3D7FA0" />
    </Svg>
  );
});

export const FireflyArt = memo(function FireflyArt({ size }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={8.5} fill="#FFF3A6" opacity={0.35} />
      <Circle cx={10} cy={10} r={5} fill="#FFE97A" opacity={0.7} />
      <Circle cx={10} cy={10} r={2.6} fill="#FFFBE0" />
    </Svg>
  );
});

export function CritterIcon({ kind, size = 16 }: { kind: CritterKind; size?: number }) {
  switch (kind) {
    case 'butterfly':
      return <ButterflyArt size={size} />;
    case 'ladybug':
      return <LadybugArt size={size} />;
    case 'frog':
      return <FrogArt size={size} />;
    case 'bee':
      return <BeeArt size={size} />;
    case 'dragonfly':
      return <DragonflyArt size={size} />;
    case 'firefly':
      return <FireflyArt size={size} />;
  }
}

// ─── Movers ─────────────────────────────────────────────────────────────────
type MoverProps = { spot: CritterSpot; index: number };

function place(spot: CritterSpot, size: number, lift = 0) {
  return { left: spot.x - size / 2, top: spot.y - size - lift, width: size, height: size };
}

/** Lazy loops over the flowers with flapping wings. */
function Butterfly({ spot, index }: MoverProps) {
  const t = useAnimatedValue();
  const flap = useAnimatedValue();
  const seed = seeded(index);
  useEffect(() => {
    const fly = Animated.loop(Animated.timing(t, { toValue: 1, duration: 7000 + seed * 3000, easing: Easing.inOut(Easing.sin), useNativeDriver }));
    const wings = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: 180, useNativeDriver }),
        Animated.timing(flap, { toValue: 0, duration: 180, useNativeDriver }),
      ]),
    );
    const start = setTimeout(() => {
      fly.start();
      wings.start();
    }, seed * 1200);
    return () => {
      clearTimeout(start);
      fly.stop();
      wings.stop();
    };
  }, [t, flap, seed]);
  const dir = index % 2 ? -1 : 1;
  const translateX = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 34 * dir, 12 * dir, -26 * dir, 0] });
  const translateY = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -14, -30, -12, 0] });
  const scaleX = flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  return (
    <Animated.View style={[styles.abs, place(spot, 18, 18), { transform: [{ translateX }, { translateY }] }]}>
      <Animated.View style={{ transform: [{ scaleX }] }}>
        <ButterflyArt size={18} />
      </Animated.View>
    </Animated.View>
  );
}

/** Crawls back and forth along the tile edge, turning around at each end. */
function Ladybug({ spot, index }: MoverProps) {
  const t = useAnimatedValue();
  const flip = useAnimatedValue(1);
  const seed = seeded(index + 4);
  useEffect(() => {
    const walk = 3600 + seed * 1600;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(flip, { toValue: 1, duration: 0, useNativeDriver }),
        Animated.timing(t, { toValue: 1, duration: walk, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.delay(900 + seed * 900),
        Animated.timing(flip, { toValue: -1, duration: 0, useNativeDriver }),
        Animated.timing(t, { toValue: 0, duration: walk, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.delay(700 + seed * 700),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [t, flip, seed]);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] });
  return (
    <Animated.View style={[styles.abs, place(spot, 12), { transform: [{ translateX }, { translateY }, { scaleX: flip }] }]}>
      <LadybugArt size={12} />
    </Animated.View>
  );
}

/** Sits, then hops forward and back with a little squash. */
function Frog({ spot, index }: MoverProps) {
  const hop = useAnimatedValue();
  const along = useAnimatedValue();
  const flip = useAnimatedValue(1);
  const seed = seeded(index + 9);
  useEffect(() => {
    const jump = (to: number) =>
      Animated.parallel([
        Animated.timing(along, { toValue: to, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 210, easing: Easing.out(Easing.quad), useNativeDriver }),
          Animated.timing(hop, { toValue: 0, duration: 210, easing: Easing.in(Easing.quad), useNativeDriver }),
        ]),
      ]);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(1800 + seed * 2200),
        Animated.timing(flip, { toValue: 1, duration: 0, useNativeDriver }),
        jump(0.5),
        Animated.delay(500),
        jump(1),
        Animated.delay(2000 + seed * 1500),
        Animated.timing(flip, { toValue: -1, duration: 0, useNativeDriver }),
        jump(0.5),
        Animated.delay(500),
        jump(0),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [hop, along, flip, seed]);
  const translateX = along.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });
  const translateY = Animated.add(
    along.interpolate({ inputRange: [0, 1], outputRange: [7, -7] }),
    hop.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
  );
  const scaleY = hop.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 0.86, 1.08] });
  return (
    <Animated.View style={[styles.abs, place(spot, 20), { transform: [{ translateX }, { translateY }, { scaleX: flip }, { scaleY }] }]}>
      <FrogArt size={20} />
    </Animated.View>
  );
}

const CIRCLE = Array.from({ length: 9 }, (_, i) => i / 8);

/** Buzzes in small ovals over the grass with a quick bob. */
function Bee({ spot, index }: MoverProps) {
  const t = useAnimatedValue();
  const bob = useAnimatedValue();
  const seed = seeded(index + 2);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2600 + seed * 1400, easing: Easing.linear, useNativeDriver }));
    const buzz = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 140, useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 140, useNativeDriver }),
      ]),
    );
    loop.start();
    buzz.start();
    return () => {
      loop.stop();
      buzz.stop();
    };
  }, [t, bob, seed]);
  const dir = index % 2 ? -1 : 1;
  const translateX = t.interpolate({ inputRange: CIRCLE, outputRange: CIRCLE.map((p) => Math.cos(p * Math.PI * 2) * 22 * dir) });
  const orbitY = t.interpolate({ inputRange: CIRCLE, outputRange: CIRCLE.map((p) => Math.sin(p * Math.PI * 2) * 9) });
  const translateY = Animated.add(orbitY, bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }));
  const scaleX = t.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [-dir, -dir, dir, dir] });
  return (
    <Animated.View style={[styles.abs, place(spot, 14, 14), { transform: [{ translateX }, { translateY }, { scaleX }] }]}>
      <BeeArt size={14} />
    </Animated.View>
  );
}

const DART: [number, number][] = [
  [0, 0],
  [36, -10],
  [-6, -22],
  [-34, -4],
];

/** Hovers, then darts to the next spot. */
function Dragonfly({ spot, index }: MoverProps) {
  const t = useAnimatedValue();
  const hover = useAnimatedValue();
  const seed = seeded(index + 6);
  useEffect(() => {
    const steps = DART.map((_, i) =>
      Animated.sequence([
        Animated.delay(1400 + seed * 900),
        Animated.timing(t, { toValue: i + 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver }),
      ]),
    );
    const anim = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver }), ...steps]));
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(hover, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(hover, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    anim.start();
    bob.start();
    return () => {
      anim.stop();
      bob.stop();
    };
  }, [t, hover, seed]);
  const range = [...DART, DART[0]];
  const input = range.map((_, i) => i);
  const translateX = t.interpolate({ inputRange: input, outputRange: range.map(([x]) => x) });
  const translateY = Animated.add(
    t.interpolate({ inputRange: input, outputRange: range.map(([, y]) => y) }),
    hover.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
  );
  return (
    <Animated.View style={[styles.abs, place(spot, 22, 24), { transform: [{ translateX }, { translateY }] }]}>
      <DragonflyArt size={22} />
    </Animated.View>
  );
}

/** Softly blinking lights drifting just above the grass. */
function Firefly({ spot, index }: MoverProps) {
  const glow = useAnimatedValue();
  const drift = useAnimatedValue();
  const seed = seeded(index + 11);
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(seed * 1600),
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2400 + seed * 1200, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(drift, { toValue: 0, duration: 2400 + seed * 1200, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    blink.start();
    float.start();
    return () => {
      blink.stop();
      float.stop();
    };
  }, [glow, drift, seed]);
  const opacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-8 * (seed - 0.3), 10 * seed] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10 - seed * 8] });
  const offset = { x: spot.x + (seed - 0.5) * 30, y: spot.y + (seeded(index + 20) - 0.5) * 14 };
  return (
    <Animated.View style={[styles.abs, place(offset, 12, 8), { opacity, transform: [{ translateX }, { translateY }] }]}>
      <FireflyArt size={12} />
    </Animated.View>
  );
}

const MOVERS: Record<CritterKind, { count: number; Component: (p: MoverProps) => ReactElement }> = {
  butterfly: { count: 2, Component: Butterfly },
  ladybug: { count: 2, Component: Ladybug },
  frog: { count: 2, Component: Frog },
  bee: { count: 2, Component: Bee },
  dragonfly: { count: 2, Component: Dragonfly },
  firefly: { count: 6, Component: Firefly },
};

/** Fireflies are tiny, so they come in a swarm; with company the swarm shrinks to keep the scene (and the frame budget) light. */
function countFor(kind: CritterKind, kinds: number) {
  return kind === 'firefly' && kinds > 1 ? 3 : MOVERS[kind].count;
}

/** Ambient creatures at the front of the garden (pointer-transparent, transforms only). */
export function CritterLayer({ kinds, spots }: { kinds: readonly CritterKind[]; spots: CritterSpot[] }) {
  if (!kinds.length || !spots.length) return null;
  let next = 0;
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      {kinds.map((kind) => {
        const { Component } = MOVERS[kind];
        return Array.from({ length: countFor(kind, kinds.length) }, (_, i) => {
          const slot = next++;
          return <Component key={`${kind}-${i}`} spot={spots[slot % spots.length]} index={slot} />;
        });
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { pointerEvents: 'none' },
  abs: { position: 'absolute' },
});