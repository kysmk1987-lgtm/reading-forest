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
const BUBBLE_H = 140;
/** Bubble wrapper height (twice the tallest bubble). */
const BUBBLE_ANCHOR_H = 400;
const DRAG_SLOP = 8;
const READER = 34;
/** The card keeps this height at most; bigger forests are panned (drag in any direction). */
const VIEW_MAX_H = 380;
const PAN_SLOP = 6;
/** On web the DOM click that ends a pan still reaches the Pressable under the pointer. */
const PAN_CLICK_GUARD_MS = 350;
/** Pinch / ctrl+wheel zoom: up to 2.5×, down to "whole forest fits" but never below ZOOM_FLOOR. */
const ZOOM_MAX = 2.5;
const ZOOM_FLOOR = 0.4;
const ZOOM_STEP = 1.25;
const ZOOM_SETTLE_MS = 120;
/** Browser pinch-zoom is always off over the forest (our own pinch handles it); single-finger scrolling stays where we don't pan. */
const webPan = (axes: 'x' | 'y' | 'both' | null) =>
  ({
    cursor: axes ? 'grab' : undefined,
    userSelect: 'none',
    touchAction: axes === 'both' ? 'none' : axes === 'x' ? 'pan-y' : axes === 'y' ? 'pan-x' : 'pan-x pan-y',
  }) as unknown as ViewStyle;

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

type Point = { x: number; y: number };
type TouchPoint = { pageX: number; pageY: number };

/** Viewport and (unscaled) content sizes, the zoom range floor and the land diamond (content coordinates: centre and half extents). */
type PanBounds = {
  viewW: number;
  viewH: number;
  contentW: number;
  contentH: number;
  minScale: number;
  land: { cx: number; cy: number; a: number; b: number };
};

const midpoint = (p: readonly TouchPoint[]): Point =>
  p.length >= 2 ? { x: (p[0].pageX + p[1].pageX) / 2, y: (p[0].pageY + p[1].pageY) / 2 } : { x: p[0].pageX, y: p[0].pageY };
const spread = (p: readonly TouchPoint[]) => Math.max(1, Math.hypot(p[0].pageX - p[1].pageX, p[0].pageY - p[1].pageY));

/**
 * Drag-to-look-around and pinch-to-zoom for the garden viewport (mouse and touch, via the responder system).
 * One finger pans once it moves (so taps still reach trees and tiles); two fingers always zoom around their
 * midpoint. It never steals a tree that is being dragged in 옮겨 심기 (DraggableTree refuses to hand over its responder).
 * `at` is the content's top-left in viewport coordinates and `scale` its zoom, so screen = at + scale × content.
 */
class GardenPan {
  readonly value = new Animated.ValueXY({ x: 0, y: 0 });
  readonly scaleValue = new Animated.Value(1);
  scale = 1;
  private at: Point = { x: 0, y: 0 };
  private bounds: PanBounds = { viewW: 0, viewH: 0, contentW: 0, contentH: 0, minScale: 1, land: { cx: 0, cy: 0, a: 1, b: 1 } };
  private endedAt = 0;
  private gesture: { count: number; at: Point; scale: number; mid: Point; dist: number; origin: Point } | null = null;
  private settle: ReturnType<typeof setTimeout> | undefined;
  private locate: () => Point = () => ({ x: 0, y: 0 });
  private onZoom: (scale: number) => void = () => {};

  /**
   * `onZoom` gets the settled zoom (React state for the bubble size, web touch-action and the zoom buttons);
   * `locate` returns the viewport's top-left in page coordinates (the space of touch pageX/pageY).
   */
  attach(onZoom: (scale: number) => void, locate: () => Point) {
    this.onZoom = onZoom;
    this.locate = locate;
  }

  canPan(s = this.scale) {
    const { viewW, viewH, contentW, contentH } = this.bounds;
    return { x: contentW * s > viewW + 1, y: contentH * s > viewH + 1 };
  }

  get minScale() {
    return this.bounds.minScale;
  }

