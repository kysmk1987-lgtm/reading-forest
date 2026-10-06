import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Polygon } from 'react-native-svg';

import { BookCover } from '@/components/BookCover';
import { AppText, Button, ProgressBar } from '@/components/ui';
import { digFeedback, tapFeedback } from '@/lib/feedback';
import { colors, palette, radius, softShadow, spacing } from '@/theme';

import { AnimatedTree } from './AnimatedTree';
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

export { gardenSize } from './layout';

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

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
}

type Offset = { dx: number; dy: number };

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
}: ForestGardenProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<(Offset & { id: string }) | null>(null);
  const [bursts, setBursts] = useState<{ tile: Tile; key: number }[]>([]);
  const [viewportW, setViewportW] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  /** On web the DOM click of a tree gesture also reaches the background Pressable; it must not undo the tap. */
  const lastTreeGesture = useRef(0);

  const { n, positions } = useMemo(() => layoutGarden(trees, extra), [trees, extra]);
  const W = n * TW;
  const H = HEAD + n * TH + DEPTH + 6;
  const tileTop = (c: number, r: number) => ({ x: W / 2 + ((c - r) * TW) / 2, y: HEAD + ((c + r) * TH) / 2 });

  const placed = useMemo(
    () =>
      trees
        .filter((tree) => positions[tree.id])
        .map((tree) => ({ tree, ...positions[tree.id] }))
        .sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c),
    [trees, positions],
  );

  const moving = editing ? placed.find((p) => p.tree.id === movingId) : undefined;
  const selected = editing ? undefined : placed.find((p) => p.tree.id === selectedId);
  const occupied = new Set(placed.map((p) => tileKey(p)));
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

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setViewportW(w);
    if (W > w) requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: (W - w) / 2, animated: false }));
  };

  const groundW = Math.max(W, viewportW);
  const offsetX = (groundW - W) / 2;
  const bottomY = HEAD + n * TH;
  const midY = HEAD + (n * TH) / 2;

  const tileStyle = (c: number, r: number) => {
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

  const garden = (
    <Pressable
      onPress={() => {
        if (Date.now() - lastTreeGesture.current < 500) return;
        setSelectedId(null);
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
          {Array.from({ length: n * n }, (_, i) => {
            const c = i % n;
            const r = Math.floor(i / n);
            const { x, y } = tileTop(c, r);
            const look = tileStyle(c, r);
            const deco = !occupied.has(`${c}:${r}`) && !editing ? hash(i + n * 7) : -1;
            const cx = x + (hash(i + 3) - 0.5) * 16;
            const cy = y + TH / 2 + (hash(i + 5) - 0.5) * 8;
            return (
              <G key={i}>
                <Polygon
                  points={`${x},${y} ${x + TW / 2},${y + TH / 2} ${x},${y + TH} ${x - TW / 2},${y + TH / 2}`}
                  fill={look.fill}
                  stroke={look.stroke}
                  strokeWidth={look.width}
                  strokeDasharray={look.dash}
                />
                {deco > 0.72 ? (
                  <G>
                    <Circle cx={cx} cy={cy} r={2.6} fill={palette.pink} />
                    <Circle cx={cx + 5} cy={cy + 2} r={2.2} fill={palette.yellow} />
                    <Circle cx={cx} cy={cy} r={1} fill={palette.cream} />
                  </G>
                ) : deco > 0.5 ? (
                  <Ellipse cx={cx} cy={cy} rx={4} ry={2.4} fill={palette.stone} />
                ) : deco > 0.3 ? (
                  <G>
                    <Ellipse cx={cx - 2} cy={cy} rx={1.4} ry={4} fill="#7DBF5E" />
                    <Ellipse cx={cx + 2} cy={cy + 1} rx={1.4} ry={3.4} fill="#7DBF5E" />
                  </G>
                ) : null}
              </G>
            );
          })}
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
          <Pressable
            key={tree.id}
            accessibilityRole="button"
            accessibilityLabel={tree.title}
            onPress={() => {
              tapFeedback();
              setSelectedId(tree.id === selectedId ? null : tree.id);
            }}
            style={hitStyle}>
            {art}
          </Pressable>
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
                onPress={() => plant(moving.tree.id, { c, r })}
                style={[styles.tileHit, { left: offsetX + x - TW / 4, top: y + TH / 4 }]}
              />
            );
          })
        : null}

      {bursts.map(({ tile, key }) => {
        const { x, y } = tileTop(tile.c, tile.r);
        return <DirtBurst key={key} runKey={key} x={offsetX + x} y={y + TH / 2} />;
      })}

      {weather !== 'clear' ? <WeatherLayer kind={weather} width={groundW} height={H} /> : null}

      {hint ? (
        <View style={[styles.emptySign, styles.hint, { top: 8 }]}>
          <AppText variant="caption" center>
            {hint}
          </AppText>
        </View>
      ) : null}

      {trees.length === 0 && emptyLabel ? (
        <View style={[styles.emptySign, { top: HEAD - 40 }]}>
          <AppText variant="caption" center>
            {emptyLabel}
          </AppText>
        </View>
      ) : null}

      {selected
        ? (() => {
            const { x, y } = tileTop(selected.c, selected.r);
            const treeTop = y + TH / 2 - TREE * 0.92 + HIT_TOP;
            const left = Math.min(Math.max(4, offsetX + x - BUBBLE_W / 2), groundW - BUBBLE_W - 4);
            const tree = selected.tree;
            return (
              <View
                style={[styles.bubble, { left, top: Math.max(2, treeTop - BUBBLE_H) }]}
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
                  {onOpenBook ? <Button size="sm" label={t('forest.openBook')} onPress={() => onOpenBook(tree)} style={styles.flex} /> : null}
                  {onChangeSpecies ? (
                    <Button size="sm" variant="soft" label={t('forest.changeTree')} onPress={() => onChangeSpecies(tree)} style={styles.flex} />
                  ) : null}
                </View>
              </View>
            );
          })()
        : null}
    </Pressable>
  );

  return (
    <View onLayout={onLayout} style={styles.viewport}>
      {W > viewportW && viewportW > 0 ? (
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!drag}>
          {garden}
        </ScrollView>
      ) : (
        garden
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { width: '100%', alignItems: 'center' },
  hit: { position: 'absolute', width: HIT_W, height: TREE * 0.92 - HIT_TOP },
  dragging: { zIndex: 30 },
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
