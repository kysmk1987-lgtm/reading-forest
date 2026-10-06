import { memo, type ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

import type { GrowthStage } from '@/features/library/growth';
import type { TreeSpeciesId } from '@/types';

import { TREE_SPECIES, type TreeSpecies } from './species';

export type TreeVariant = 'growing' | 'withered' | 'pot';

export interface TreeGraphicProps {
  stage: GrowthStage;
  species: TreeSpeciesId;
  variant?: TreeVariant;
  size?: number;
}

const GROUND = 92;
const SPROUT = { stem: '#5FA85A', leaf: '#8BCB6B', leafLight: '#B5E08F' };
const SOIL = { dark: '#A07B55', light: '#B88E62', seed: '#8A5E3B', seedLight: '#C79A6E' };

/** Canopy size/position per stage; seeds and sprouts are drawn separately. */
const STAGE_SHAPE: Partial<Record<GrowthStage, { s: number; cy: number; trunk: number }>> = {
  sapling: { s: 0.45, cy: 60, trunk: 3 },
  young: { s: 0.72, cy: 47, trunk: 5 },
  tree: { s: 1, cy: 39, trunk: 7 },
  bloom: { s: 1, cy: 39, trunk: 7 },
};

const BLOOM_SPOTS: [number, number][] = [
  [-15, 3],
  [11, -7],
  [2, 9],
  [-5, -13],
  [17, 5],
  [-19, -6],
  [7, -1],
];

function Mound() {
  return (
    <G>
      <Ellipse cx={50} cy={91} rx={16} ry={5} fill={SOIL.dark} />
      <Ellipse cx={50} cy={89.6} rx={12.5} ry={3.4} fill={SOIL.light} />
    </G>
  );
}

function Seed() {
  return (
    <G>
      <Mound />
      <Ellipse cx={50} cy={84.5} rx={5} ry={6.4} fill={SOIL.seed} />
      <Ellipse cx={48.4} cy={82.4} rx={1.5} ry={2.6} fill={SOIL.seedLight} />
      <Path d="M50 78.4 Q51.5 75.5 54 75.2" stroke={SPROUT.stem} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Sprout() {
  return (
    <G>
      <Mound />
      <Path d="M50 90 Q48.6 80 50 70" stroke={SPROUT.stem} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M50 73 Q40 70 36.5 62.5 Q46 62.5 50 73 Z" fill={SPROUT.leaf} />
      <Path d="M50 71.5 Q60 67 64 59 Q54 59.5 50 71.5 Z" fill={SPROUT.leafLight} />
    </G>
  );
}

function Trunk({ sp, cy, s, width }: { sp: TreeSpecies; cy: number; s: number; width: number }) {
  const top = cy + 8 * s;
  if (sp.trunkStyle === 'curved') {
    // Palm: a leaning, ringed trunk that reaches the frond crown.
    const w = width * 0.75;
    const rings: ReactElement[] = [];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const y = GROUND - (GROUND - cy) * t;
      const x = 50 + 6 * s * Math.sin(t * 1.4);
      rings.push(<Path key={i} d={`M${x - w * 0.55} ${y} Q${x} ${y + 1.6} ${x + w * 0.55} ${y}`} stroke="rgba(0,0,0,0.16)" strokeWidth={0.9} fill="none" />);
    }
    return (
      <G>
        <Path
          d={`M${50 - w * 0.75} ${GROUND} Q${50 - w * 0.2 + 3 * s} ${(GROUND + cy) / 2} ${50 + 6 * s - w * 0.45} ${cy + 2} L${50 + 6 * s + w * 0.45} ${cy + 2} Q${50 + w * 0.6 + 4 * s} ${(GROUND + cy) / 2} ${50 + w * 0.75} ${GROUND} Z`}
          fill={sp.trunk}
        />
        {rings}
      </G>
    );
  }
  const thick = sp.trunkStyle === 'thick';
  const w = thick ? width * 2.1 : sp.trunkStyle === 'birch' ? width * 0.8 : width;
  const flare = thick ? 1.2 : 1.35;
  const half = w / 2;
  return (
    <G>
      <Path d={`M${50 - half * flare} ${GROUND} L${50 - half} ${top} L${50 + half} ${top} L${50 + half * flare} ${GROUND} Z`} fill={sp.trunk} />
      {sp.trunkStyle === 'birch' ? (
        <G>
          {[0.18, 0.36, 0.55, 0.74].map((t, i) => {
            const y = top + (GROUND - top) * t;
            const left = i % 2 === 0;
            return (
              <Path
                key={i}
                d={`M${left ? 50 - half : 50 + half * 0.1} ${y} L${left ? 50 - half * 0.1 : 50 + half} ${y + 0.6}`}
                stroke="#3D3A36"
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            );
          })}
          <Path d={`M${50 + half * 0.45} ${top + 2} L${50 + half * 0.55} ${GROUND - 2}`} stroke="rgba(0,0,0,0.08)" strokeWidth={w * 0.3} />
        </G>
      ) : (
        <Path d={`M${50 + half * 0.2} ${top + 4} L${50 + half * 0.35} ${GROUND - 2}`} stroke="rgba(0,0,0,0.12)" strokeWidth={w * 0.25} />
      )}
      {s >= 0.7 && sp.trunkStyle !== 'birch' ? (
        <Path d={`M50 ${top + 12 * s} Q60 ${top + 4 * s} 62 ${top - 2 * s}`} stroke={sp.trunk} strokeWidth={w * 0.4} strokeLinecap="round" fill="none" />
      ) : null}
    </G>
  );
}

/** Fan-shaped sector pointing down to (x, y) — the ginkgo leaf silhouette. */
function fan(x: number, y: number, r: number, spread = 0.9) {
  const a0 = -Math.PI / 2 - spread;
  const a1 = -Math.PI / 2 + spread;
  const p0 = [x + r * Math.cos(a0), y + r * Math.sin(a0)];
  const p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)];
  return `M${x} ${y} L${p0[0]} ${p0[1]} A${r} ${r} 0 0 1 ${p1[0]} ${p1[1]} Z`;
}

