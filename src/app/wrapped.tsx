import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BookCover } from '@/components/BookCover';
import { AppText, Button, EmptyState, IconButton, SegmentedControl, showToast } from '@/components/ui';
import { captureView, saveImage, shareImage } from '@/features/gallery/capture';
import { ambientById, type AmbientId } from '@/features/sound/ambient';
import { roomById } from '@/features/together/rooms';
import { computeWrapped, isEmptyWrapped, type WrappedPeriod, type WrappedStats } from '@/features/wrapped/compute';
import { PersonaArt } from '@/features/wrapped/PersonaArt';
import { koreanHour, personaTagline, pickPersona } from '@/features/wrapped/personas';
import { sampleWrappedInput } from '@/features/wrapped/sample';
import { formatFocus, WrappedSummaryCard, type SummaryAspect } from '@/features/wrapped/WrappedSummaryCard';
import { useEntitlements } from '@/lib/entitlements';
import { useCardsStore } from '@/stores/cardsStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTimerStore } from '@/stores/timerStore';
import { fonts, MAX_APP_WIDTH, palette, spacing } from '@/theme';

type SlideId = 'intro' | 'books' | 'focus' | 'trees' | 'rhythm' | 'sound' | 'taste' | 'cards' | 'persona' | 'summary';

const SLIDE_BG: Record<Exclude<SlideId, 'persona' | 'summary'>, [string, string]> = {
  intro: ['#DDF1CF', '#FBF5E6'],
  books: ['#FDE6EC', '#FFFDF6'],
  focus: ['#DDF2FB', '#FBF5E6'],
  trees: ['#C9E8B5', '#F4EAD3'],
  rhythm: ['#E6DCF7', '#FBF5E6'],
  sound: ['#CFE6F3', '#F1E3CF'],
  taste: ['#FDF3CC', '#FFFDF6'],
  cards: ['#F9DDD0', '#FFFDF6'],
};

function parsePeriod(p: { period?: string; y?: string; m?: string }): WrappedPeriod {
  const now = new Date();
  const year = Number(p.y) || now.getFullYear();
  if (p.period === 'year') return { kind: 'year', year };
  const month = Number(p.m) >= 1 && Number(p.m) <= 12 ? Number(p.m) : now.getMonth() + 1;
  return { kind: 'month', year, month };
}

