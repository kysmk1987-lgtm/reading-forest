import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { AVATARS, isHood, type AvatarId, type PersonLook } from './avatars';

const useNativeDriver = Platform.OS !== 'web';
const INK = '#4A3A2E';
const BLUSH = '#F7B7C5';

/** Back layer: hair or hood drawn behind the face. */
function HeadBack({ cx, cy, r, look }: { cx: number; cy: number; r: number; look: PersonLook }) {
  const wear = look.wear ?? look.outfit;
  switch (look.headwear) {
    case 'bunnyHood':
      return (
        <G>
          <Ellipse cx={cx - r * 0.45} cy={cy - r * 1.35} rx={r * 0.3} ry={r * 0.75} fill={wear} transform={`rotate(-10 ${cx - r * 0.45} ${cy - r * 1.35})`} />
          <Ellipse cx={cx + r * 0.45} cy={cy - r * 1.35} rx={r * 0.3} ry={r * 0.75} fill={wear} transform={`rotate(10 ${cx + r * 0.45} ${cy - r * 1.35})`} />
          <Ellipse cx={cx - r * 0.45} cy={cy - r * 1.3} rx={r * 0.14} ry={r * 0.5} fill={BLUSH} transform={`rotate(-10 ${cx - r * 0.45} ${cy - r * 1.3})`} />
          <Ellipse cx={cx + r * 0.45} cy={cy - r * 1.3} rx={r * 0.14} ry={r * 0.5} fill={BLUSH} transform={`rotate(10 ${cx + r * 0.45} ${cy - r * 1.3})`} />
          <Circle cx={cx} cy={cy - r * 0.05} r={r * 1.22} fill={wear} />
          <Circle cx={cx} cy={cy - r * 0.05} r={r * 1.22} fill="none" stroke="rgba(91,70,54,0.12)" strokeWidth={r * 0.06} />
        </G>
      );
    case 'bearHood':
      return (
        <G>
          <Circle cx={cx - r * 0.85} cy={cy - r * 0.95} r={r * 0.38} fill={wear} />
          <Circle cx={cx + r * 0.85} cy={cy - r * 0.95} r={r * 0.38} fill={wear} />
          <Circle cx={cx - r * 0.85} cy={cy - r * 0.95} r={r * 0.2} fill="#E7C9A4" />
          <Circle cx={cx + r * 0.85} cy={cy - r * 0.95} r={r * 0.2} fill="#E7C9A4" />
          <Circle cx={cx} cy={cy - r * 0.05} r={r * 1.22} fill={wear} />
        </G>
      );
    case 'catHood':
      return (
        <G>
          {[-1, 1].map((s) => (
            <G key={s}>
              <Path
                d={`M${cx + s * r * 1.08} ${cy - r * 0.5} L${cx + s * r * 0.98} ${cy - r * 1.62} L${cx + s * r * 0.22} ${cy - r * 1.08} Z`}
                fill={wear}
                stroke={wear}
                strokeWidth={r * 0.16}
                strokeLinejoin="round"
              />
              <Path d={`M${cx + s * r * 0.98} ${cy - r * 0.8} L${cx + s * r * 0.93} ${cy - r * 1.42} L${cx + s * r * 0.5} ${cy - r * 1.1} Z`} fill={BLUSH} />
            </G>
          ))}
          <Circle cx={cx} cy={cy - r * 0.05} r={r * 1.22} fill={wear} />
          <Circle cx={cx} cy={cy - r * 0.05} r={r * 1.22} fill="none" stroke="rgba(91,70,54,0.12)" strokeWidth={r * 0.06} />
          {[-1, 1].map((s) => (
            <Path
              key={`w${s}`}
              d={`M${cx + s * r * 1.04} ${cy + r * 0.28} l${s * r * 0.14} ${-r * 0.05} M${cx + s * r * 1.04} ${cy + r * 0.44} l${s * r * 0.15} ${r * 0.03}`}
              stroke="rgba(74,58,46,0.55)"
              strokeWidth={r * 0.05}
              strokeLinecap="round"
            />
          ))}
        </G>
      );
    default:
      break;
  }
  switch (look.hairStyle) {
    case 'bob':
      return <Path d={`M${cx - r * 1.12} ${cy + r * 0.85} Q${cx - r * 1.25} ${cy - r * 1.25} ${cx} ${cy - r * 1.18} Q${cx + r * 1.25} ${cy - r * 1.25} ${cx + r * 1.12} ${cy + r * 0.85} Z`} fill={look.hair} />;
    case 'curly':
      return (
        <G>
          {[-1, -0.55, 0, 0.55, 1].map((k, i) => (
            <Circle key={i} cx={cx + k * r * 0.85} cy={cy - r * 0.75 + Math.abs(k) * r * 0.45} r={r * 0.48} fill={look.hair} />
          ))}
        </G>
      );
    case 'pigtails':
      return (
        <G>
          <Circle cx={cx - r * 1.15} cy={cy + r * 0.35} r={r * 0.42} fill={look.hair} />
          <Circle cx={cx + r * 1.15} cy={cy + r * 0.35} r={r * 0.42} fill={look.hair} />
          <Circle cx={cx - r * 0.92} cy={cy - r * 0.05} r={r * 0.14} fill={BLUSH} />
          <Circle cx={cx + r * 0.92} cy={cy - r * 0.05} r={r * 0.14} fill={BLUSH} />
          <Circle cx={cx} cy={cy - r * 0.12} r={r * 1.06} fill={look.hair} />
        </G>
      );
    case 'short':
      return <Circle cx={cx} cy={cy - r * 0.12} r={r * 1.07} fill={look.hair} />;
    case 'bun':
      return (
        <G>
          <Circle cx={cx} cy={cy - r * 0.12} r={r * 1.07} fill={look.hair} />
          <Circle cx={cx} cy={cy - r * 1.3} r={r * 0.44} fill={look.hair} />
          <Circle cx={cx - r * 0.14} cy={cy - r * 1.42} r={r * 0.12} fill="rgba(255,255,255,0.22)" />
          <Ellipse cx={cx} cy={cy - r * 1.14} rx={r * 0.34} ry={r * 0.11} fill={BLUSH} />
        </G>
      );
    case 'long':
      return (
        <G>
          <Path
            d={`M${cx - r * 1.12} ${cy + r * 1.05} Q${cx - r * 1.32} ${cy - r * 1.25} ${cx} ${cy - r * 1.18} Q${cx + r * 1.32} ${cy - r * 1.25} ${cx + r * 1.12} ${cy + r * 1.05} Q${cx + r * 0.9} ${cy + r * 1.22} ${cx + r * 0.72} ${cy + r * 1.02} Q${cx} ${cy + r * 0.6} ${cx - r * 0.72} ${cy + r * 1.02} Q${cx - r * 0.9} ${cy + r * 1.22} ${cx - r * 1.12} ${cy + r * 1.05} Z`}
            fill={look.hair}
          />
          <Circle cx={cx - r * 1.08} cy={cy + r * 1.0} r={r * 0.2} fill={look.hair} />
          <Circle cx={cx + r * 1.08} cy={cy + r * 1.0} r={r * 0.2} fill={look.hair} />
        </G>
      );
    default:
      return null;
  }
}