function Canopy({ sp, cx, cy, s }: { sp: TreeSpecies; cx: number; cy: number; s: number }) {
  switch (sp.shape) {
    case 'pine': {
      const tiers: ReactElement[] = [];
      for (let i = 0; i < 3; i++) {
        const yb = cy + 20 * s - i * 13 * s;
        const h = 24 * s;
        const hw = (25 - i * 6) * s;
        tiers.push(
          <G key={i}>
            <Polygon points={`${cx - hw},${yb} ${cx + hw},${yb} ${cx},${yb - h}`} fill={sp.leaf} />
            <Polygon points={`${cx},${yb - h} ${cx + hw},${yb} ${cx},${yb}`} fill={sp.leafDark} opacity={0.45} />
            <Polygon points={`${cx - hw * 0.5},${yb - h * 0.5} ${cx - hw * 0.2},${yb - h * 0.5} ${cx - hw * 0.05},${yb - h * 0.85}`} fill={sp.leafLight} opacity={0.8} />
          </G>,
        );
      }
      return <G>{tiers}</G>;
    }
    case 'baobab':
      return (
        <G>
          <Ellipse cx={cx} cy={cy + 3 * s} rx={28 * s} ry={10 * s} fill={sp.leafDark} />
          <Ellipse cx={cx - 13 * s} cy={cy - 2 * s} rx={15 * s} ry={8 * s} fill={sp.leaf} />
          <Ellipse cx={cx + 13 * s} cy={cy - 2 * s} rx={15 * s} ry={8 * s} fill={sp.leaf} />
          <Ellipse cx={cx} cy={cy - 6 * s} rx={17 * s} ry={8 * s} fill={sp.leaf} />
          <Ellipse cx={cx - 8 * s} cy={cy - 9 * s} rx={7 * s} ry={3 * s} fill={sp.leafLight} opacity={0.85} />
        </G>
      );
    case 'maple': {
      const lobes: [number, number, number][] = [
        [0, -12, 13],
        [-15, -3, 12],
        [15, -3, 12],
        [-9, 10, 12],
        [9, 10, 12],
      ];
      return (
        <G>
          <Circle cx={cx} cy={cy + 4 * s} r={20 * s} fill={sp.leafDark} />
          {lobes.map(([dx, dy, r], i) => (
            <Circle key={i} cx={cx + dx * s} cy={cy + dy * s} r={r * s} fill={sp.leaf} />
          ))}
          <Circle cx={cx - 6 * s} cy={cy - 13 * s} r={6 * s} fill={sp.leafLight} opacity={0.85} />
        </G>
      );
    }
    case 'cherry':
      return (
        <G>
          <Circle cx={cx} cy={cy + 6 * s} r={20 * s} fill={sp.leafDark} />
          <Circle cx={cx - 14 * s} cy={cy + 3 * s} r={13 * s} fill={sp.leaf} />
          <Circle cx={cx + 14 * s} cy={cy + 3 * s} r={13 * s} fill={sp.leaf} />
          <Circle cx={cx} cy={cy - 6 * s} r={17 * s} fill={sp.leaf} />
          <Circle cx={cx - 9 * s} cy={cy - 12 * s} r={7 * s} fill={sp.leafLight} />
          <Circle cx={cx + 10 * s} cy={cy - 4 * s} r={5 * s} fill={sp.leafLight} />
        </G>
      );
    case 'ginkgo':
      // A tall crown built from overlapping golden fans.
      return (
        <G>
          <Path d={fan(cx, cy + 22 * s, 36 * s, 0.55)} fill={sp.leafDark} />
          <Path d={fan(cx - 9 * s, cy + 12 * s, 21 * s)} fill={sp.leaf} />
          <Path d={fan(cx + 9 * s, cy + 12 * s, 21 * s)} fill={sp.leaf} />
          <Path d={fan(cx, cy + 4 * s, 22 * s)} fill={sp.leaf} />
          <Path d={fan(cx - 4 * s, cy - 6 * s, 10 * s)} fill={sp.leafLight} />
          <Path d={fan(cx + 10 * s, cy + 6 * s, 7 * s)} fill={sp.leafLight} opacity={0.85} />
        </G>
      );
    case 'birch':
      // Slender, airy crown of narrow ovals.
      return (
        <G>
          <Ellipse cx={cx} cy={cy + 2 * s} rx={15 * s} ry={24 * s} fill={sp.leafDark} />
          <Ellipse cx={cx - 8 * s} cy={cy + 6 * s} rx={9 * s} ry={14 * s} fill={sp.leaf} />
          <Ellipse cx={cx + 8 * s} cy={cy + 2 * s} rx={9 * s} ry={15 * s} fill={sp.leaf} />
          <Ellipse cx={cx} cy={cy - 10 * s} rx={9 * s} ry={13 * s} fill={sp.leaf} />
          <Ellipse cx={cx - 4 * s} cy={cy - 14 * s} rx={3.5 * s} ry={6 * s} fill={sp.leafLight} opacity={0.9} />
          <Ellipse cx={cx + 9 * s} cy={cy + 2 * s} rx={2.5 * s} ry={5 * s} fill={sp.leafLight} opacity={0.8} />
        </G>
      );
    case 'palm': {
      // Drooping fronds radiating from the crown.
      const x = cx + 6 * s;
      const y = cy + 2;
      const fronds: [number, number, number][] = [
        [-30, 10, 1],
        [30, 10, 1],
        [-22, -8, 0],
        [22, -8, 0],
        [-6, -16, 0],
        [8, -15, 1],
      ];
      return (
        <G>
          {fronds.map(([dx, dy, dark], i) => {
            const ex = x + dx * s;
            const ey = y + dy * s;
            const mx = x + dx * 0.5 * s;
            const my = y + (dy - 14) * s * 0.6;
            return (
              <G key={i}>
                <Path d={`M${x} ${y} Q${mx} ${my - 6 * s} ${ex} ${ey} Q${mx} ${my + 4 * s} ${x} ${y} Z`} fill={dark ? sp.leafDark : sp.leaf} />
                <Path d={`M${x} ${y} Q${mx} ${my - 1 * s} ${ex} ${ey}`} stroke={sp.leafLight} strokeWidth={0.9 * s} fill="none" />
              </G>
            );
          })}
        </G>
      );
    }
    case 'magnolia':
      // Rounded vase shape with leathery leaves.
      return (
        <G>
          <Ellipse cx={cx} cy={cy + 6 * s} rx={24 * s} ry={17 * s} fill={sp.leafDark} />
          <Ellipse cx={cx - 12 * s} cy={cy} rx={13 * s} ry={11 * s} fill={sp.leaf} />
          <Ellipse cx={cx + 12 * s} cy={cy} rx={13 * s} ry={11 * s} fill={sp.leaf} />
          <Ellipse cx={cx} cy={cy - 9 * s} rx={15 * s} ry={11 * s} fill={sp.leaf} />
          <Ellipse cx={cx - 7 * s} cy={cy - 13 * s} rx={6 * s} ry={3.5 * s} fill={sp.leafLight} opacity={0.85} />
        </G>
      );
    default:
      return (
        <G>
          <Circle cx={cx} cy={cy + 7 * s} r={21 * s} fill={sp.leafDark} />
          <Circle cx={cx - 14 * s} cy={cy + 4 * s} r={14 * s} fill={sp.leaf} />
          <Circle cx={cx + 14 * s} cy={cy + 4 * s} r={14 * s} fill={sp.leaf} />
          <Circle cx={cx} cy={cy - 5 * s} r={sp.bloomStyle === 'fruit' ? 17 * s : 19 * s} fill={sp.leaf} />
          <Circle cx={cx - 7 * s} cy={cy - 11 * s} r={7 * s} fill={sp.leafLight} opacity={0.85} />
        </G>
      );
  }
}

