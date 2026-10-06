import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { fonts } from '@/theme';

import type { WrappedStats } from './compute';
import { PersonaArt } from './PersonaArt';
import type { Persona } from './personas';

export type SummaryAspect = 'story' | 'square';

interface Props {
  stats: WrappedStats;
  persona: Persona;
  personaName: string;
  tagline: string;
  periodLabel: string;
  nickname: string;
  labels: { books: string; pages: string; focus: string; trees: string; streak: string; cards: string };
  aspect: SummaryAspect;
  width: number;
}

export function formatFocus(minutes: number, compact = false) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}분`;
  return m && !(compact && h >= 10) ? `${h}시간 ${m}분` : `${h}시간`;
}

const isLight = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16) > 600;

/** Final shareable report card (9:16 story or 1:1 square). */
export const WrappedSummaryCard = forwardRef<View, Props>(function WrappedSummaryCard(
  { stats, persona, personaName, tagline, periodLabel, nickname, labels, aspect, width },
  ref,
) {
  const height = aspect === 'story' ? Math.round((width * 16) / 9) : width;
  const u = width / 100;
  const { bg, accent, ink } = persona.colors;
  const items = [
    { k: labels.books, v: `${stats.booksFinished}권` },
    { k: labels.pages, v: `${stats.pages.toLocaleString()}쪽` },
    { k: labels.focus, v: formatFocus(stats.focusMinutes, true) },
    { k: labels.trees, v: `${stats.treesPlanted}그루` },
    { k: labels.streak, v: `${stats.longestStreak}일` },
    { k: labels.cards, v: `${stats.quoteCards}장` },
  ];
  const story = aspect === 'story';
  return (
    <View ref={ref} collapsable={false} style={{ width, height, borderRadius: 4 * u, overflow: 'hidden' }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="wsc" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={bg[0]} />
            <Stop offset="1" stopColor={bg[1]} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#wsc)" />
      </Svg>
      <View style={[styles.inner, { padding: 6 * u, gap: (story ? 4 : 2.2) * u }]}>
        <Text style={[styles.text, { color: ink, fontSize: 4 * u, opacity: 0.85 }]}>
          {periodLabel} · {nickname}
        </Text>
        <PersonaArt persona={persona} size={(story ? 52 : 30) * u} />
        <Text style={[styles.text, { color: ink, fontSize: (story ? 8 : 6.4) * u }]}>
          {persona.emoji} {personaName}
        </Text>
        <Text style={[styles.text, { color: ink, fontSize: (story ? 4.4 : 3.6) * u, lineHeight: (story ? 6.6 : 5.2) * u, opacity: 0.9 }]}>{tagline}</Text>
        <View style={[styles.grid, { gap: 2 * u, marginTop: (story ? 2 : 0.5) * u }]}>
          {items.map((it) => (
            <View
              key={it.k}
              style={[
                styles.cell,
                { borderRadius: 3 * u, paddingVertical: (story ? 2.6 : 1.6) * u, borderColor: accent, backgroundColor: isLight(ink) ? 'rgba(255,255,255,0.12)' : 'rgba(255,253,246,0.6)' },
              ]}>
              <Text style={[styles.text, { color: ink, fontSize: (story ? 5.4 : 4.4) * u }]}>{it.v}</Text>
              <Text style={[styles.text, { color: ink, fontSize: 2.8 * u, opacity: 0.75 }]}>{it.k}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.text, { color: ink, fontSize: 3 * u, opacity: 0.7, marginTop: 'auto' }]}>🌳 독서의숲 · 독서 DNA 리포트</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.body, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  cell: { width: '31%', alignItems: 'center', borderWidth: 2 },
});
