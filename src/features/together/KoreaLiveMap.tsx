import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Button, Card, showToast } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { useMyRegion } from '@/stores/togetherStore';
import { palette, radius, spacing } from '@/theme';

import { DOKDO, KOREA_MAP_VIEWBOX, KOREA_REGION_SHAPES } from './koreaMapData';
import { CHEER_EMOJIS, countsByRegion, sendCheer, usePresenceStore } from './presence';
import { LABEL_OFFSETS, REGIONS, regionName, type RegionKey } from './regions';

const SEA = '#DDF2FB';
const LAND = '#F6EFDD';
const SHADES = ['#E3F1D2', '#C8E6AE', '#A6D68A', '#85C46C'];
const STROKE = '#FFFDF6';

function shadeFor(count: number, max: number) {
  if (count <= 0) return LAND;
  const idx = Math.min(SHADES.length - 1, Math.floor((count / Math.max(1, max)) * (SHADES.length - 0.01)));
  return SHADES[idx];
}

function MiniTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G x={x} y={y} scale={s}>
      <Rect x={-1.2} y={-1} width={2.4} height={5} rx={1} fill={palette.woodDeep} />
      <Circle cx={0} cy={-4} r={4.6} fill={palette.leafDeep} />
      <Circle cx={-1.4} cy={-5.4} r={1.6} fill={palette.leaf} />
    </G>
  );
}

