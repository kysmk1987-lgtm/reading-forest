import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { G, Path, Polygon } from 'react-native-svg';

import { BookCover } from '@/components/BookCover';
import { AppText, Button, ProgressBar } from '@/components/ui';
import { stageIndex } from '@/features/library/growth';
import { AvatarReader } from '@/features/profile/AvatarArt';
import { AVATARS, type AvatarId } from '@/features/profile/avatars';
import { digFeedback, tapFeedback } from '@/lib/feedback';
import { colors, palette, radius, softShadow, spacing } from '@/theme';

import { AnimatedTree } from './AnimatedTree';
import { CritterLayer, type CritterSpot } from './CritterLayer';
import type { CritterKind } from './critters';
import { DirtBurst } from './DirtBurst';
import { layoutGarden, tileAt, tileKey, transplant, type Tile } from './layout';
import { treeLook, type ForestTree } from './model';
import { WeatherLayer, type Weather } from './WeatherLayer';

const TW = 84;
const TH = 42;
const DEPTH = 14;
const HEAD = 96;
const TREE = 94;
/** Tap target: the trunk/canopy column, not the transparent corners that overlap neighbours. */
const HIT_W = TREE * 0.5;
const HIT_TOP = TREE * 0.18;
const BUBBLE_W = 220;
const BUBBLE_H = 118;
const DRAG_SLOP = 8;
const READER = 34;
/** The card keeps this height at most; bigger forests are panned (drag in any direction). */
const VIEW_MAX_H = 380;
const PAN_SLOP = 6;
/** On web the DOM click that ends a pan still reaches the Pressable under the pointer. */
const PAN_CLICK_GUARD_MS = 350;
const webPan = (axes: 'x' | 'y' | 'both') =>
  ({ cursor: 'grab', userSelect: 'none', touchAction: axes === 'both' ? 'none' : axes === 'x' ? 'pan-y' : 'pan-x' }) as unknown as ViewStyle;

export { gardenSize } from './layout';

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const diamond = (x: number, y: number) => `M${r1(x)} ${r1(y)}l${TW / 2} ${TH / 2}l${-TW / 2} ${TH / 2}l${-TW / 2} ${-TH / 2}Z`;
const blob = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r1(cx - rx)} ${r1(cy)}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;

type TileLook = { fill: string; stroke: string; width: number; dash?: string };

export interface ForestGardenProps {
  trees: ForestTree[];
  weather?: Weather;
  onOpenBook?: (tree: ForestTree) => void;
  onChangeSpecies?: (tree: ForestTree) => void;
  emptyLabel?: string;
  /** 옮겨 심기 mode: tap a tree, then a tile (or drag it there). */
  editing?: boolean;
  /** Extra empty land (땅 넓히기). */
  extra?: number;
  /** New tile for every tree after a move/swap. */
  onTransplant?: (positions: Record<string, Tile>) => void;
  /** Little creatures at the front of the garden (any combination). */
  critters?: readonly CritterKind[];
  /** Profile character reading in the shade of the biggest tree (the sprout shows nobody). */
  avatar?: AvatarId;
}

type Offset = { dx: number; dy: number };

const NO_CRITTERS: readonly CritterKind[] = [];

/** Pan limits plus the land diamond (content coordinates: centre and half extents). */
type PanBounds = { minX: number; minY: number; viewW: number; viewH: number; land: { cx: number; cy: number; a: number; b: number } };

/**
 * Drag-to-look-around for a garden bigger than its viewport (mouse and touch, via the responder system).
 * The pan claims a gesture only after it moves (so taps still reach trees and tiles) and never steals a
 * tree that is being dragged in 옮겨 심기 (DraggableTree refuses to hand over its responder).
 */
class GardenPan {
  readonly value = new Animated.ValueXY({ x: 0, y: 0 });
  private at = { x: 0, y: 0 };
  private from = { x: 0, y: 0 };
  private bounds: PanBounds = { minX: 0, minY: 0, viewW: 0, viewH: 0, land: { cx: 0, cy: 0, a: 1, b: 1 } };
  private endedAt = 0;