const CROWN = [
  { k: -0.86, petal: '#F7B7C5' },
  { k: -0.46, petal: '#FFFDF6' },
  { k: 0, petal: '#CDBBF0' },
  { k: 0.46, petal: '#FFFDF6' },
  { k: 0.86, petal: '#F7B7C5' },
];

/** Little daisies along the top of the head with leaves in between. */
function FlowerCrown({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const at = (k: number) => ({ x: cx + k * r * 1.0, y: cy - r * Math.sqrt(1 - k * k * 0.82) * 1.0 });
  return (
    <G>
      {[-0.66, -0.23, 0.23, 0.66].map((k) => {
        const { x, y } = at(k);
        return <Ellipse key={k} cx={x} cy={y} rx={r * 0.17} ry={r * 0.08} fill="#7DBF5E" transform={`rotate(${k * 60} ${x} ${y})`} />;
      })}
      {CROWN.map(({ k, petal }) => {
        const { x, y } = at(k);
        const size = k === 0 ? r * 0.17 : r * 0.14;
        return (
          <G key={k}>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              return <Circle key={i} cx={x + Math.cos(a) * size} cy={y + Math.sin(a) * size} r={size * 0.8} fill={petal} stroke="rgba(91,70,54,0.12)" strokeWidth={r * 0.02} />;
            })}
            <Circle cx={x} cy={y} r={size * 0.62} fill="#F9DC7A" />
          </G>
        );
      })}
    </G>
  );
}