  readonly responder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, g) => {
      if (e.nativeEvent.touches.length >= 2) return true;
      const ax = Math.abs(g.dx);
      const ay = Math.abs(g.dy);
      if (Math.max(ax, ay) < PAN_SLOP) return false;
      const can = this.canPan();
      // One pannable axis: leave the other direction to the page scroll.
      return (can.x && can.y) || (can.x && ax > ay) || (can.y && ay > ax);
    },
    onPanResponderGrant: (e) => {
      this.sync();
      this.begin(this.points(e));
    },
    onPanResponderMove: (e) => this.move(this.points(e)),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => this.end(),
    onPanResponderTerminate: () => this.end(),
  });

  private points(e: GestureResponderEvent): readonly TouchPoint[] {
    const { touches } = e.nativeEvent;
    return touches.length ? touches : [e.nativeEvent];
  }

  /** Stops a running reveal/zoom animation where it is on screen. */
  private sync() {
    const { contentW, contentH } = this.bounds;
    let s = this.scale;
    this.scaleValue.stopAnimation((v) => (s = v));
    this.value.stopAnimation((v) => {
      this.scale = s;
      this.at = { x: v.x + (contentW / 2) * (1 - s), y: v.y + (contentH / 2) * (1 - s) };
    });
  }

  private begin(points: readonly TouchPoint[]) {
    const two = points.length >= 2;
    this.gesture = {
      count: two ? 2 : 1,
      at: { ...this.at },
      scale: this.scale,
      mid: midpoint(points),
      dist: two ? spread(points) : 1,
      origin: two ? this.locate() : { x: 0, y: 0 },
    };
  }

  private move(points: readonly TouchPoint[]) {
    const g = this.gesture;
    // A finger added or lifted: restart from here so nothing jumps.
    if (!g || g.count !== (points.length >= 2 ? 2 : 1)) return this.begin(points);
    const mid = midpoint(points);
    if (g.count === 1) return this.to(g.at.x + mid.x - g.mid.x, g.at.y + mid.y - g.mid.y);
    const s = this.clampScale((g.scale * spread(points)) / g.dist);
    // The content point under the starting midpoint stays under the fingers.
    const px = (g.mid.x - g.origin.x - g.at.x) / g.scale;
    const py = (g.mid.y - g.origin.y - g.at.y) / g.scale;
    this.to(mid.x - g.origin.x - px * s, mid.y - g.origin.y - py * s, s);
  }

  private end() {
    const zoomed = this.gesture?.count === 2;
    this.gesture = null;
    this.endedAt = Date.now();
    if (zoomed) this.notify(true);
  }

  private notify(now: boolean) {
    clearTimeout(this.settle);
    if (now) this.onZoom(this.scale);
    else this.settle = setTimeout(() => this.onZoom(this.scale), ZOOM_SETTLE_MS);
  }

  private clampScale(s: number) {
    return clamp(s, this.bounds.minScale, ZOOM_MAX);
  }

  /** New size (땅 넓히기, more trees, rotation): keep the zoom (within the new range) and start centred again. */
  resize(bounds: PanBounds) {
    this.bounds = bounds;
    const s = this.clampScale(this.scale);
    this.to(bounds.viewW / 2 - bounds.land.cx * s, bounds.viewH / 2 - bounds.land.cy * s, s);
    this.notify(true);
  }

  /**
   * Keeps the content inside the viewport (centred while it is smaller) and the viewport centre over the land,
   * so the forest never drifts out of sight at any zoom.
   */
  private clampPan(x: number, y: number, s: number) {
    const { viewW, viewH, contentW, contentH, land } = this.bounds;
    const fit = (v: number, view: number, size: number) => (size <= view ? (view - size) / 2 : clamp(v, view - size, 0));
    x = fit(x, viewW, contentW * s);
    y = fit(y, viewH, contentH * s);
    const dx = (viewW / 2 - x) / s - land.cx;
    const dy = (viewH / 2 - y) / s - land.cy;
    const outside = Math.abs(dx) / land.a + Math.abs(dy) / land.b;
    if (outside > 1) {
      x = fit(viewW / 2 - (land.cx + dx / outside) * s, viewW, contentW * s);
      y = fit(viewH / 2 - (land.cy + dy / outside) * s, viewH, contentH * s);
    }
    return { x, y };
  }

  to(x: number, y: number, s = this.scale, animated = false) {
    this.scale = this.clampScale(s);
    this.at = this.clampPan(x, y, this.scale);
    const { contentW, contentH } = this.bounds;
    // RN scales around the view centre; shift so the top-left stays the anchor.
    const shown = { x: this.at.x - (contentW / 2) * (1 - this.scale), y: this.at.y - (contentH / 2) * (1 - this.scale) };
    if (animated) {
      Animated.parallel([
        Animated.timing(this.value, { toValue: shown, duration: 220, useNativeDriver: false }),
        Animated.timing(this.scaleValue, { toValue: this.scale, duration: 220, useNativeDriver: false }),
      ]).start();
    } else {
      this.value.setValue(shown);
      this.scaleValue.setValue(this.scale);
    }
  }

  /** Zooms by `factor` around a viewport point (default: the viewport centre). */
  zoomBy(factor: number, focus?: Point, animated = false) {
    this.zoomTo(this.scale * factor, focus, animated);
  }

  zoomTo(target: number, focus?: Point, animated = false) {
    const { viewW, viewH } = this.bounds;
    const f = focus ?? { x: viewW / 2, y: viewH / 2 };
    const s = this.clampScale(target);
    const px = (f.x - this.at.x) / this.scale;
    const py = (f.y - this.at.y) / this.scale;
    this.to(f.x - px * s, f.y - py * s, s, animated);
    this.notify(animated);
  }

  /** True right after a pan ended: on web its DOM click still reaches the Pressable under the pointer. */
  justPanned() {
    return Date.now() - this.endedAt < PAN_CLICK_GUARD_MS;
  }

  /** Pans just enough to bring a content rectangle (e.g. the book bubble) into view. */
  reveal(x0: number, y0: number, x1: number, y1: number) {
    const { viewW, viewH } = this.bounds;
    const s = this.scale;
    let { x, y } = this.at;
    if (x0 * s + x < 4) x = 4 - x0 * s;
    else if (x1 * s + x > viewW - 4) x = viewW - 4 - x1 * s;
    if (y0 * s + y < 4) y = 4 - y0 * s;
    else if (y1 * s + y > viewH - 4) y = viewH - 4 - y1 * s;
    if (x !== this.at.x || y !== this.at.y) this.to(x, y, s, true);
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

  // ─── Panning and zoom: the garden moves and scales inside a fixed viewport ───
  const groundW = Math.max(W, viewportW);
  const viewH = Math.min(H, VIEW_MAX_H);
  const minScale = viewportW > 0 ? Math.min(1, Math.max(ZOOM_FLOOR, Math.min(viewportW / W, viewH / H))) : 1;
  const [pan] = useState(() => new GardenPan());
  /** Settled zoom (the live value is animated without re-rendering). */
  const [zoom, setZoom] = useState(1);
  const viewRef = useRef<View>(null);
  const canX = groundW * zoom > viewportW + 1;
  const canY = H * zoom > viewH + 1;
  const panAxes = canX && canY ? 'both' : canX ? 'x' : canY ? 'y' : null;
  useEffect(() => {
    let origin = { x: 0, y: 0 };
    pan.attach(setZoom, () => {
      const node = viewRef.current;
      if (!node) return origin;
      if (Platform.OS === 'web') {
        const rect = (node as unknown as HTMLElement).getBoundingClientRect();
        return { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
      }
      // Synchronous on the new architecture; otherwise the last measurement is used.
      node.measure((_x, _y, _w, _h, pageX, pageY) => (origin = { x: pageX, y: pageY }));
      return origin;
    });
  }, [pan]);
  // New size (땅 넓히기, more trees, rotation): start centred again.
  useEffect(
    () =>
      pan.resize({
        viewW: viewportW,
        viewH,
        contentW: groundW,
        contentH: H,
        minScale,
        // A tree's height (and its book bubble) of slack around the diamond, so zoomed-in edge trees stay reachable.
        land: { cx: groundW / 2, cy: HEAD + (n * TH) / 2, a: W / 2 + TW, b: (n * TH) / 2 + HEAD },
      }),
    [pan, viewportW, viewH, groundW, H, minScale, n, W],
  );
  // Web: ctrl/⌘ + wheel and trackpad pinch zoom (a plain wheel keeps scrolling the page); Safari sends gesture events.
  useEffect(() => {
    const node = viewRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !node?.addEventListener) return;
    const focus = (e: { clientX: number; clientY: number }) => {
      const rect = node.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -60, 60);
      pan.zoomBy(Math.exp(-delta * 0.01), focus(e));
    };
    let gestureFrom = 1;
    const touchScreen = 'ontouchstart' in window;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureFrom = pan.scale;
    };
    // On touch screens the responder pinch already handles it (Safari also fires these alongside touches).
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale?: number; clientX: number; clientY: number };
      if (!touchScreen && g.scale) pan.zoomTo(gestureFrom * g.scale, focus(g));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('gesturestart', onGestureStart);
    node.addEventListener('gesturechange', onGestureChange);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', onGestureStart);
      node.removeEventListener('gesturechange', onGestureChange);
    };
  }, [pan]);

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
  /** Finger movement on screen → movement in garden coordinates. */
  const unzoom = (o: Offset): Offset => ({ dx: o.dx / pan.scale, dy: o.dy / pan.scale });
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
  /**
   * Book bubble above the tree on tile (c, r), kept inside the garden: its bottom-centre anchor and its box
   * in garden coordinates. The bubble keeps its on-screen size at any zoom (counter-scaled by 1 / zoom).
   */
  const bubbleBox = (c: number, r: number) => {
    const { x, y } = tileTop(c, r);
    const treeTop = y + TH / 2 - TREE * 0.92 + HIT_TOP;
    const halfW = BUBBLE_W / 2 / zoom;
    const h = BUBBLE_H / zoom;
    const ax = Math.min(Math.max(4 + halfW, offsetX + x), groundW - 4 - halfW);
    const ay = Math.max(2 + h, treeTop);
    return { ax, ay, left: ax - halfW, top: ay - h, right: ax + halfW };
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
              onDrag={(o) => setDrag(o ? { id: tree.id, ...unzoom(o) } : null)}
              onDrop={(o) => {
                lastTreeGesture.current = Date.now();
                const target = dropTile({ c, r }, unzoom(o));
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
                pan.reveal(box.left, box.top, box.right, y + TH);
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
            const { ax, ay } = bubbleBox(selected.c, selected.r);
            const tree = selected.tree;
            return (
              <View style={[styles.bubbleAnchor, { left: ax - BUBBLE_W, top: ay - BUBBLE_ANCHOR_H / 2, transform: [{ scale: 1 / zoom }] }]}>
              <View
                style={styles.bubble}
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
              </View>
            );
          })()
        : null}
    </Pressable>
  );

  return (
    <View
      ref={viewRef}
      onLayout={onLayout}
      style={[styles.viewport, { height: viewH }, Platform.OS === 'web' ? webPan(panAxes) : null]}
      {...pan.responder.panHandlers}>
      {viewportW > 0 ? (
        <Animated.View
          style={[
            styles.content,
            { width: groundW, height: H, transform: [...pan.value.getTranslateTransform(), { scale: pan.scaleValue }] },
          ]}>
          {garden}
        </Animated.View>
      ) : null}

      {weather !== 'clear' && viewportW > 0 ? <WeatherLayer kind={weather} width={viewportW} height={viewH} /> : null}

      {hint ? (
        <View style={[styles.emptySign, styles.hint, { top: 8 }]}>
          <AppText variant="caption" center>
            {hint}
          </AppText>
        </View>
      ) : null}

      {Platform.OS === 'web' && viewportW > 0 ? (
        <View style={styles.zoomButtons}>
          {(
            [
              { label: '+', a11y: t('forest.zoomIn'), factor: ZOOM_STEP, off: zoom >= ZOOM_MAX - 0.01 },
              { label: '−', a11y: t('forest.zoomOut'), factor: 1 / ZOOM_STEP, off: zoom <= minScale + 0.01 },
            ] as const
          ).map((b) => (
            <Pressable
              key={b.label}
              accessibilityRole="button"
              accessibilityLabel={b.a11y}
              accessibilityState={{ disabled: b.off }}
              disabled={b.off}
              onPress={() => pan.zoomBy(b.factor, undefined, true)}
              style={({ pressed }) => [styles.zoomButton, b.off && styles.zoomOff, pressed && styles.zoomPressed]}>
              <AppText style={styles.zoomLabel}>{b.label}</AppText>
            </Pressable>
          ))}
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
  zoomButtons: { position: 'absolute', right: 8, bottom: 8, gap: 6, zIndex: 26 },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,246,0.92)',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderBottomWidth: 3,
  },
  zoomOff: { opacity: 0.45 },
  zoomPressed: { transform: [{ translateY: 1 }], borderBottomWidth: 2 },
  zoomLabel: { fontSize: 18, lineHeight: 20, color: colors.text },
  /** Centred on the bubble's bottom-centre so scaling it (1 / zoom) keeps the bubble pinned above the tree. */
  bubbleAnchor: { pointerEvents: 'box-none', position: 'absolute', width: BUBBLE_W * 2, height: BUBBLE_ANCHOR_H, zIndex: 20 },
  bubble: {
    position: 'absolute',
    left: BUBBLE_W / 2,
    bottom: BUBBLE_ANCHOR_H / 2,
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
