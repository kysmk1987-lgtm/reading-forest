import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, G, Polygon } from 'react-native-svg';

import { BookCover } from '@/components/BookCover';
import { AppText, Button, ProgressBar } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { colors, palette, radius, softShadow, spacing } from '@/theme';

import { AnimatedTree } from './AnimatedTree';
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

export function gardenSize(treeCount: number) {
  return Math.max(3, Math.ceil(Math.sqrt(treeCount + 2)));
}

/** Tiles ordered from the middle outwards so the first books sit in the centre of the garden. */
function tileOrder(n: number) {
  const m = (n - 1) / 2;
  const tiles: { c: number; r: number }[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) tiles.push({ c, r });
  return tiles.sort((a, b) => (a.c - m) ** 2 + (a.r - m) ** 2 - ((b.c - m) ** 2 + (b.r - m) ** 2) || a.c + a.r - (b.c + b.r));
}

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
}

export function ForestGarden({ trees, weather = 'clear', onOpenBook, onChangeSpecies, emptyLabel }: ForestGardenProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewportW, setViewportW] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const n = gardenSize(trees.length);
  const W = n * TW;
  const H = HEAD + n * TH + DEPTH + 6;
  const tileTop = (c: number, r: number) => ({ x: W / 2 + ((c - r) * TW) / 2, y: HEAD + ((c + r) * TH) / 2 });

  const placed = useMemo(() => {
    const order = tileOrder(n);
    return [...trees]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((tree, i) => ({ tree, ...order[i] }))
      .sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);
  }, [trees, n]);

  const occupied = new Set(placed.map((p) => `${p.c}:${p.r}`));
  const selected = placed.find((p) => p.tree.id === selectedId);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setViewportW(w);
    if (W > w) requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: (W - w) / 2, animated: false }));
  };

  const groundW = Math.max(W, viewportW);
  const offsetX = (groundW - W) / 2;
  const bottomY = HEAD + n * TH;
  const midY = HEAD + (n * TH) / 2;

  const garden = (
    <Pressable onPress={() => setSelectedId(null)} style={{ width: groundW, height: H }} accessible={false}>
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
            const isSelected = selected && selected.c === c && selected.r === r;
            const deco = !occupied.has(`${c}:${r}`) ? hash(i + n * 7) : -1;
            const cx = x + (hash(i + 3) - 0.5) * 16;
            const cy = y + TH / 2 + (hash(i + 5) - 0.5) * 8;
            return (
              <G key={i}>
                <Polygon
                  points={`${x},${y} ${x + TW / 2},${y + TH / 2} ${x},${y + TH} ${x - TW / 2},${y + TH / 2}`}
                  fill={isSelected ? '#C9EBA5' : (c + r) % 2 ? '#A8DC86' : '#9DD47C'}
                  stroke={isSelected ? palette.yellowDeep : '#8EC86E'}
                  strokeWidth={isSelected ? 2 : 1}
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
        return (
          <Pressable
            key={tree.id}
            accessibilityRole="button"
            accessibilityLabel={tree.title}
            onPress={() => {
              tapFeedback();
              setSelectedId(tree.id === selectedId ? null : tree.id);
            }}
            style={[styles.hit, { left: offsetX + x - HIT_W / 2, top: y + TH / 2 - TREE * 0.92 + HIT_TOP }]}>
            <View style={styles.treeArt}>
              <AnimatedTree {...look} species={tree.species} size={TREE} phaseMs={(i * 270) % 1800} swayDegrees={2.5} />
            </View>
          </Pressable>
        );
      })}

      {weather !== 'clear' ? <WeatherLayer kind={weather} width={groundW} height={H} /> : null}

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
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
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