/** Front layer: fringe, hats and the face details. */
function HeadFront({ cx, cy, r, look, reading }: { cx: number; cy: number; r: number; look: PersonLook; reading: boolean }) {
  const eyeY = cy + r * (reading ? 0.2 : 0.12);
  const eyeDx = r * 0.38;
  const fringe =
    look.hairStyle === 'short'
      ? `M${cx - r} ${cy - r * 0.05} Q${cx - r * 0.95} ${cy - r * 1.05} ${cx} ${cy - r * 1.02} Q${cx + r * 0.95} ${cy - r * 1.05} ${cx + r} ${cy - r * 0.05} Q${cx + r * 0.7} ${cy - r * 0.45} ${cx + r * 0.1} ${cy - r * 0.42} Q${cx - r * 0.6} ${cy - r * 0.62} ${cx - r} ${cy - r * 0.05} Z`
      : `M${cx - r * 1.02} ${cy + r * 0.05} Q${cx - r} ${cy - r * 1.08} ${cx} ${cy - r * 1.04} Q${cx + r} ${cy - r * 1.08} ${cx + r * 1.02} ${cy + r * 0.05} Q${cx + r * 0.75} ${cy - r * 0.3} ${cx + r * 0.35} ${cy - r * 0.32} Q${cx} ${cy - r * 0.48} ${cx - r * 0.35} ${cy - r * 0.32} Q${cx - r * 0.75} ${cy - r * 0.3} ${cx - r * 1.02} ${cy + r * 0.05} Z`;
  const hooded = isHood(look.headwear);
  const wear = look.wear ?? look.outfit;
  return (
    <G>
      {look.headwear === 'cap' ? (
        <G>
          <Path d={`M${cx - r * 0.98} ${cy - r * 0.3} Q${cx - r * 1.08} ${cy + r * 0.12} ${cx - r * 0.86} ${cy + r * 0.28}`} stroke={look.hair} strokeWidth={r * 0.22} strokeLinecap="round" fill="none" />
          <Path d={`M${cx + r * 0.98} ${cy - r * 0.3} Q${cx + r * 1.08} ${cy + r * 0.12} ${cx + r * 0.86} ${cy + r * 0.28}`} stroke={look.hair} strokeWidth={r * 0.22} strokeLinecap="round" fill="none" />
          <Path d={`M${cx - r * 1.04} ${cy - r * 0.3} Q${cx - r * 1.04} ${cy - r * 1.34} ${cx} ${cy - r * 1.32} Q${cx + r * 1.04} ${cy - r * 1.34} ${cx + r * 1.04} ${cy - r * 0.3} Z`} fill={wear} />
          <Path d={`M${cx} ${cy - r * 1.3} L${cx} ${cy - r * 0.42}`} stroke="rgba(255,255,255,0.45)" strokeWidth={r * 0.06} strokeLinecap="round" />
          <Circle cx={cx} cy={cy - r * 1.32} r={r * 0.13} fill={wear} stroke="rgba(255,255,255,0.6)" strokeWidth={r * 0.05} />
          <Ellipse cx={cx - r * 0.45} cy={cy - r * 0.82} rx={r * 0.2} ry={r * 0.11} fill="#8BCB6B" transform={`rotate(-30 ${cx - r * 0.45} ${cy - r * 0.82})`} />
          <Path
            d={`M${cx - r * 1.08} ${cy - r * 0.3} Q${cx - r * 0.1} ${cy - r * 0.56} ${cx + r * 1.55} ${cy - r * 0.2} Q${cx + r * 0.85} ${cy + r * 0.04} ${cx - r * 1.08} ${cy - r * 0.3} Z`}
            fill={wear}
          />
          <Path
            d={`M${cx - r * 1.08} ${cy - r * 0.3} Q${cx - r * 0.1} ${cy - r * 0.56} ${cx + r * 1.55} ${cy - r * 0.2} Q${cx + r * 0.85} ${cy + r * 0.04} ${cx - r * 1.08} ${cy - r * 0.3} Z`}
            fill="rgba(74,58,46,0.14)"
          />
        </G>
      ) : hooded ? (
        <Path
          d={`M${cx - r * 0.95} ${cy - r * 0.15} Q${cx - r * 0.7} ${cy - r * 0.95} ${cx} ${cy - r * 0.95} Q${cx + r * 0.7} ${cy - r * 0.95} ${cx + r * 0.95} ${cy - r * 0.15} Q${cx + r * 0.4} ${cy - r * 0.45} ${cx} ${cy - r * 0.42} Q${cx - r * 0.4} ${cy - r * 0.45} ${cx - r * 0.95} ${cy - r * 0.15} Z`}
          fill={look.hair}
        />
      ) : look.headwear === 'beanie' ? (
        <G>
          <Path d={`M${cx - r * 1.05} ${cy - r * 0.25} Q${cx - r * 1.05} ${cy - r * 1.35} ${cx} ${cy - r * 1.35} Q${cx + r * 1.05} ${cy - r * 1.35} ${cx + r * 1.05} ${cy - r * 0.25} Z`} fill={look.wear} />
          <Rect x={cx - r * 1.1} y={cy - r * 0.5} width={r * 2.2} height={r * 0.42} rx={r * 0.2} fill="#FFFDF6" opacity={0.9} />
          <Circle cx={cx} cy={cy - r * 1.42} r={r * 0.28} fill="#FFFDF6" />
          <Path d={`M${cx - r * 0.75} ${cy - r * 0.32} Q${cx - r * 0.95} ${cy + r * 0.1} ${cx - r * 0.85} ${cy + r * 0.25}`} stroke={look.hair} strokeWidth={r * 0.2} strokeLinecap="round" fill="none" />
          <Path d={`M${cx + r * 0.75} ${cy - r * 0.32} Q${cx + r * 0.95} ${cy + r * 0.1} ${cx + r * 0.85} ${cy + r * 0.25}`} stroke={look.hair} strokeWidth={r * 0.2} strokeLinecap="round" fill="none" />
        </G>
      ) : (
        <Path d={fringe} fill={look.hair} />
      )}
      {look.headwear === 'flowerCrown' ? <FlowerCrown cx={cx} cy={cy} r={r} /> : null}
      {reading ? (
        <G>
          <Path d={`M${cx - eyeDx - r * 0.13} ${eyeY} Q${cx - eyeDx} ${eyeY + r * 0.13} ${cx - eyeDx + r * 0.13} ${eyeY}`} stroke={INK} strokeWidth={r * 0.08} strokeLinecap="round" fill="none" />
          <Path d={`M${cx + eyeDx - r * 0.13} ${eyeY} Q${cx + eyeDx} ${eyeY + r * 0.13} ${cx + eyeDx + r * 0.13} ${eyeY}`} stroke={INK} strokeWidth={r * 0.08} strokeLinecap="round" fill="none" />
        </G>
      ) : (
        <G>
          <Ellipse cx={cx - eyeDx} cy={eyeY} rx={r * 0.1} ry={r * 0.13} fill={INK} />
          <Ellipse cx={cx + eyeDx} cy={eyeY} rx={r * 0.1} ry={r * 0.13} fill={INK} />
          <Circle cx={cx - eyeDx + r * 0.04} cy={eyeY - r * 0.05} r={r * 0.035} fill="#FFFFFF" />
          <Circle cx={cx + eyeDx + r * 0.04} cy={eyeY - r * 0.05} r={r * 0.035} fill="#FFFFFF" />
        </G>
      )}
      {look.glasses ? (
        <G>
          <Circle cx={cx - eyeDx} cy={eyeY} r={r * 0.25} fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={r * 0.06} />
          <Circle cx={cx + eyeDx} cy={eyeY} r={r * 0.25} fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={r * 0.06} />
          <Path d={`M${cx - eyeDx + r * 0.25} ${eyeY} Q${cx} ${eyeY - r * 0.1} ${cx + eyeDx - r * 0.25} ${eyeY}`} stroke={INK} strokeWidth={r * 0.06} fill="none" />
        </G>
      ) : null}
      <Circle cx={cx - r * 0.6} cy={cy + r * 0.42} r={r * 0.14} fill={BLUSH} opacity={0.75} />
      <Circle cx={cx + r * 0.6} cy={cy + r * 0.42} r={r * 0.14} fill={BLUSH} opacity={0.75} />
      <Path d={`M${cx - r * 0.13} ${cy + r * 0.45} Q${cx} ${cy + r * 0.58} ${cx + r * 0.13} ${cy + r * 0.45}`} stroke={INK} strokeWidth={r * 0.07} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Head({ cx, cy, r, look, reading = false }: { cx: number; cy: number; r: number; look: PersonLook; reading?: boolean }) {
  return (
    <G>
      <HeadBack cx={cx} cy={cy} r={r} look={look} />
      <Circle cx={cx} cy={cy} r={r} fill={look.skin} />
      <HeadFront cx={cx} cy={cy} r={r} look={look} reading={reading} />
    </G>
  );
}

/** Head-and-shoulders portrait for the profile card and the picker. */
export const AvatarPortrait = memo(function AvatarPortrait({ id, size = 64 }: { id: AvatarId; size?: number }) {
  const look = AVATARS[id].person;
  if (!look) {
    return (
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.56, lineHeight: size * 0.7 }}>🌱</Text>
      </View>
    );
  }
  const body = isHood(look.headwear) ? (look.wear ?? look.outfit) : look.outfit;
  const tallEars = look.headwear === 'bunnyHood';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M16 102 Q18 72 50 70 Q82 72 84 102 Z" fill={body} />
      <Path d="M40 72 Q50 82 60 72" stroke="rgba(91,70,54,0.18)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Head cx={50} cy={tallEars ? 52 : 46} r={tallEars ? 20 : 22} look={look} />
    </Svg>
  );
});