/** 독서 DNA 결산 — full-screen story slides (tap / swipe), persona reveal and a shareable summary card. */
export default function WrappedScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ period?: string; y?: string; m?: string; sample?: string }>();
  const period = useMemo(() => parsePeriod(params), [params]);
  const sample = params.sample === '1';
  const entries = useLibraryStore((s) => s.entries);
  const logs = useLibraryStore((s) => s.logs);
  const history = useTimerStore((s) => s.history);
  const cards = useCardsStore((s) => s.made);
  const nickname = useProfileStore((s) => s.nickname);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_APP_WIDTH);

  const stats = useMemo(
    () => computeWrapped(sample ? sampleWrappedInput(period) : { entries: Object.values(entries), logs, sessions: history, cards }, period),
    [sample, period, entries, logs, history, cards],
  );
  const persona = pickPersona(stats);
  const periodLabel = period.kind === 'year' ? t('wrapped.yearLabel', { year: period.year }) : t('wrapped.monthLabel', { year: period.year, month: period.month });
  const soundName = stats.favoriteSound ? t(`together.sounds.${stats.favoriteSound}`, { defaultValue: stats.favoriteSound }) : null;
  const personaName = t(`wrapped.personas.${persona.id}.name`);
  const tagline = personaTagline({ name: personaName, hour: stats.topHour, sound: soundName });

  const slides = useMemo(() => {
    const list: SlideId[] = ['intro', 'books', 'focus', 'trees', 'rhythm'];
    if (stats.favoriteSound || stats.favoriteRoom) list.push('sound');
    if (stats.topCategory || stats.bestBook || stats.topAuthor) list.push('taste');
    list.push('cards', 'persona', 'summary');
    return list;
  }, [stats]);
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)];
  const count = slides.length;
  const go = (delta: number) => setIndex((i) => Math.max(0, Math.min(count - 1, i + delta)));

  const pan = useMemo(() => {
    const step = (delta: number) => setIndex((i) => Math.max(0, Math.min(count - 1, i + delta)));
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -50) step(1);
        else if (g.dx > 50) step(-1);
      },
    });
  }, [count, setIndex]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/records'));

  if (!sample && isEmptyWrapped(stats)) {
    return (
      <View style={[styles.emptyWrap, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.closeRow}>
          <IconButton name="close" accessibilityLabel={t('common.close')} onPress={close} />
        </View>
        <EmptyState
          emoji="🌱"
          tint={palette.leafSoft}
          title={t('wrapped.emptyTitle', { period: periodLabel })}
          body={t('wrapped.emptyBody')}
          action={
            <Button
              label={`✨ ${t('wrapped.sample')}`}
              onPress={() => router.setParams({ sample: '1' })}
            />
          }
        />
      </View>
    );
  }

  const bg = slide === 'persona' || slide === 'summary' ? persona.colors.bg : SLIDE_BG[slide];
  const ink = slide === 'persona' || slide === 'summary' ? persona.colors.ink : palette.brown;

  return (
    <View style={[styles.root, { height }]} {...pan.panHandlers}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs>
          <LinearGradient id="wbg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={bg[0]} />
            <Stop offset="1" stopColor={bg[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="10" height="10" fill="url(#wbg)" />
      </Svg>

      {slide !== 'summary' ? (
        <View style={[StyleSheet.absoluteFill, styles.tapRow]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('wrapped.prev')} style={styles.tapPrev} onPress={() => go(-1)} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('wrapped.next')} style={styles.tapNext} onPress={() => go(1)} />
        </View>
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }, { pointerEvents: 'box-none' }]}>
        <View style={styles.bars}>
          {slides.map((s, i) => (
            <View key={s} style={[styles.bar, { backgroundColor: i <= index ? ink : 'rgba(91,70,54,0.18)', opacity: i <= index ? 0.85 : 1 }]} />
          ))}
        </View>
        <View style={styles.topRow}>
          <AppText variant="tiny" color={ink}>
            {periodLabel}
            {sample ? ` · ${t('wrapped.sampleBadge')}` : ''}
          </AppText>
          <IconButton name="close" color={ink} background="rgba(255,255,255,0.22)" accessibilityLabel={t('common.close')} onPress={close} />
        </View>
      </View>

      <SlideFrame key={slide} style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }, { pointerEvents: slide === 'summary' ? 'auto' : 'none' }]}>
        {slide === 'intro' ? <IntroSlide nickname={nickname} periodLabel={periodLabel} /> : null}
        {slide === 'books' ? <BooksSlide stats={stats} periodLabel={periodLabel} /> : null}
        {slide === 'focus' ? <FocusSlide stats={stats} /> : null}
        {slide === 'trees' ? <TreesSlide stats={stats} /> : null}
        {slide === 'rhythm' ? <RhythmSlide stats={stats} /> : null}
        {slide === 'sound' ? <SoundSlide stats={stats} soundName={soundName} /> : null}
        {slide === 'taste' ? <TasteSlide stats={stats} /> : null}
        {slide === 'cards' ? <CardsSlide stats={stats} /> : null}
        {slide === 'persona' ? (
          <View style={styles.center}>
            <AppText variant="subtitle" color={ink} center>
              {t('wrapped.personaIntro')}
            </AppText>
            <PersonaArt persona={persona} size={Math.min(width * 0.62, height * 0.34)} />
            <AppText style={[styles.hero, { color: ink }]}>
              {persona.emoji} {personaName}
            </AppText>
            <AppText variant="body" color={ink} center style={styles.tagline}>
              {tagline}
            </AppText>
            <AppText variant="caption" color={ink} center style={styles.desc}>
              {t(`wrapped.personas.${persona.id}.desc`)}
            </AppText>
          </View>
        ) : null}
        {slide === 'summary' ? (
          <SummarySlide
            stats={stats}
            persona={persona}
            personaName={personaName}
            tagline={tagline}
            periodLabel={periodLabel}
            nickname={nickname}
            maxWidth={width - spacing.lg * 2}
            maxHeight={height - insets.top - insets.bottom - 230}
            onReplay={() => setIndex(0)}
          />
        ) : null}
      </SlideFrame>

      {index === 0 ? (
        <AppText variant="tiny" color={ink} center style={[styles.hint, { bottom: insets.bottom + spacing.md }]}>
          {t('wrapped.tapHint')}
        </AppText>
      ) : null}
    </View>
  );
}

