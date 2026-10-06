import { forwardRef, memo, useId } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { fontById } from './fonts';
import { aspectRatio, templateById, type CardAlign, type CardDecor, type CardTextSize } from './templates';

export interface QuoteCardDesign {
  template: string;
  font: string;
  aspect: string;
  align: CardAlign;
  size: CardTextSize;
  showFooter: boolean;
}

export const DEFAULT_DESIGN: QuoteCardDesign = { template: 'paper', font: 'myeongjo', aspect: 'story', align: 'center', size: 'm', showFooter: true };

export interface QuoteCardViewProps {
  design: QuoteCardDesign;
  quote: string;
  bookTitle: string;
  author?: string;
  width: number;
  /** Shown instead of the quote while it's empty. */
  placeholder?: string;
}

const SIZE_FACTOR: Record<CardTextSize, number> = { s: 0.056, m: 0.068, l: 0.084 };

function lengthFactor(len: number) {
  if (len > 260) return 0.62;
  if (len > 180) return 0.72;
  if (len > 110) return 0.85;
  return 1;
}

const Decor = memo(function Decor({ decor, w, h, accent, gid }: { decor: CardDecor; w: number; h: number; accent: string; gid: string }) {
  switch (decor) {
    case 'paper':
      return (
        <G>
          {Array.from({ length: Math.floor(h / 34) }, (_, i) => (
            <Line key={i} x1={w * 0.08} x2={w * 0.92} y1={50 + i * 34} y2={50 + i * 34} stroke="#E9DCC1" strokeWidth={1} />
          ))}
          <Line x1={w * 0.13} x2={w * 0.13} y1={0} y2={h} stroke="#F2C7C0" strokeWidth={1.4} />
          <Path d={`M${w - 46} 26 q16 -6 26 8 q-14 10 -26 -8 z`} fill={accent} opacity={0.7} />
        </G>
      );
    case 'forest':
      return (
        <G>
          {[0.08, 0.26, 0.5, 0.72, 0.9].map((x, i) => (
            <G key={x}>
              <Rect x={w * x - 3} y={h - 40 - (i % 2) * 14} width={6} height={42} fill="#8A6B4B" opacity={0.55} />
              <Circle cx={w * x} cy={h - 52 - (i % 2) * 14} r={26 + (i % 3) * 6} fill="#7DBE62" opacity={0.45} />
            </G>
          ))}
          <Path d={`M30 40 q14 -10 26 4 q-14 8 -26 -4 z`} fill="#5FA85A" opacity={0.5} />
          <Path d={`M${w - 60} 70 q14 -10 26 4 q-14 8 -26 -4 z`} fill="#5FA85A" opacity={0.4} />
        </G>
      );
    case 'night':
      return (
        <G>
          <Circle cx={w * 0.8} cy={h * 0.1} r={22} fill="#F4D58D" />
          <Circle cx={w * 0.8 + 9} cy={h * 0.1 - 6} r={19} fill="#262C55" />
          {Array.from({ length: 22 }, (_, i) => (
            <Circle key={i} cx={(i * 97) % w} cy={(i * 53) % (h * 0.6)} r={i % 4 === 0 ? 1.8 : 1} fill="#F7F1DE" opacity={0.8} />
          ))}
          <Path d={`M0 ${h} L0 ${h * 0.9} Q${w * 0.3} ${h * 0.84} ${w * 0.55} ${h * 0.9} T${w} ${h * 0.88} L${w} ${h} Z`} fill="#141832" opacity={0.7} />
        </G>
      );
    case 'watercolor':
      return (
        <G>
          <Circle cx={w * 0.12} cy={h * 0.12} r={w * 0.28} fill="#F7B7C5" opacity={0.28} />
          <Circle cx={w * 0.95} cy={h * 0.3} r={w * 0.22} fill="#9ED8F0" opacity={0.28} />
          <Circle cx={w * 0.2} cy={h * 0.92} r={w * 0.3} fill="#CDBBF0" opacity={0.25} />
          <Circle cx={w * 0.85} cy={h * 0.95} r={w * 0.2} fill="#F9DC7A" opacity={0.25} />
        </G>
      );
    case 'sakura':
      return (
        <G>
          {Array.from({ length: 14 }, (_, i) => {
            const x = (i * 71) % w;
            const y = (i * 113) % h;
            return <Ellipse key={i} cx={x} cy={y} rx={7} ry={4} fill={i % 2 ? '#F7B7C5' : '#FFFFFF'} opacity={0.75} rotation={(i * 37) % 180} origin={`${x}, ${y}`} />;
          })}
        </G>
      );
    case 'ocean':
      return (
        <G>
          {[0.84, 0.9, 0.96].map((y, i) => (
            <Path
              key={y}
              d={`M0 ${h * y} q${w / 8} -14 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0 V${h} H0 Z`}
              fill={['#7FC4E2', '#5FB4D9', '#4A9CC2'][i]}
              opacity={0.6}
            />
          ))}
          <Circle cx={w * 0.18} cy={h * 0.12} r={20} fill={`url(#sun-${gid})`} />
        </G>
      );
  }
});

