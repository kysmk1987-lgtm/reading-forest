import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Persona } from './personas';

/** Little pastel scene per persona: sky + celestial body + hills + a tree and an open book. */
export function PersonaArt({ persona, size }: { persona: Persona; size: number }) {
  const gid = `pa${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { bg, accent } = persona.colors;
  const dark = persona.scene === 'moon' || persona.scene === 'stars';
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bg[0]} />
          <Stop offset="1" stopColor={bg[1]} />
        </LinearGradient>
        <ClipPath id={`${gid}c`}>
          <Circle cx="100" cy="100" r="96" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${gid}c)`}>
        <Circle cx="100" cy="100" r="96" fill={`url(#${gid})`} />
        {dark ? (
          <G fill="#FFFDF6" opacity={0.9}>
            <Circle cx="40" cy="52" r="2" />
            <Circle cx="70" cy="30" r="1.6" />
            <Circle cx="150" cy="44" r="2.2" />
            <Circle cx="165" cy="80" r="1.4" />
            <Circle cx="58" cy="86" r="1.4" />
          </G>
        ) : null}
        {persona.scene === 'moon' ? (
          <G>
            <Circle cx="138" cy="58" r="22" fill={accent} />
            <Circle cx="148" cy="50" r="20" fill={bg[0]} />
          </G>
        ) : persona.scene === 'stars' ? (
          <Path d="M140 34 l6 14 15 1 -11 10 4 15 -14 -8 -14 8 4 -15 -11 -10 15 -1z" fill={accent} />
        ) : persona.scene === 'dawn' ? (
          <G>
            <Circle cx="100" cy="128" r="34" fill={accent} opacity={0.85} />
            <Ellipse cx="60" cy="60" rx="22" ry="8" fill="#FFFDF6" opacity={0.8} />
          </G>
        ) : persona.scene === 'sea' ? (
          <G>
            <Circle cx="146" cy="52" r="16" fill="#FFFDF6" opacity={0.9} />
            <Path d="M8 118 q24 -12 48 0 t48 0 t48 0 t48 0 v40 h-192z" fill={accent} opacity={0.45} />
          </G>
        ) : (
          <G>
            <Circle cx="146" cy="54" r="18" fill={persona.scene === 'sun' ? accent : '#FFFDF6'} opacity={0.9} />
            <Ellipse cx="62" cy="58" rx="20" ry="7" fill="#FFFDF6" opacity={0.85} />
          </G>
        )}
        <Path d="M0 140 Q60 110 110 136 T200 128 V200 H0z" fill={dark ? '#4C5A7E' : '#A8D88C'} />
        <Path d="M0 158 Q70 136 130 156 T200 150 V200 H0z" fill={dark ? '#3B4768' : '#8BCB6B'} />
        <Rect x="54" y="104" width="8" height="36" rx="3" fill="#A07B55" />
        <Circle cx="58" cy="94" r="22" fill="#5FA85A" />
        <Circle cx="46" cy="102" r="13" fill="#8BCB6B" />
        <Circle cx="70" cy="100" r="12" fill="#8BCB6B" />
        <Path d="M100 160 q18 -10 36 0 v-28 q-18 -10 -36 0z" fill="#FFFDF6" />
        <Path d="M136 160 q18 -10 36 0 v-28 q-18 -10 -36 0z" fill="#F4EAD3" />
        <Path d="M136 132 v28" stroke="#C9A47E" strokeWidth={2} />
      </G>
      <Circle cx="100" cy="100" r="96" fill="none" stroke="#FFFFFF" strokeWidth={5} opacity={0.7} />
    </Svg>
  );
}