function SlideFrame({ children, style }: { children: ReactNode; style: object }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[style, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function CountUp({ value, format = (n: number) => n.toLocaleString(), style }: { value: number; format?: (n: number) => string; style?: object }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => {
      anim.stopAnimation();
      anim.removeListener(id);
    };
  }, [value]);
  return <AppText style={[styles.big, style]}>{format(shown)}</AppText>;
}

function IntroSlide({ nickname, periodLabel }: { nickname: string; periodLabel: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <AppText style={styles.emoji}>🌳</AppText>
      <AppText style={styles.hero}>{t('wrapped.introTitle', { name: nickname, period: periodLabel })}</AppText>
      <AppText variant="body" muted center>
        {t('wrapped.introBody')}
      </AppText>
    </View>
  );
}

function BooksSlide({ stats, periodLabel }: { stats: WrappedStats; periodLabel: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <AppText variant="subtitle" center>
        {t('wrapped.booksTitle', { period: periodLabel })}
      </AppText>
      <CountUp value={stats.booksFinished} format={(n) => `${n}권`} />
      {stats.finishedBooks.length ? (
        <View style={styles.covers}>
          {stats.finishedBooks.slice(-5).map((b, i) => (
            <View key={`${b.title}-${i}`} style={{ transform: [{ rotate: `${(i - 2) * 4}deg` }] }}>
              <BookCover uri={b.cover} title={b.title} width={54} />
            </View>
          ))}
        </View>
      ) : (
        <AppText variant="caption" muted center>
          {t('wrapped.booksNone')}
        </AppText>
      )}
      <AppText variant="subtitle" center style={styles.gapTop}>
        {t('wrapped.pagesTitle')}
      </AppText>
      <CountUp value={stats.pages} format={(n) => `${n.toLocaleString()}쪽`} style={styles.mid} />
      <AppText variant="caption" muted center>
        {stats.pages >= 300 ? t('wrapped.pagesFun', { cm: ((stats.pages / 2) * 0.01).toFixed(1) }) : t('wrapped.pagesSmall')}
      </AppText>
    </View>
  );
}

function FocusSlide({ stats }: { stats: WrappedStats }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <AppText style={styles.emoji}>⏳</AppText>
      <AppText variant="subtitle" center>
        {t('wrapped.focusTitle')}
      </AppText>
      <CountUp value={stats.focusMinutes} format={formatFocus} />
      <AppText variant="body" muted center>
        {stats.focusMinutes > 0 ? t('wrapped.focusBody', { sessions: stats.sessions, days: stats.readingDays }) : t('wrapped.focusNone')}
      </AppText>
    </View>
  );
}

function TreesSlide({ stats }: { stats: WrappedStats }) {
  const { t } = useTranslation();
  const grown = Math.min(stats.booksFinished, stats.treesPlanted);
  const shown = Math.min(stats.treesPlanted, 48);
  return (
    <View style={styles.center}>
      <AppText style={styles.hero}>
        {t(stats.period.kind === 'year' ? 'wrapped.treesYear' : 'wrapped.treesMonth', { count: stats.treesPlanted })}
      </AppText>
      <View style={styles.forest}>
        {Array.from({ length: shown }, (_, i) => (
          <TreeSprout key={i} delay={i * 40} emoji={i < grown ? (i % 3 === 0 ? '🌲' : '🌳') : '🌱'} />
        ))}
      </View>
      <AppText variant="caption" muted center>
        {stats.treesPlanted ? t('wrapped.treesBody', { grown }) : t('wrapped.treesNone')}
      </AppText>
    </View>
  );
}