/** Sitting figure holding an open book (forest scene). Null for the sprout. */
export const AvatarReading = memo(function AvatarReading({ id, size = 40 }: { id: AvatarId; size?: number }) {
  const look = AVATARS[id].person;
  if (!look) return null;
  const body = isHood(look.headwear) ? (look.wear ?? look.outfit) : look.outfit;
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Ellipse cx={30} cy={56.5} rx={17} ry={3.2} fill="rgba(91,70,54,0.18)" />
      <Ellipse cx={22.5} cy={53.5} rx={7} ry={3.8} fill={look.outfitDeep} />
      <Ellipse cx={37.5} cy={53.5} rx={7} ry={3.8} fill={look.outfitDeep} />
      <Ellipse cx={16.5} cy={54.5} rx={3} ry={2.2} fill="#8A5E3B" />
      <Ellipse cx={43.5} cy={54.5} rx={3} ry={2.2} fill="#8A5E3B" />
      <Path d="M17 53 Q15.5 33 30 31.5 Q44.5 33 43 53 Z" fill={body} />
      <Path d="M30 40.5 L16.5 37.5 L17.5 50 L30 52.5 L42.5 50 L43.5 37.5 Z" fill={look.book} />
      <Path d="M30 41 L18.5 38.6 L19.2 48.8 L30 51 Z" fill="#FFFDF6" />
      <Path d="M30 41 L41.5 38.6 L40.8 48.8 L30 51 Z" fill="#F4EAD3" />
      <Path d="M21 42 L27.5 43.3 M21.2 44.8 L27.5 46.1 M32.5 43.3 L39 42 M32.5 46.1 L38.8 44.8" stroke="#D9C9AC" strokeWidth={0.7} strokeLinecap="round" />
      <Circle cx={17.4} cy={45} r={2.6} fill={look.skin} />
      <Circle cx={42.6} cy={45} r={2.6} fill={look.skin} />
      <Head cx={30} cy={21} r={12} look={look} reading />
    </Svg>
  );
});

/** Reader sitting in a tree's shade with a gentle breathing bob. */
export function AvatarReader({ id, size = 40 }: { id: AvatarId; size?: number }) {
  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const easing = Easing.inOut(Easing.sin);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing, useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing, useNativeDriver }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bob]);
  if (!AVATARS[id].person) return null;
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] });
  return (
    <Animated.View style={[styles.reader, { width: size, height: size, transform: [{ translateY }, { rotate }] }]}>
      <AvatarReading id={id} size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  reader: { transformOrigin: '50% 90%' },
});
