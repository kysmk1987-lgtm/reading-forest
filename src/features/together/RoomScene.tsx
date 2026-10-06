import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { TreeGraphic } from '@/features/forest/TreeGraphic';
import { palette, radius } from '@/theme';
import { TREE_SPECIES_IDS, type TreeSpeciesId } from '@/types';

import type { Peer } from './presence';
import type { ThemeRoom } from './rooms';

const W = 360;
const H = 300;

function Shelf({ x, y, w, h, colors }: { x: number; y: number; w: number; h: number; colors: string[] }) {
  const rows = 3;
  const rowH = h / rows;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={4} fill="#9C7650" />
      {Array.from({ length: rows }, (_, r) => (
        <G key={r}>
          <Rect x={x + 4} y={y + r * rowH + 4} width={w - 8} height={rowH - 8} fill="#6E5238" />
          {Array.from({ length: Math.floor((w - 10) / 9) }, (_, i) => (
            <Rect
              key={i}
              x={x + 6 + i * 9}
              y={y + r * rowH + 6 + ((i * 7 + r * 3) % 5)}
              width={7}
              height={rowH - 12 - ((i * 7 + r * 3) % 5)}
              rx={1.5}
              fill={colors[(i + r * 2) % colors.length]}
            />
          ))}
        </G>
      ))}
    </G>
  );
}

function Window({ x, y, w, h, sky, children }: { x: number; y: number; w: number; h: number; sky: string; children?: React.ReactNode }) {
  return (
    <G>
      <Rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={10} fill="#E9D6B9" />
      <Rect x={x} y={y} width={w} height={h} rx={7} fill={sky} />
      {children}
      <Line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#E9D6B9" strokeWidth={4} />
      <Line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#E9D6B9" strokeWidth={4} />
    </G>
  );
}

const BOOKS_WARM = ['#E58AA0', '#F9DC7A', '#8BCB6B', '#9ED8F0', '#F9C9A6', '#CDBBF0'];
const BOOKS_NIGHT = ['#7F8FC9', '#B7A2D9', '#F4D58D', '#8FB7B3', '#D99CA8'];