function TreeSprout({ emoji, delay }: { emoji: string; delay: number }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 360, delay, easing: Easing.out(Easing.back(2)), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [anim, delay]);
  return <Animated.Text style={[styles.tree, { transform: [{ scale: anim }] }]}>{emoji}</Animated.Text>;
}

function RhythmSlide({ stats }: { stats: WrappedStats }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <AppText style={styles.emoji}>🔥</AppText>
      <AppText variant="subtitle" center>
        {t('wrapped.streakTitle')}
      </AppText>
      <CountUp value={stats.longestStreak} format={(n) => `${n}일`} />
      <AppText variant="caption" muted center>
        {t('wrapped.readingDays', { days: stats.readingDays })}
      </AppText>
      {stats.topHour !== null && stats.topBucket ? (
        <>
          <AppText variant="subtitle" center style={styles.gapTop}>
            {t('wrapped.hourTitle')}
          </AppText>
          <AppText style={styles.mid}>
            {t(`wrapped.bucketEmoji.${stats.topBucket}`)} {koreanHour(stats.topHour)}
          </AppText>
          <AppText variant="caption" muted center>
            {t(`wrapped.bucket.${stats.topBucket}`)}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

function SoundSlide({ stats, soundName }: { stats: WrappedStats; soundName: string | null }) {
  const { t } = useTranslation();
  const sound = stats.favoriteSound ? ambientById(stats.favoriteSound as AmbientId) : undefined;
  const room = roomById(stats.favoriteRoom);
  return (
    <View style={styles.center}>
      {soundName ? (
        <>
          <AppText variant="subtitle" center>
            {t('wrapped.soundTitle')}
          </AppText>
          <AppText style={styles.emoji}>{sound?.emoji ?? '🎧'}</AppText>
          <AppText style={styles.mid}>{soundName}</AppText>
        </>
      ) : null}
      {room ? (
        <>
          <AppText variant="subtitle" center style={styles.gapTop}>
            {t('wrapped.roomTitle')}
          </AppText>
          <AppText style={styles.mid}>
            {room.emoji} {t(`together.rooms.${room.id}.name`)}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

function TasteSlide({ stats }: { stats: WrappedStats }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      {stats.topCategory ? (
        <>
          <AppText variant="subtitle" center>
            {t('wrapped.categoryTitle')}
          </AppText>
          <AppText style={styles.mid}>📚 {stats.topCategory}</AppText>
        </>
      ) : null}
      {stats.topAuthor ? (
        <AppText variant="body" muted center>
          {t('wrapped.authorLine', { author: stats.topAuthor })}
        </AppText>
      ) : null}
      {stats.bestBook ? (
        <>
          <AppText variant="subtitle" center style={styles.gapTop}>
            {t('wrapped.bestTitle')}
          </AppText>
          <BookCover uri={stats.bestBook.cover} title={stats.bestBook.title} width={84} />
          <AppText variant="body" center>
            『{stats.bestBook.title}』
          </AppText>
          <AppText variant="body" color={palette.yellowDeep}>
            {'★'.repeat(Math.round(stats.bestBook.rating ?? 0))}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

function CardsSlide({ stats }: { stats: WrappedStats }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <AppText style={styles.emoji}>🖋️</AppText>
      <AppText variant="subtitle" center>
        {t('wrapped.cardsTitle')}
      </AppText>
      <CountUp value={stats.quoteCards} format={(n) => `${n}장`} />
      <AppText variant="body" muted center>
        {stats.quoteCards ? t('wrapped.cardsBody') : t('wrapped.cardsNone')}
      </AppText>
    </View>
  );
}

function SummarySlide(props: {
  stats: WrappedStats;
  persona: ReturnType<typeof pickPersona>;
  personaName: string;
  tagline: string;
  periodLabel: string;
  nickname: string;
  maxWidth: number;
  maxHeight: number;
  onReplay: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useEntitlements();
  const [aspect, setAspect] = useState<SummaryAspect>('story');
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  const ref = useRef<View>(null);
  const cardWidth = Math.floor(Math.min(props.maxWidth, aspect === 'story' ? (props.maxHeight * 9) / 16 : props.maxHeight, 400));
  const cardHeight = aspect === 'story' ? Math.round((cardWidth * 16) / 9) : cardWidth;
  const allowed = can('readingWrappedExport');

  const exportCard = async (mode: 'save' | 'share') => {
    if (!allowed) {
      showToast(t('wrapped.exportLocked'));
      return;
    }
    setBusy(mode);
    try {
      const img = await captureView(ref, { width: cardWidth, height: cardHeight, targetWidth: 1080, fontFamilies: [fonts.body] });
      const name = `독서의숲-결산-${props.periodLabel.replace(/\s/g, '')}.png`;
      const res = mode === 'save' ? await saveImage(img, name) : await shareImage(img, name, props.tagline);
      if (res === 'denied') showToast(t('cards.saveDenied'));
      else if (res === 'downloaded') showToast(t('cards.downloaded'));
      else if (res === 'saved') showToast(t('cards.saved'));
      else if (res === 'shared') showToast(t('cards.shared'));
    } catch (err) {
      console.warn('[wrapped export]', err);
      showToast(t('cards.exportFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.center}>
      <WrappedSummaryCard
        ref={ref}
        stats={props.stats}
        persona={props.persona}
        personaName={props.personaName}
        tagline={props.tagline}
        periodLabel={props.periodLabel}
        nickname={props.nickname}
        aspect={aspect}
        width={cardWidth}
        labels={{
          books: t('wrapped.label.books'),
          pages: t('wrapped.label.pages'),
          focus: t('wrapped.label.focus'),
          trees: t('wrapped.label.trees'),
          streak: t('wrapped.label.streak'),
          cards: t('wrapped.label.cards'),
        }}
      />
      <SegmentedControl<SummaryAspect>
        value={aspect}
        onChange={setAspect}
        options={[
          { value: 'story', label: '9:16' },
          { value: 'square', label: '1:1' },
        ]}
      />
      <View style={styles.actions}>
        <Button size="sm" variant="soft" label={`${allowed ? '📥' : '🔒'} ${t('cards.save')}`} loading={busy === 'save'} disabled={!!busy} onPress={() => exportCard('save')} />
        <Button size="sm" variant="wood" label={`${allowed ? '📤' : '🔒'} ${t('cards.share')}`} loading={busy === 'share'} disabled={!!busy} onPress={() => exportCard('share')} />
        <Button size="sm" variant="sky" label={`↺ ${t('wrapped.replay')}`} onPress={props.onReplay} />
      </View>
      {!allowed ? (
        <AppText variant="tiny" muted center>
          {t('wrapped.exportLockedHint')}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  emptyWrap: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  closeRow: { alignItems: 'flex-end' },
  tapRow: { flexDirection: 'row' },
  tapPrev: { flex: 1 },
  tapNext: { flex: 2 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing.md, gap: spacing.xs, zIndex: 2 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: 84 },
  center: { alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: 56, lineHeight: 68 },
  hero: { fontFamily: fonts.display, fontSize: 28, lineHeight: 38, textAlign: 'center' },
  big: { fontFamily: fonts.display, fontSize: 56, lineHeight: 68, textAlign: 'center', color: palette.brown },
  mid: { fontFamily: fonts.display, fontSize: 32, lineHeight: 42, textAlign: 'center', color: palette.brown },
  gapTop: { marginTop: spacing.lg },
  covers: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.sm },
  forest: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, maxWidth: 320, marginVertical: spacing.md },
  tree: { fontSize: 26, lineHeight: 32 },
  tagline: { fontSize: 18, lineHeight: 28, paddingHorizontal: spacing.md },
  desc: { paddingHorizontal: spacing.lg, opacity: 0.9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  hint: { position: 'absolute', left: 0, right: 0 },
});
