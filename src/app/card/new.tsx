import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';

import { AppText, Button, Card, Chip, IconButton, Input, ProgressBar, Screen, SegmentedControl, showToast } from '@/components/ui';
import { cardProgress } from '@/features/gallery/blur';
import { captureView, makeBlurThumb, saveImage, shareImage } from '@/features/gallery/capture';
import { CARD_FONTS, fontById, useCardFont } from '@/features/gallery/fonts';
import { OCR_SUPPORTED, recognizeText, type OcrStage } from '@/features/gallery/ocr';
import { DEFAULT_DESIGN, QuoteCardView, type QuoteCardDesign } from '@/features/gallery/QuoteCardView';
import { aspectRatio, CARD_ASPECTS, CARD_TEMPLATES, type CardAlign, type CardAspect, type CardTextSize } from '@/features/gallery/templates';
import { isMissingSchemaError, uploadCard } from '@/features/gallery/api';
import { currentPageOf, progressPercent } from '@/features/library/growth';
import { toISODate } from '@/lib/date';
import { useEntitlements } from '@/lib/entitlements';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useCardsStore } from '@/stores/cardsStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { colors, MAX_APP_WIDTH, palette, radius, spacing } from '@/theme';
import type { LibraryEntry } from '@/types';

const STATUS_ORDER = { reading: 0, read: 1, stopped: 2, want: 3 } as const;