  readonly responder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => {
      const ax = Math.abs(g.dx);
      const ay = Math.abs(g.dy);
      if (Math.max(ax, ay) < PAN_SLOP) return false;
      const canX = this.bounds.minX < -1;
      const canY = this.bounds.minY < -1;
      // One pannable axis: leave the other direction to the page scroll.
      return (canX && canY) || (canX && ax > ay) || (canY && ay > ax);
    },
    onPanResponderGrant: () => {
      this.value.stopAnimation();
      this.from = { ...this.at };
    },
    onPanResponderMove: (_, g) => this.to(this.from.x + g.dx, this.from.y + g.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => {
      this.endedAt = Date.now();
    },
    onPanResponderTerminate: () => {
      this.endedAt = Date.now();
    },
  });

  resize(bounds: PanBounds) {
    this.bounds = bounds;
    this.to(bounds.viewW / 2 - bounds.land.cx, bounds.viewH / 2 - bounds.land.cy);
  }

  /** Keeps the content inside the viewport and the viewport centre over the land, so the forest never drifts out of sight. */
  private clampPan(x: number, y: number) {
    const { minX, minY, viewW, viewH, land } = this.bounds;
    x = clamp(x, minX, 0);
    y = clamp(y, minY, 0);
    const dx = viewW / 2 - x - land.cx;
    const dy = viewH / 2 - y - land.cy;
    const outside = Math.abs(dx) / land.a + Math.abs(dy) / land.b;
    if (outside > 1) {
      x = clamp(viewW / 2 - land.cx - dx / outside, minX, 0);
      y = clamp(viewH / 2 - land.cy - dy / outside, minY, 0);
    }
    return { x, y };
  }

  to(x: number, y: number, animated = false) {
    this.at = this.clampPan(x, y);
    if (animated) Animated.timing(this.value, { toValue: this.at, duration: 260, useNativeDriver: false }).start();
    else this.value.setValue(this.at);
  }

  /** True right after a pan ended: on web its DOM click still reaches the Pressable under the pointer. */
  justPanned() {
    return Date.now() - this.endedAt < PAN_CLICK_GUARD_MS;
  }

  /** Pans just enough to bring a content rectangle (e.g. the book bubble) into view. */
  reveal(x0: number, y0: number, x1: number, y1: number) {
    const { viewW, viewH } = this.bounds;
    let { x, y } = this.at;
    if (x0 + x < 4) x = 4 - x0;
    else if (x1 + x > viewW - 4) x = viewW - 4 - x1;
    if (y0 + y < 4) y = 4 - y0;
    else if (y1 + y > viewH - 4) y = viewH - 4 - y1;
    if (x !== this.at.x || y !== this.at.y) this.to(x, y, true);
  }
}

/** Responder-based handle so the same tree can be tapped (select/swap) or dragged (mouse and touch). */
function DraggableTree({
  label,
  style,
  children,
  onTap,
  onDrag,
  onDrop,
}: {
  label: string;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
  onTap: () => void;
  onDrag: (offset: Offset | null) => void;
  onDrop: (offset: Offset) => void;
}) {
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const offset = (e: GestureResponderEvent) => {
    const s = start.current!;
    return { dx: e.nativeEvent.pageX - s.x, dy: e.nativeEvent.pageY - s.y };
  };
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, moved: false };
      }}
      onResponderMove={(e) => {
        const s = start.current;
        if (!s) return;
        const o = offset(e);
        if (!s.moved && Math.hypot(o.dx, o.dy) < DRAG_SLOP) return;
        s.moved = true;
        onDrag(o);
      }}
      onResponderRelease={(e) => {
        const s = start.current;
        if (!s) return;
        const o = offset(e);
        start.current = null;
        if (s.moved) onDrop(o);
        else onTap();
      }}
      onResponderTerminate={() => {
        start.current = null;
        onDrag(null);
      }}
      style={style}>
      {children}
    </View>
  );
}