function Blooms({ sp, cx, cy, s }: { sp: TreeSpecies; cx: number; cy: number; s: number }) {
  if (sp.bloomStyle === 'coconut') {
    const x = cx + 6 * s;
    const y = cy + 6 * s;
    return (
      <G>
        {[
          [-3.2, 0],
          [3.2, 0],
          [0, 3.4],
        ].map(([dx, dy], i) => (
          <G key={i}>
            <Circle cx={x + dx * s} cy={y + dy * s} r={3.6 * s} fill={sp.bloom} />
            <Circle cx={x + dx * s - 1.1 * s} cy={y + dy * s - 1.1 * s} r={1.1 * s} fill={sp.bloomAccent} />
          </G>
        ))}
      </G>
    );
  }
  return (
    <G>
      {BLOOM_SPOTS.map(([dx, dy], i) => {
        const x = cx + dx * s * (sp.shape === 'birch' ? 0.6 : 1);
        const y = cy + dy * s;
        switch (sp.bloomStyle) {
          case 'fruit':
            return (
              <G key={i}>
                <Circle cx={x} cy={y} r={3.4 * s} fill={sp.bloom} />
                <Circle cx={x - 1 * s} cy={y - 1.1 * s} r={1 * s} fill={sp.bloomAccent} opacity={0.8} />
              </G>
            );
          case 'cone':
            return <Ellipse key={i} cx={x * 0.92 + cx * 0.08} cy={y + 4 * s} rx={1.8 * s} ry={2.8 * s} fill={sp.bloom} />;
          case 'nut':
            return (
              <G key={i}>
                <Circle cx={x - 1.4 * s} cy={y + 2 * s} r={2.2 * s} fill={sp.bloom} />
                <Circle cx={x + 1.6 * s} cy={y + 2.6 * s} r={2.2 * s} fill={sp.bloom} />
                <Circle cx={x - 2 * s} cy={y + 1.3 * s} r={0.7 * s} fill={sp.bloomAccent} />
              </G>
            );
          case 'catkin':
            return (
              <G key={i}>
                <Path d={`M${x} ${y - 2 * s} L${x} ${y}`} stroke={sp.bloomAccent} strokeWidth={0.6 * s} />
                <Ellipse cx={x} cy={y + 2.8 * s} rx={1.3 * s} ry={3.2 * s} fill={sp.bloom} />
              </G>
            );
          case 'bigFlower':
            if (i % 2 === 1 && i !== 3) return null;
            return (
              <G key={i}>
                <Path d={`M${x - 4.2 * s} ${y - 3 * s} Q${x - 4.6 * s} ${y + 3.4 * s} ${x} ${y + 3.6 * s} Q${x + 4.6 * s} ${y + 3.4 * s} ${x + 4.2 * s} ${y - 3 * s} Q${x + 2 * s} ${y} ${x} ${y - 4.6 * s} Q${x - 2 * s} ${y} ${x - 4.2 * s} ${y - 3 * s} Z`} fill={sp.bloom} />
                <Path d={`M${x} ${y - 4.6 * s} Q${x - 1.4 * s} ${y} ${x} ${y + 3.6 * s}`} stroke={sp.bloomAccent} strokeWidth={1.1 * s} fill="none" />
                <Path d={`M${x - 4.2 * s} ${y - 3 * s} Q${x - 4.6 * s} ${y + 3.4 * s} ${x} ${y + 3.6 * s}`} stroke={sp.bloomAccent} strokeWidth={0.9 * s} fill="none" opacity={0.8} />
              </G>
            );
          default:
            return (
              <G key={i}>
                <Circle cx={x} cy={y} r={2.8 * s} fill={sp.bloom} />
                <Circle cx={x} cy={y} r={1.1 * s} fill={sp.bloomAccent} />
              </G>
            );
        }
      })}
    </G>
  );
}