export default function CardMakerScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ entryId?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const { isPremium } = useEntitlements();
  const entries = useLibraryStore((s) => s.entries);
  const nickname = useProfileStore((s) => s.nickname);
  const recordCard = useCardsStore((s) => s.recordCard);
  const books = useMemo(
    () => Object.values(entries).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.updatedAt - a.updatedAt),
    [entries],
  );
  const [entryId, setEntryId] = useState<string | null>(() => (params.entryId && entries[params.entryId] ? params.entryId : books[0]?.id ?? null));
  const entry: LibraryEntry | undefined = entryId ? entries[entryId] : undefined;
  const [quote, setQuote] = useState('');
  const [design, setDesign] = useState<QuoteCardDesign>(DEFAULT_DESIGN);
  const [ocr, setOcr] = useState<{ progress: number; stage: OcrStage } | null>(null);
  const [unit, setUnit] = useState<'page' | 'percent'>(() => (entry?.progressUnit === 'percent' || !entry?.book.pageCount ? 'percent' : 'page'));
  const [progressText, setProgressText] = useState(() => initialProgress(entry, unit));
  const [busy, setBusy] = useState<null | 'save' | 'share' | 'upload'>(null);
  const [draftId] = useState(() => `card_${Date.now().toString(36)}`);
  const cardRef = useRef<View>(null);
  const fontReady = useCardFont(design.font);

  const pageWidth = Math.min(windowWidth, MAX_APP_WIDTH) - spacing.lg * 2;
  const previewWidth = Math.round(design.aspect === 'story' ? pageWidth * 0.74 : pageWidth * 0.9);
  const previewHeight = Math.round(previewWidth / aspectRatio(design.aspect));
  const totalPages = entry?.book.pageCount;
  const progressValue = progressText.trim() === '' ? undefined : Number(progressText);
  const progress = cardProgress({ unit, page: unit === 'page' ? progressValue : undefined, percent: unit === 'percent' ? progressValue : undefined, totalPages });

  const pickBook = (e: LibraryEntry) => {
    setEntryId(e.id);
    const nextUnit = e.progressUnit === 'percent' || !e.book.pageCount ? 'percent' : 'page';
    setUnit(nextUnit);
    setProgressText(initialProgress(e, nextUnit));
  };

  const update = <K extends keyof QuoteCardDesign>(key: K, value: QuoteCardDesign[K], premium = false) => {
    if (premium && !isPremium) {
      showToast(t('cards.lockedPremium'));
      return;
    }
    setDesign((d) => ({ ...d, [key]: value }));
  };

  const runOcr = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    setOcr({ progress: 0, stage: 'loading' });
    try {
      const text = await recognizeText(res.assets[0].uri, (p, stage) => setOcr({ progress: p, stage }));
      if (text) {
        setQuote(text.slice(0, 500));
        showToast(t('cards.ocrDone'));
      } else showToast(t('cards.ocrEmpty'));
    } catch (err) {
      console.warn('[ocr]', err);
      showToast(t('cards.ocrFailed'));
    } finally {
      setOcr(null);
    }
  };

  const capture = async () => {
    const font = fontById(design.font);
    return captureView(cardRef, { width: previewWidth, height: previewHeight, targetWidth: 1080, fontFamilies: [font.family, 'Jua_400Regular'] });
  };

  const validate = () => {
    if (!entry) {
      showToast(t('cards.needBook'));
      return false;
    }
    if (!quote.trim()) {
      showToast(t('cards.needQuote'));
      return false;
    }
    return true;
  };

  const exportCard = async (mode: 'save' | 'share') => {
    if (!validate() || !entry) return;
    setBusy(mode);
    try {
      const img = await capture();
      const filename = `독서의숲-문구카드-${toISODate(new Date())}.png`;
      const result = mode === 'save' ? await saveImage(img, filename) : await shareImage(img, filename, entry.book.title);
      if (result === 'denied') showToast(t('cards.saveDenied'));
      else if (result !== 'cancelled') {
        recordCard({ id: draftId, bookTitle: entry.book.title });
        showToast(result === 'downloaded' ? t('cards.downloaded') : result === 'saved' ? t('cards.saved') : t('cards.shared'));
      }
    } catch (err) {
      console.warn('[card export]', err);
      showToast(t('cards.exportFailed'));
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!validate() || !entry) return;
    if (!isSupabaseConfigured) {
      showToast(t('cards.serverOff'));
      return;
    }
    if (progress.percent === null) {
      showToast(unit === 'page' && !totalPages ? t('cards.needPercent') : t('cards.needProgress'));
      return;
    }
    setBusy('upload');
    try {
      const image = await capture();
      const blur = await makeBlurThumb(image);
      const id = await uploadCard({
        image,
        blur,
        isbn13: entry.book.isbn13,
        bookId: entry.book.id,
        bookTitle: entry.book.title,
        bookAuthor: entry.book.authors.join(', '),
        bookCover: entry.book.coverUrl,
        quote,
        template: design.template,
        font: design.font,
        aspect: design.aspect,
        progressPercent: progress.percent,
        progressPage: progress.page,
        nickname,
      });
      recordCard({ id: draftId, bookTitle: entry.book.title, galleryId: id });
      showToast(t('cards.uploaded'));
      router.replace({ pathname: '/card/[id]', params: { id } });
    } catch (err) {
      console.warn('[card upload]', err);
      showToast(isMissingSchemaError(err) || (err as { statusCode?: string })?.statusCode === '404' ? t('cards.galleryNotReady') : t('cards.uploadFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title={t('cards.title')}
      subtitle={t('cards.subtitle')}
      headerLeft={<IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/gallery'))} />}>
      <Card style={styles.section}>
        <AppText variant="subtitle">📚 {t('cards.pickBook')}</AppText>
        {books.length ? (
          <View style={styles.wrap}>
            {books.slice(0, 12).map((e) => (
              <Chip key={e.id} label={e.book.title.length > 16 ? `${e.book.title.slice(0, 16)}…` : e.book.title} selected={entryId === e.id} onPress={() => pickBook(e)} />
            ))}
          </View>
        ) : (
          <AppText variant="caption" muted>
            {t('cards.noBooks')}
          </AppText>
        )}
        <Button size="sm" variant="soft" label={`🔍 ${t('cards.searchBook')}`} onPress={() => router.push('/search')} />
      </Card>

      <Card style={styles.section}>
        <Input
          label={`✍️ ${t('cards.quoteLabel')}`}
          value={quote}
          onChangeText={setQuote}
          placeholder={t('cards.quotePlaceholder')}
          multiline
          maxLength={500}
          showCounter
        />
        {OCR_SUPPORTED ? (
          ocr ? (
            <View style={styles.ocr}>
              <AppText variant="caption">{t(`cards.ocrStage.${ocr.stage}`, { percent: Math.round(ocr.progress * 100) })}</AppText>
              <ProgressBar percent={ocr.progress * 100} color={palette.sky} />
            </View>
          ) : (
            <View style={styles.row}>
              <Button size="sm" variant="sky" label={`📷 ${t('cards.ocr')}`} onPress={runOcr} />
              <AppText variant="tiny" muted style={styles.flex}>
                {t('cards.ocrHint')}
              </AppText>
            </View>
          )
        ) : (
          <AppText variant="tiny" muted>
            {t('cards.ocrNative')}
          </AppText>
        )}
      </Card>

      <View style={styles.previewWrap}>
        <View style={styles.previewShadow}>
          <QuoteCardView
            ref={cardRef}
            design={design}
            quote={quote}
            placeholder={t('cards.previewPlaceholder')}
            bookTitle={entry?.book.title ?? t('cards.bookPlaceholder')}
            author={entry?.book.authors.join(', ')}
            width={previewWidth}
          />
        </View>
        {!fontReady ? (
          <AppText variant="tiny" muted center>
            {t('cards.fontLoading')}
          </AppText>
        ) : null}
      </View>

      <Card style={styles.section}>
        <AppText variant="subtitle">🎨 {t('cards.design')}</AppText>
        <AppText variant="caption" muted>
          {t('cards.template')}
        </AppText>
        <View style={styles.wrap}>
          {CARD_TEMPLATES.map((tpl) => {
            const locked = tpl.premium && !isPremium;
            return (
              <Pressable
                key={tpl.id}
                accessibilityRole="button"
                accessibilityLabel={t(`cards.templates.${tpl.id}`)}
                onPress={() => update('template', tpl.id, tpl.premium)}
                style={[styles.swatch, design.template === tpl.id && styles.swatchOn]}>
                <View style={[styles.swatchColor, { backgroundColor: tpl.bg[0], borderColor: tpl.bg[1] }]}>
                  <View style={[styles.swatchDot, { backgroundColor: tpl.accent }]} />
                </View>
                <AppText variant="tiny">{locked ? `🔒 ${t(`cards.templates.${tpl.id}`)}` : t(`cards.templates.${tpl.id}`)}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" muted>
          {t('cards.font')}
        </AppText>
        <View style={styles.wrap}>
          {CARD_FONTS.map((f) => (
            <Chip
              key={f.id}
              label={f.premium && !isPremium ? `🔒 ${t(`cards.fonts.${f.id}`)}` : t(`cards.fonts.${f.id}`)}
              selected={design.font === f.id}
              onPress={() => update('font', f.id, f.premium)}
            />
          ))}
        </View>
        <View style={styles.optionRow}>
          <AppText variant="caption" muted>
            {t('cards.ratio')}
          </AppText>
          <SegmentedControl<CardAspect>
            value={design.aspect as CardAspect}
            onChange={(v) => update('aspect', v)}
            options={CARD_ASPECTS.map((a) => ({ value: a.id, label: a.label }))}
          />
        </View>
        <View style={styles.optionRow}>
          <AppText variant="caption" muted>
            {t('cards.size')}
          </AppText>
          <SegmentedControl<CardTextSize>
            value={design.size}
            onChange={(v) => update('size', v)}
            options={[
              { value: 's', label: t('cards.sizeS') },
              { value: 'm', label: t('cards.sizeM') },
              { value: 'l', label: t('cards.sizeL') },
            ]}
          />
        </View>
        <View style={styles.optionRow}>
          <AppText variant="caption" muted>
            {t('cards.align')}
          </AppText>
          <SegmentedControl<CardAlign>
            value={design.align}
            onChange={(v) => update('align', v)}
            options={[
              { value: 'left', label: t('cards.alignLeft') },
              { value: 'center', label: t('cards.alignCenter') },
              { value: 'right', label: t('cards.alignRight') },
            ]}
          />
        </View>
        <View style={styles.optionRow}>
          <AppText variant="caption">{t('cards.footer')}</AppText>
          <Switch
            value={design.showFooter}
            onValueChange={(v) => update('showFooter', v)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <View style={styles.row}>
        <Button style={styles.flex} variant="soft" label={`📥 ${t('cards.save')}`} loading={busy === 'save'} disabled={!!busy} onPress={() => exportCard('save')} />
        <Button style={styles.flex} variant="wood" label={`📤 ${t('cards.share')}`} loading={busy === 'share'} disabled={!!busy} onPress={() => exportCard('share')} />
      </View>

      <Card tint={palette.leafSoft} edgeColor={palette.leaf} style={styles.section}>
        <AppText variant="subtitle">🌿 {t('cards.publishTitle')}</AppText>
        <AppText variant="caption" muted>
          {t('cards.publishBody')}
        </AppText>
        <View style={styles.row}>
          <SegmentedControl<'page' | 'percent'>
            value={unit}
            onChange={(v) => {
              setUnit(v);
              setProgressText(initialProgress(entry, v));
            }}
            options={[
              { value: 'page', label: t('cards.unitPage') },
              { value: 'percent', label: t('cards.unitPercent') },
            ]}
          />
          <Input
            containerStyle={styles.flex}
            value={progressText}
            onChangeText={(v) => setProgressText(v.replace(/[^0-9]/g, '').slice(0, 5))}
            keyboardType="number-pad"
            placeholder={unit === 'page' ? t('cards.pagePlaceholder') : t('cards.percentPlaceholder')}
            accessibilityLabel={t('cards.progressLabel')}
          />
        </View>
        <AppText variant="tiny" muted>
          {unit === 'page' && !totalPages
            ? t('cards.noTotalPages')
            : progress.percent !== null
              ? t('cards.progressSummary', { percent: progress.percent, total: totalPages ?? '?' })
              : t('cards.needProgress')}
        </AppText>
        <Button label={t('cards.publish')} fullWidth loading={busy === 'upload'} disabled={!!busy} onPress={publish} />
      </Card>
    </Screen>
  );
}

function initialProgress(entry: LibraryEntry | undefined, unit: 'page' | 'percent'): string {
  if (!entry) return '';
  if (unit === 'percent') return String(progressPercent(entry));
  const page = currentPageOf(entry);
  return page ? String(page) : '';
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  ocr: { gap: spacing.xs },
  previewWrap: { alignItems: 'center', gap: spacing.xs },
  previewShadow: {
    borderRadius: 18,
    boxShadow: '0px 10px 24px rgba(91,70,54,0.18)',
  } as object,
  swatch: { alignItems: 'center', gap: 4, padding: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: palette.leafDeep, backgroundColor: palette.cream },
  swatchColor: { width: 44, height: 44, borderRadius: 12, borderWidth: 3, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 5 },
  swatchDot: { width: 10, height: 10, borderRadius: 5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
});