export function KoreaLiveMap() {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const mode = usePresenceStore((s) => s.mode);
  const peers = usePresenceStore((s) => s.peers);
  const myRegion = useMyRegion();
  const [selected, setSelected] = useState<RegionKey | null>(null);
  const { counts, total, unknown } = useMemo(() => countsByRegion(peers), [peers]);
  const max = Math.max(1, ...Object.values(counts));
  const mapWidth = Math.min(windowWidth, 480) - spacing.lg * 2 - 8;
  const mapHeight = (mapWidth / KOREA_MAP_VIEWBOX.width) * KOREA_MAP_VIEWBOX.height;
  const self = peers.find((p) => p.self);

  const select = (key: RegionKey) => {
    tapFeedback();
    setSelected((cur) => (cur === key ? null : key));
  };

  const cheer = async (emoji: string) => {
    if (!selected) return;
    const result = await sendCheer(selected, emoji);
    if (result === 'sent') showToast(t('together.map.cheerSent', { region: regionName(selected), emoji }));
    else if (result === 'cooldown') showToast(t('together.map.cheerCooldown'));
    else showToast(t('together.map.cheerOffline'));
  };

  return (
    <View style={styles.root}>
      <Card tint={palette.leafSoft} edgeColor={palette.leaf} style={styles.headline}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, mode === 'live' ? styles.badgeLive : mode === 'demo' ? styles.badgeDemo : null]}>
            <AppText variant="tiny" color={mode === 'live' ? palette.white : palette.brown}>
              {mode === 'live' ? `● ${t('together.map.live')}` : mode === 'demo' ? `🧪 ${t('together.map.demo')}` : t('together.map.connecting')}
            </AppText>
          </View>
          {self ? (
            <AppText variant="tiny" color={palette.leafDeep}>
              🌱 {t('together.map.youAreCounted')}
            </AppText>
          ) : null}
        </View>
        <AppText variant="subtitle" accessibilityLabel="readers-headline">
          {t('together.map.headline', { count: total })}
        </AppText>
        <AppText variant="caption" muted>
          {mode === 'demo' ? t('together.map.demoBody') : t('together.map.body')}
        </AppText>
      </Card>

      <View style={[styles.mapBox, { height: mapHeight + 8 }]}>
        <Svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${KOREA_MAP_VIEWBOX.width} ${KOREA_MAP_VIEWBOX.height}`}>
          <Rect x={0} y={0} width={KOREA_MAP_VIEWBOX.width} height={KOREA_MAP_VIEWBOX.height} rx={18} fill={SEA} />
          {REGIONS.map((r) => {
            const shape = KOREA_REGION_SHAPES[r.key];
            const isSel = selected === r.key;
            return (
              <Path
                key={r.key}
                d={shape.d}
                fill={isSel ? palette.yellow : shadeFor(counts[r.key], max)}
                stroke={isSel ? palette.yellowDeep : STROKE}
                strokeWidth={isSel ? 1.6 : 0.9}
                strokeLinejoin="round"
                onPress={() => select(r.key)}
              />
            );
          })}
          <Circle cx={DOKDO.x} cy={DOKDO.y} r={1.4} fill={shadeFor(counts.gyeongbuk, max)} stroke={palette.stoneDeep} strokeWidth={0.4} />
          <SvgText x={DOKDO.x} y={DOKDO.y + 7} fontSize={5} fill={palette.brownSoft} textAnchor="middle">
            독도
          </SvgText>
          {REGIONS.map((r) => {
            const shape = KOREA_REGION_SHAPES[r.key];
            const off = LABEL_OFFSETS[r.key] ?? { dx: 0, dy: 0 };
            const x = shape.cx + off.dx;
            const y = shape.cy + off.dy;
            const n = counts[r.key];
            const mine = myRegion === r.key;
            return (
              <G key={`l-${r.key}`} onPress={() => select(r.key)}>
                {n > 0 ? <MiniTree x={x - 9} y={y - 1} s={0.85} /> : null}
                <SvgText x={n > 0 ? x + 1 : x} y={y + 2} fontSize={7} fontWeight="bold" fill={palette.brown} textAnchor={n > 0 ? 'start' : 'middle'}>
                  {n > 0 ? `${r.name} ${n}` : r.name}
                </SvgText>
                {mine ? <Circle cx={x} cy={y + 6} r={1.6} fill={palette.pinkDeep} /> : null}
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        {SHADES.map((c, i) => (
          <View key={c} style={[styles.swatch, { backgroundColor: c }]}>
            {i === 0 ? <AppText variant="tiny">{t('together.map.few')}</AppText> : null}
            {i === SHADES.length - 1 ? <AppText variant="tiny">{t('together.map.many')}</AppText> : null}
          </View>
        ))}
      </View>

      {selected ? (
        <Card style={styles.cheerCard}>
          <AppText variant="subtitle">
            {t('together.map.regionReaders', { region: regionName(selected), count: counts[selected] })}
          </AppText>
          <AppText variant="caption" muted>
            {t('together.map.cheerBody')}
          </AppText>
          <View style={styles.emojiRow}>
            {CHEER_EMOJIS.map((e) => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={`cheer ${e}`}
                onPress={() => cheer(e)}
                style={({ pressed }) => [styles.emojiBtn, pressed && { transform: [{ scale: 0.9 }] }]}>
                <AppText style={styles.emoji}>{e}</AppText>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <AppText variant="caption" muted center>
          {t('together.map.tapHint')}
        </AppText>
      )}

      <View style={styles.footer}>
        <AppText variant="tiny" muted style={styles.flex}>
          📍 {myRegion ? t('together.map.myRegion', { region: regionName(myRegion) }) : t('together.map.noRegion')}
          {unknown > 0 ? ` · ${t('together.map.unknownReaders', { count: unknown })}` : ''}
        </AppText>
        <Button size="sm" variant="soft" label={t('together.map.changeRegion')} onPress={() => router.push('/my')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  headline: { gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: palette.sand },
  badgeLive: { backgroundColor: palette.leafDeep },
  badgeDemo: { backgroundColor: palette.yellow },
  mapBox: { alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignSelf: 'center', borderRadius: radius.pill, overflow: 'hidden' },
  swatch: { width: 52, height: 18, alignItems: 'center', justifyContent: 'center' },
  cheerCard: { gap: spacing.sm },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: palette.leafSoft,
  },
  emoji: { fontSize: 22, lineHeight: 28 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