/** The quote card artwork (preview and export use the same view). */
export const QuoteCardView = forwardRef<View, QuoteCardViewProps>(function QuoteCardView(
  { design, quote, bookTitle, author, width, placeholder },
  ref,
) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tpl = templateById(design.template);
  const font = fontById(design.font);
  const height = Math.round(width / aspectRatio(design.aspect));
  const text = quote.trim() || placeholder || '';
  const fontSize = Math.round(width * SIZE_FACTOR[design.size] * font.scale * lengthFactor(text.length) * 10) / 10;
  const pad = width * 0.1;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width, height, backgroundColor: tpl.bg[1] }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bg-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tpl.bg[0]} />
            <Stop offset="1" stopColor={tpl.bg[1]} />
          </LinearGradient>
          <LinearGradient id={`sun-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF4C2" />
            <Stop offset="1" stopColor="#F9DC7A" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#bg-${gid})`} />
        <Decor decor={tpl.id} w={width} h={height} accent={tpl.accent} gid={gid} />
      </Svg>
      <View style={[styles.body, { paddingHorizontal: pad, paddingTop: pad * 1.2, paddingBottom: pad * 0.6 }]}>
        <Text style={[styles.mark, { color: tpl.accent, fontSize: width * 0.14, textAlign: design.align }]}>“</Text>
        <Text
          style={[
            styles.quote,
            webWrap,
            {
              fontFamily: font.family,
              fontSize,
              lineHeight: fontSize * 1.55,
              color: quote.trim() ? tpl.text : tpl.sub,
              textAlign: design.align,
            },
          ]}>
          {text}
        </Text>
        {design.showFooter ? (
          <View style={[styles.footer, { alignItems: design.align === 'center' ? 'center' : design.align === 'left' ? 'flex-start' : 'flex-end' }]}>
            <View style={[styles.rule, { backgroundColor: tpl.accent }]} />
            <Text numberOfLines={2} style={[styles.book, { color: tpl.text, fontFamily: font.family, fontSize: width * 0.042 * font.scale, textAlign: design.align }]}>
              『{bookTitle}』
            </Text>
            {author ? (
              <Text numberOfLines={1} style={[styles.author, { color: tpl.sub, fontFamily: font.family, fontSize: width * 0.036 * font.scale, textAlign: design.align }]}>
                {author}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Text style={[styles.watermark, { color: tpl.sub, fontSize: Math.max(9, width * 0.028) }]}>🌳 독서의숲</Text>
    </View>
  );
});

const webWrap = Platform.OS === 'web' ? ({ wordBreak: 'keep-all', overflowWrap: 'anywhere' } as object) : null;

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 18 },
  body: { flex: 1, justifyContent: 'center' },
  mark: { fontFamily: 'Jua_400Regular', lineHeight: undefined, marginBottom: -8, opacity: 0.8 },
  quote: {},
  footer: { marginTop: 22, gap: 4 },
  rule: { width: 28, height: 3, borderRadius: 2, marginBottom: 6, opacity: 0.8 },
  book: {},
  author: {},
  watermark: { position: 'absolute', right: 14, bottom: 10, fontFamily: 'Jua_400Regular', opacity: 0.75 },
});