function Withered() {
  return (
    <G>
      <Ellipse cx={50} cy={91} rx={16} ry={4.5} fill={SOIL.dark} />
      <Path d="M40 92 L42.5 77 L57.5 77 L60 92 Z" fill="#9A7A5C" />
      <Ellipse cx={50} cy={77} rx={7.5} ry={2.8} fill="#D9B98F" />
      <Ellipse cx={50} cy={77} rx={4.2} ry={1.5} fill="none" stroke="#A07B55" strokeWidth={0.8} />
      <Path d="M57 82 Q63 79 64 74 Q59 76 57 82 Z" fill="#C9B27A" />
      <Path d="M44 86 Q40 83 39 79" stroke="#8BCB6B" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <Path d="M39.2 79.5 Q36 78 35.5 75.5 Q38.8 76.4 39.2 79.5 Z" fill="#8BCB6B" />
    </G>
  );
}

function Pot() {
  return (
    <G>
      <Path d="M38.5 77 L61.5 77 L58 92 L42 92 Z" fill="#E7A174" />
      <Path d="M52 77 L61.5 77 L58 92 L54 92 Z" fill="#D88E62" />
      <Rect x={36} y={72} width={28} height={6.5} rx={2.2} fill="#F0B48A" />
      <Ellipse cx={50} cy={73.6} rx={11} ry={2.2} fill="#7A5A3E" />
      <Ellipse cx={50} cy={71.8} rx={3} ry={2.4} fill={SOIL.seed} />
      <Path d="M50 69.6 Q51.2 67.4 53.2 67.2" stroke={SPROUT.stem} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <Circle cx={45} cy={84} r={1.6} fill="#FFFDF6" opacity={0.7} />
    </G>
  );
}

/** Illustrated tree for a growth stage (pure SVG so it renders on native and web). */
export const TreeGraphic = memo(function TreeGraphic({ stage, species, variant = 'growing', size = 96 }: TreeGraphicProps) {
  const sp = TREE_SPECIES[species] ?? TREE_SPECIES.round;
  const shape = STAGE_SHAPE[stage];
  let body: ReactElement;
  if (variant === 'withered') body = <Withered />;
  else if (variant === 'pot') body = <Pot />;
  else if (stage === 'seed') body = <Seed />;
  else if (stage === 'sprout') body = <Sprout />;
  else {
    const { s, cy, trunk } = shape!;
    body = (
      <G>
        <Trunk sp={sp} cy={cy} s={s} width={trunk} />
        <Canopy sp={sp} cx={50} cy={cy} s={s} />
        {stage === 'bloom' ? <Blooms sp={sp} cx={50} cy={cy} s={s} /> : null}
      </G>
    );
  }
  const shadowRx = variant === 'growing' && shape ? 14 + 10 * shape.s : 14;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={93} rx={shadowRx} ry={3.2} fill="rgba(91,70,54,0.16)" />
      {body}
    </Svg>
  );
});