const Backdrop = memo(function Backdrop({ room }: { room: ThemeRoom }) {
  const [top, bottom] = room.sky;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`bg-${room.id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill={`url(#bg-${room.id})`} />
      {room.id === 'rainy-bookstore' ? (
        <G>
          <Shelf x={14} y={40} w={90} h={150} colors={BOOKS_WARM} />
          <Shelf x={256} y={40} w={90} h={150} colors={BOOKS_WARM} />
          <Window x={124} y={36} w={112} h={92} sky="#9FB9CF">
            {Array.from({ length: 16 }, (_, i) => (
              <Line key={i} x1={130 + ((i * 23) % 104)} y1={42 + ((i * 37) % 70)} x2={127 + ((i * 23) % 104)} y2={52 + ((i * 37) % 70)} stroke="#E6F1F8" strokeWidth={1.4} strokeLinecap="round" />
            ))}
          </Window>
          <Path d="M150 150 h60 l-6 16 h-48 z" fill="#C98F5B" />
          <Ellipse cx={180} cy={148} rx={16} ry={5} fill="#F4E3C7" />
        </G>
      ) : null}
      {room.id === 'midnight-library' ? (
        <G>
          <Circle cx={292} cy={52} r={20} fill="#F7E7B0" />
          <Circle cx={300} cy={46} r={18} fill={top} />
          {[[40, 30], [90, 60], [150, 24], [210, 50], [250, 22]].map(([x, y]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#F7E7B0" />
          ))}
          <Shelf x={10} y={84} w={110} h={130} colors={BOOKS_NIGHT} />
          <Shelf x={130} y={84} w={100} h={130} colors={BOOKS_NIGHT} />
          <Shelf x={240} y={84} w={110} h={130} colors={BOOKS_NIGHT} />
          <Path d="M176 178 l-14 22 h28 z" fill="#F4D58D" opacity={0.35} />
          <Rect x={174} y={160} width={4} height={20} fill="#5B4636" />
          <Path d="M164 160 h24 l-5 -12 h-14 z" fill="#F4D58D" />
        </G>
      ) : null}
      {room.id === 'quiet-teahouse' ? (
        <G>
          <Window x={36} y={40} w={120} h={96} sky="#F7EBD2">
            <Circle cx={70} cy={80} r={14} fill="#F2B880" opacity={0.6} />
            <Path d="M40 120 q30 -26 60 0 t60 0 v16 h-120 z" fill="#C9D8A8" />
          </Window>
          <Rect x={190} y={54} width={140} height={8} rx={4} fill="#A07B55" />
          <Rect x={190} y={96} width={140} height={8} rx={4} fill="#A07B55" />
          {[200, 232, 264, 296].map((x, i) => (
            <G key={x}>
              <Rect x={x} y={34 + (i % 2) * 2} width={20} height={20} rx={6} fill={['#E9C9A0', '#C9D8A8', '#F2C4B6', '#D7C8EC'][i]} />
              <Rect x={x + 4} y={78} width={16} height={18} rx={8} fill={['#F2C4B6', '#E9C9A0', '#D7C8EC', '#C9D8A8'][i]} />
            </G>
          ))}
          <Ellipse cx={180} cy={170} rx={70} ry={12} fill="#B98C5E" />
          <Path d="M168 150 h24 v14 a12 12 0 0 1 -24 0 z" fill="#F7F1E5" />
          <Path d="M174 140 q4 -8 0 -14 M184 140 q4 -8 0 -14" stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.8} />
        </G>
      ) : null}
      {room.id === 'seaside-attic' ? (
        <G>
          <Path d="M0 0 L180 0 L0 120 Z" fill="#E7D3B5" />
          <Path d="M360 0 L180 0 L360 120 Z" fill="#E7D3B5" />
          <Circle cx={180} cy={96} r={58} fill="#E9D6B9" />
          <Circle cx={180} cy={96} r={50} fill="#BFE6F2" />
          <Path d="M130 104 q12 -6 25 0 t25 0 t25 0 t25 0 v40 h-100 z" fill="#5FB4D9" />
          <Path d="M134 116 q12 -5 23 0 t23 0 t23 0 t23 0" stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.7} />
          <Circle cx={204} cy={74} r={9} fill="#FBE7A1" />
          <Line x1={180} y1={46} x2={180} y2={146} stroke="#E9D6B9" strokeWidth={4} />
          <Rect x={24} y={150} width={56} height={40} rx={6} fill="#9ED8F0" opacity={0.6} />
          <Rect x={280} y={146} width={60} height={44} rx={8} fill="#F7B7C5" opacity={0.6} />
        </G>
      ) : null}
      <Path d={`M0 ${H * 0.66} H${W} V${H} H0 Z`} fill={room.id === 'midnight-library' ? '#6B5A7A' : '#E4CFAF'} />
      {Array.from({ length: 7 }, (_, i) => (
        <Line key={i} x1={0} y1={H * 0.66 + i * 15} x2={W} y2={H * 0.66 + i * 15} stroke={room.id === 'midnight-library' ? '#5E4E6E' : '#D9C19E'} strokeWidth={1} />
      ))}
      <Ellipse cx={W / 2} cy={H * 0.86} rx={W * 0.38} ry={H * 0.08} fill={room.id === 'midnight-library' ? '#7D6B8E' : '#EBD9BC'} opacity={0.8} />
    </Svg>
  );
});

function speciesFor(peer: Peer): TreeSpeciesId {
  if (peer.species && (TREE_SPECIES_IDS as readonly string[]).includes(peer.species)) return peer.species as TreeSpeciesId;
  const basic: TreeSpeciesId[] = ['round', 'pine', 'apple'];
  let h = 0;
  for (const c of peer.key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return basic[h % basic.length];
}

/** Illustrated room with present readers standing as little trees (nickname tags; you first, then others). */
export function RoomScene({ room, peers, height = 300 }: { room: ThemeRoom; peers: Peer[]; height?: number }) {
  const ordered = [...peers].sort((a, b) => Number(b.self) - Number(a.self)).slice(0, room.seats.length);
  return (
    <View style={[styles.scene, { height }]}>
      <Backdrop room={room} />
      {ordered.map((p, i) => {
        const seat = room.seats[i];
        const size = 64;
        return (
          <View key={p.key} style={[styles.reader, { left: `${seat.x * 100}%`, top: `${seat.y * 100}%`, marginLeft: -size / 2, marginTop: -size }]}>
            <TreeGraphic stage="tree" species={speciesFor(p)} size={size} />
            <View style={[styles.tag, p.self && styles.tagSelf]}>
              <AppText variant="tiny" numberOfLines={1} color={p.self ? palette.white : palette.brown}>
                {p.nickname ?? '독서가'}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: '100%', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: palette.sand },
  reader: { position: 'absolute', alignItems: 'center', width: 64 },
  tag: {
    marginTop: -6,
    maxWidth: 84,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,253,246,0.92)',
  },
  tagSelf: { backgroundColor: palette.leafDeep },
});