export function ForestGarden({
  trees,
  weather = 'clear',
  onOpenBook,
  onChangeSpecies,
  emptyLabel,
  editing = false,
  extra = 0,
  onTransplant,
  critters = NO_CRITTERS,
  avatar,
}: ForestGardenProps) {
  const { t } = useTranslation();
  /** The species is part of the selection so the book bubble closes once the tree is changed (나무 바꾸기). */
  const [selection, setSelection] = useState<{ id: string; species: string } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<(Offset & { id: string }) | null>(null);
  const [bursts, setBursts] = useState<{ tile: Tile; key: number }[]>([]);
  const [viewportW, setViewportW] = useState(0);
  /** On web the DOM click of a tree gesture also reaches the background Pressable; it must not undo the tap. */
  const lastTreeGesture = useRef(0);

  const { n, positions } = useMemo(() => layoutGarden(trees, extra), [trees, extra]);
  const W = n * TW;
  const H = HEAD + n * TH + DEPTH + 6;
  const tileTop = (c: number, r: number) => ({ x: W / 2 + ((c - r) * TW) / 2, y: HEAD + ((c + r) * TH) / 2 });

  // ─── Panning: the garden moves inside a fixed viewport once it outgrows it ───
  const groundW = Math.max(W, viewportW);
  const viewH = Math.min(H, VIEW_MAX_H);
  const minX = Math.min(0, viewportW - groundW);
  const minY = Math.min(0, viewH - H);
  const panAxes = minX < -1 && minY < -1 ? 'both' : minX < -1 ? 'x' : minY < -1 ? 'y' : null;
  const [pan] = useState(() => new GardenPan());
  // New size (땅 넓히기, more trees, rotation): start centred again.
  useEffect(
    () => pan.resize({ minX, minY, viewW: viewportW, viewH, land: { cx: groundW / 2, cy: HEAD + (n * TH) / 2, a: W / 2, b: (n * TH) / 2 } }),
    [pan, minX, minY, viewportW, viewH, groundW, n, W],
  );

  const placed = useMemo(
    () =>
      trees
        .filter((tree) => positions[tree.id])
        .map((tree) => ({ tree, ...positions[tree.id] }))
        .sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c),
    [trees, positions],
  );

  const moving = editing ? placed.find((p) => p.tree.id === movingId) : undefined;
  const selected = editing ? undefined : placed.find((p) => p.tree.id === selection?.id && p.tree.species === selection.species);
  const occupied = new Set(placed.map((p) => tileKey(p)));

  const readerTreeId = useMemo(() => {
    if (!avatar || !AVATARS[avatar].person) return null;
    let best: { id: string; score: number; createdAt: number } | null = null;
    for (const { tree } of placed) {
      const look = treeLook(tree);
      const score = look.variant === 'growing' ? stageIndex(look.stage) + 1 : 0;
      if (!best || score > best.score || (score === best.score && tree.createdAt < best.createdAt)) best = { id: tree.id, score, createdAt: tree.createdAt };
    }
    return best?.id ?? null;
  }, [placed, avatar]);
  const dropTile = (from: Tile, o: Offset) => {
    const { x, y } = tileTop(from.c, from.r);
    return tileAt(x + o.dx, y + TH / 2 + o.dy, n, { tw: TW, th: TH, head: HEAD });
  };
  const hoverTile = drag ? dropTile(positions[drag.id] ?? { c: 0, r: 0 }, drag) : null;

  const plant = (treeId: string, target: Tile) => {
    const from = positions[treeId];
    const next = transplant(positions, treeId, target, n);
    setMovingId(null);
    setDrag(null);
    if (!next || !from) return;
    const swapped = occupied.has(tileKey(target));
    digFeedback();
    setBursts((list) => {
      const key = (list.at(-1)?.key ?? 0) + 1;
      return [{ tile: target, key }, ...(swapped ? [{ tile: from, key: key + 1 }] : [])];
    });
    onTransplant?.(next);
  };

  const onLayout = (e: LayoutChangeEvent) => setViewportW(e.nativeEvent.layout.width);

  const offsetX = (groundW - W) / 2;
  /** Book bubble above the tree on tile (c, r), kept inside the garden. */
  const bubbleBox = (c: number, r: number) => {
    const { x, y } = tileTop(c, r);
    const treeTop = y + TH / 2 - TREE * 0.92 + HIT_TOP;
    return { left: Math.min(Math.max(4, offsetX + x - BUBBLE_W / 2), groundW - BUBBLE_W - 4), top: Math.max(2, treeTop - BUBBLE_H) };
  };
  const bottomY = HEAD + n * TH;
  const midY = HEAD + (n * TH) / 2;

  /** Ground points on the front half of the garden, empty tiles first. */
  const critterSpots: CritterSpot[] = [];
  if (critters.length && !editing) {
    const front: (Tile & { free: boolean; h: number })[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (c + r >= n - 1) front.push({ c, r, free: !occupied.has(`${c}:${r}`), h: hash(c * 31 + r * 17 + n) });
      }
    }
    front.sort((a, b) => Number(b.free) - Number(a.free) || a.h - b.h);
    for (const tile of front.slice(0, 8)) {
      const { x, y } = tileTop(tile.c, tile.r);
      critterSpots.push({ x: offsetX + x + (tile.free ? 0 : TW * 0.22), y: y + TH / 2 + (tile.free ? 4 : TH * 0.3) });
    }
  }

  const tileStyle = (c: number, r: number): TileLook => {
    const key = `${c}:${r}`;
    const base = (c + r) % 2 ? '#A8DC86' : '#9DD47C';
    if (selected && selected.c === c && selected.r === r) return { fill: '#C9EBA5', stroke: palette.yellowDeep, width: 2 };
    if (!editing) return { fill: base, stroke: '#8EC86E', width: 1 };
    if (hoverTile && hoverTile.c === c && hoverTile.r === r) return { fill: '#FFE58A', stroke: palette.yellowDeep, width: 2.5 };
    if (moving && moving.c === c && moving.r === r) return { fill: '#FFF1B8', stroke: palette.yellowDeep, width: 2.5 };
    if (moving || drag) {
      return occupied.has(key)
        ? { fill: base, stroke: '#F2B84B', width: 2, dash: '5,4' }
        : { fill: '#CFEFAE', stroke: '#6FB05A', width: 1.6, dash: '5,4' };
    }
    return { fill: base, stroke: occupied.has(key) ? '#FFFDF6' : '#8EC86E', width: occupied.has(key) ? 1.6 : 1 };
  };

  const hint = editing ? (moving || drag ? t('forest.transplantTarget') : t('forest.transplantPick')) : null;

  // Tiles and decorations are batched into a few paths (one per look) so a big garden stays cheap to draw.
  const tileGroups = new Map<string, { look: TileLook; d: string[] }>();
  const deco = { pink: [] as string[], yellow: [] as string[], cream: [] as string[], stone: [] as string[], grass: [] as string[] };
  for (let i = 0; i < n * n; i++) {
    const c = i % n;
    const r = Math.floor(i / n);
    const { x, y } = tileTop(c, r);
    const look = tileStyle(c, r);
    const key = `${look.fill}|${look.stroke}|${look.width}|${look.dash ?? ''}`;
    const group = tileGroups.get(key) ?? { look, d: [] };
    group.d.push(diamond(x, y));
    tileGroups.set(key, group);
    const roll = !occupied.has(`${c}:${r}`) && !editing ? hash(i + n * 7) : -1;
    const cx = x + (hash(i + 3) - 0.5) * 16;
    const cy = y + TH / 2 + (hash(i + 5) - 0.5) * 8;
    if (roll > 0.72) {
      deco.pink.push(blob(cx, cy, 2.6, 2.6));
      deco.yellow.push(blob(cx + 5, cy + 2, 2.2, 2.2));
      deco.cream.push(blob(cx, cy, 1, 1));
    } else if (roll > 0.5) {
      deco.stone.push(blob(cx, cy, 4, 2.4));
    } else if (roll > 0.3) {
      deco.grass.push(blob(cx - 2, cy, 1.4, 4), blob(cx + 2, cy + 1, 1.4, 3.4));
    }
  }
  /** Thin outlines first so highlighted tiles are never painted over by a neighbour. */
  const tilePaths = [...tileGroups.values()].sort((a, b) => a.look.width - b.look.width);

  const garden = (
    <Pressable
      onPress={() => {
        if (Date.now() - lastTreeGesture.current < 500 || pan.justPanned()) return;
        setSelection(null);
        setMovingId(null);
      }}
      style={{ width: groundW, height: H }}
      accessible={false}>
      <Svg width={groundW} height={H} style={StyleSheet.absoluteFill}>
        <G x={offsetX}>
          <Polygon points={`0,${midY} ${W / 2},${bottomY} ${W / 2},${bottomY + DEPTH} 0,${midY + DEPTH}`} fill={palette.wood} />
          <Polygon points={`${W / 2},${bottomY} ${W},${midY} ${W},${midY + DEPTH} ${W / 2},${bottomY + DEPTH}`} fill={palette.woodDeep} />
          <Polygon points={`0,${midY} ${W / 2},${bottomY} ${W / 2},${bottomY + 4} 0,${midY + 4}`} fill="#6FB05A" />
          <Polygon points={`${W / 2},${bottomY} ${W},${midY} ${W},${midY + 4} ${W / 2},${bottomY + 4}`} fill={palette.leafDeep} />
          {tilePaths.map(({ look, d }) => (
            <Path
              key={`${look.fill}|${look.stroke}|${look.width}|${look.dash ?? ''}`}
              d={d.join('')}
              fill={look.fill}
              stroke={look.stroke}
              strokeWidth={look.width}
              strokeDasharray={look.dash}
              strokeLinejoin="round"
            />
          ))}
          {deco.grass.length ? <Path d={deco.grass.join('')} fill="#7DBF5E" /> : null}
          {deco.stone.length ? <Path d={deco.stone.join('')} fill={palette.stone} /> : null}
          {deco.pink.length ? <Path d={deco.pink.join('')} fill={palette.pink} /> : null}
          {deco.yellow.length ? <Path d={deco.yellow.join('')} fill={palette.yellow} /> : null}
          {deco.cream.length ? <Path d={deco.cream.join('')} fill={palette.cream} /> : null}
        </G>
      </Svg>

      {placed.map(({ tree, c, r }, i) => {
        const { x, y } = tileTop(c, r);
        const look = treeLook(tree);
        const hitStyle = [styles.hit, { left: offsetX + x - HIT_W / 2, top: y + TH / 2 - TREE * 0.92 + HIT_TOP }];
        const isDragged = drag?.id === tree.id;
        const lifted = isDragged || moving?.tree.id === tree.id;
        const art = (
          <View
            style={[
              styles.treeArt,
              lifted && {
                transform: [{ translateX: isDragged ? drag.dx : 0 }, { translateY: (isDragged ? drag.dy : 0) - 8 }, { scale: 1.06 }],
              },
            ]}>
            <AnimatedTree {...look} species={tree.species} size={TREE} phaseMs={(i * 270) % 1800} swayDegrees={lifted ? 0 : 2.5} />
          </View>
        );
        if (editing) {
          return (
            <DraggableTree
              key={tree.id}
              label={tree.title}
              style={[hitStyle, isDragged && styles.dragging]}
              onTap={() => {
                lastTreeGesture.current = Date.now();
                if (moving && moving.tree.id !== tree.id) {
                  plant(moving.tree.id, { c, r });
                  return;
                }
                tapFeedback();
                setMovingId(moving?.tree.id === tree.id ? null : tree.id);
              }}
              onDrag={(o) => setDrag(o ? { id: tree.id, ...o } : null)}
              onDrop={(o) => {
                lastTreeGesture.current = Date.now();
                const target = dropTile({ c, r }, o);
                if (target) plant(tree.id, target);
                else setDrag(null);
              }}>
              {art}
            </DraggableTree>
          );
        }
        return (
          <Fragment key={tree.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tree.title}
              onPress={() => {
                if (pan.justPanned()) return;
                tapFeedback();
                if (tree.id === selected?.tree.id) {
                  setSelection(null);
                  return;
                }
                setSelection({ id: tree.id, species: tree.species });
                const box = bubbleBox(c, r);
                pan.reveal(box.left, box.top, box.left + BUBBLE_W, y + TH);
              }}
              style={hitStyle}>
              {art}
            </Pressable>
            {avatar && tree.id === readerTreeId ? (
              <View style={[styles.reader, { left: offsetX + x + TW * 0.24 - READER / 2, top: y + TH / 2 + 9 - READER }]}>
                <AvatarReader id={avatar} size={READER} />
              </View>
            ) : null}
          </Fragment>
        );
      })}

      {editing && moving
        ? Array.from({ length: n * n }, (_, i) => {
            const c = i % n;
            const r = Math.floor(i / n);
            if (occupied.has(`${c}:${r}`)) return null;
            const { x, y } = tileTop(c, r);
            return (
              <Pressable
                key={`t${i}`}
                accessibilityRole="button"
                accessibilityLabel={t('forest.emptyTile', { c: c + 1, r: r + 1 })}
                testID={`tile-${c}-${r}`}
                onPress={() => {
                  if (!pan.justPanned()) plant(moving.tree.id, { c, r });
                }}
                style={[styles.tileHit, { left: offsetX + x - TW / 4, top: y + TH / 4 }]}
              />
            );
          })
        : null}

      {bursts.map(({ tile, key }) => {
        const { x, y } = tileTop(tile.c, tile.r);
        return <DirtBurst key={key} runKey={key} x={offsetX + x} y={y + TH / 2} />;
      })}

      <CritterLayer kinds={critters} spots={critterSpots} />

      {trees.length === 0 && emptyLabel ? (
        <View style={[styles.emptySign, { top: HEAD - 40 }]}>
          <AppText variant="caption" center>
            {emptyLabel}
          </AppText>
        </View>
      ) : null}

      {selected
        ? (() => {
            const { left, top } = bubbleBox(selected.c, selected.r);
            const tree = selected.tree;
            return (
              <View
                style={[styles.bubble, { left, top }]}
                onStartShouldSetResponder={() => true}>
                <View style={styles.bubbleRow}>
                  <BookCover uri={tree.coverUrl} title={tree.title} width={42} />
                  <View style={styles.bubbleInfo}>
                    <AppText numberOfLines={2} style={styles.bubbleTitle}>
                      {tree.title}
                    </AppText>
                    <AppText variant="tiny" muted>
                      {t(`status.${tree.status}`)} · {t(`growth.${treeLook(tree).variant === 'growing' ? treeLook(tree).stage : tree.status === 'want' ? 'pot' : 'stump'}`)}
                    </AppText>
                    {tree.status === 'reading' || tree.status === 'read' ? (
                      <View style={styles.bubbleProgress}>
                        <ProgressBar percent={tree.percent} height={8} style={styles.flex} />
                        <AppText variant="tiny">{tree.percent}%</AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.bubbleActions}>
                  {onOpenBook ? (
                    <Button
                      size="sm"
                      label={t('forest.openBook')}
                      onPress={() => {
                        if (!pan.justPanned()) onOpenBook(tree);
                      }}
                      style={styles.flex}
                    />
                  ) : null}
                  {onChangeSpecies ? (
                    <Button
                      size="sm"
                      variant="soft"
                      label={t('forest.changeTree')}
                      onPress={() => {
                        if (!pan.justPanned()) onChangeSpecies(tree);
                      }}
                      style={styles.flex}
                    />
                  ) : null}
                </View>
              </View>
            );
          })()
        : null}
    </Pressable>
  );

  return (
    <View
      onLayout={onLayout}
      style={[styles.viewport, { height: viewH }, panAxes && Platform.OS === 'web' ? webPan(panAxes) : null]}
      {...(panAxes ? pan.responder.panHandlers : null)}>
      {viewportW > 0 ? (
        <Animated.View style={[styles.content, { width: groundW, height: H, transform: pan.value.getTranslateTransform() }]}>{garden}</Animated.View>
      ) : null}

      {weather !== 'clear' && viewportW > 0 ? <WeatherLayer kind={weather} width={viewportW} height={viewH} /> : null}

      {hint ? (
        <View style={[styles.emptySign, styles.hint, { top: 8 }]}>
          <AppText variant="caption" center>
            {hint}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { width: '100%', overflow: 'hidden' },
  content: { position: 'absolute', left: 0, top: 0 },
  hit: { position: 'absolute', width: HIT_W, height: TREE * 0.92 - HIT_TOP },
  dragging: { zIndex: 30 },
  reader: { pointerEvents: 'none', position: 'absolute', width: READER, height: READER },
  tileHit: { position: 'absolute', width: TW / 2, height: TH / 2, zIndex: 12 },
  treeArt: { pointerEvents: 'none', position: 'absolute', left: -(TREE - HIT_W) / 2, top: -HIT_TOP, width: TREE, height: TREE },
  emptySign: {
    pointerEvents: 'none',
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    marginHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,253,246,0.9)',
  },
  hint: { zIndex: 25, borderWidth: 1.5, borderColor: palette.yellowDeep },
  bubble: {
    position: 'absolute',
    width: BUBBLE_W,
    padding: spacing.sm,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
    zIndex: 20,
    ...softShadow(),
  },
  bubbleRow: { flexDirection: 'row', gap: spacing.sm },
  bubbleInfo: { flex: 1, gap: 3 },
  bubbleTitle: { fontSize: 14, lineHeight: 19 },
  bubbleProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bubbleActions: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
});
