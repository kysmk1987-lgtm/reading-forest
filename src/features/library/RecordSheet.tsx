import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, DateField, Input, ProgressBar, SegmentedControl, Sheet, StarRating } from '@/components/ui';
import { GrowthBadge } from '@/components/GrowthBadge';
import { publishFromRecord } from '@/features/reviews/api';
import { todayISO } from '@/lib/date';
import { successFeedback, tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, palette, radius, spacing } from '@/theme';
import {
  READING_STATUSES,
  REVIEW_MAX_LENGTH,
  type Book,
  type LibraryEntry,
  type LibraryEntryDraft,
  type ProgressUnit,
  type ReadingStatus,
} from '@/types';

import { progressPercent } from './growth';
import { defaultProgressUnit, pagesDisplay } from './pages';
import { STATUS_META } from './statusMeta';

interface FormState {
  status: ReadingStatus;
  startDate: string;
  endDate: string;
  rating: number;
  review: string;
  progressUnit: ProgressUnit;
  totalPages: string;
  currentPage: string;
  currentPercent: string;
  expectation: number;
  expectationNote: string;
}

function initialForm(bookPageCount?: number, entry?: LibraryEntry, status?: ReadingStatus): FormState {
  const today = todayISO();
  const pageCount = entry?.book.pageCount ?? bookPageCount;
  return {
    totalPages: pageCount ? String(pageCount) : '',
    status: status ?? entry?.status ?? 'read',
    startDate: entry?.startDate ?? today,
    endDate: entry?.endDate ?? today,
    rating: entry?.rating ?? 0,
    review: entry?.review ?? '',
    progressUnit: defaultProgressUnit(pageCount, entry?.progressUnit),
    currentPage: entry?.currentPage ? String(entry.currentPage) : '',
    currentPercent: entry?.currentPercent ? String(entry.currentPercent) : '',
    expectation: entry?.expectation ?? 0,
    expectationNote: entry?.expectationNote ?? '',
  };
}

function toNumber(text: string, max?: number) {
  const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(n)) return undefined;
  return max ? Math.min(n, max) : n;
}

/** Only the fields relevant to the chosen status are stored. */
function buildDraft(source: Book, f: FormState): LibraryEntryDraft {
  const book: Book = { ...source, pageCount: toNumber(f.totalPages) || source.pageCount };
  const base = { book, status: f.status };
  switch (f.status) {
    case 'read':
    case 'stopped':
      return {
        ...base,
        startDate: f.startDate,
        endDate: f.endDate,
        rating: f.rating || undefined,
        review: f.review.trim() || undefined,
      };
    case 'reading':
      return {
        ...base,
        startDate: f.startDate,
        progressUnit: f.progressUnit,
        currentPage: f.progressUnit === 'page' ? toNumber(f.currentPage, book.pageCount) : undefined,
        currentPercent: f.progressUnit === 'percent' ? toNumber(f.currentPercent, 100) : undefined,
      };
    case 'want':
      return { ...base, expectation: f.expectation || undefined, expectationNote: f.expectationNote.trim() || undefined };
  }
}

export interface RecordSheetProps {
  visible: boolean;
  onClose: () => void;
  book: Book;
  /** Existing entry → edit mode. */
  entry?: LibraryEntry;
  onSaved?: (entry: LibraryEntry) => void;
}

export function RecordSheet({ visible, onClose, book, entry, onSaved }: RecordSheetProps) {
  const { t } = useTranslation();
  const addEntry = useLibraryStore((s) => s.addEntry);
  const updateEntry = useLibraryStore((s) => s.updateEntry);
  const queryClient = useQueryClient();
  const visibility = useSettingsStore((s) => s.reviewVisibility);
  const [form, setForm] = useState<FormState>(() => initialForm(book.pageCount, entry));
  /** Page counts come from the book APIs; the input only appears when none of them knows the book. */
  const [manualPages, setManualPages] = useState(false);
  const { total: totalPages, fallback: pagesUnknown } = pagesDisplay(book.pageCount, form.totalPages);

  const [openedFor, setOpenedFor] = useState<{ visible: boolean; entry?: LibraryEntry }>({ visible, entry });
  if (openedFor.visible !== visible || openedFor.entry !== entry) {
    setOpenedFor({ visible, entry });
    if (visible) {
      setForm(initialForm(book.pageCount, entry));
      setManualPages(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const draft = buildDraft(book, form);
    let saved: LibraryEntry;
    if (entry) {
      const cleared: Partial<LibraryEntryDraft> = {
        startDate: undefined,
        endDate: undefined,
        rating: undefined,
        review: undefined,
        progressUnit: undefined,
        currentPage: undefined,
        currentPercent: undefined,
        expectation: undefined,
        expectationNote: undefined,
      };
      updateEntry(entry.id, { ...cleared, ...draft });
      saved = { ...entry, ...cleared, ...draft };
    } else {
      saved = addEntry(draft);
    }
    successFeedback();
    if (saved.book.isbn13) {
      publishFromRecord(saved).finally(() => queryClient.invalidateQueries({ queryKey: ['reviews', saved.book.isbn13] }));
    }
    onSaved?.(saved);
    onClose();
  };

  const pagesFallback = !pagesUnknown ? null : manualPages ? (
    <Input
      label={t('record.totalPagesLabel')}
      keyboardType="number-pad"
      value={form.totalPages}
      onChangeText={(v) => set('totalPages', v.replace(/[^0-9]/g, '').slice(0, 5))}
      placeholder={t('record.totalPagesPlaceholder')}
      right={<AppText variant="caption" muted>{t('record.unitPage')}</AppText>}
    />
  ) : (
    <Pressable accessibilityRole="button" onPress={() => setManualPages(true)} style={styles.pagesLink}>
      <AppText variant="caption" muted>
        {t('record.pagesUnknown')} · <AppText variant="caption" color={colors.primaryDeep}>{t('record.pagesManual')}</AppText>
      </AppText>
    </Pressable>
  );

  const previewPercent = progressPercent({
    ...buildDraft(book, form),
    id: '',
    createdAt: 0,
    updatedAt: 0,
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('record.sheetTitle')}
      footer={<Button label={t('common.save')} size="lg" fullWidth onPress={save} />}>
      <View style={styles.section}>
        <AppText variant="subtitle">{t('record.status')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
          {READING_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const active = form.status === s;
            return (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  tapFeedback();
                  set('status', s);
                }}
                style={[
                  styles.statusCard,
                  active
                    ? { backgroundColor: meta.color, borderColor: meta.shadow, borderBottomColor: meta.shadow }
                    : { backgroundColor: colors.surface },
                ]}>
                <AppText style={styles.statusEmoji}>{meta.emoji}</AppText>
                <AppText color={active ? colors.textOnPrimary : colors.text}>{t(`status.${s}`)}</AppText>
                <AppText variant="tiny" color={active ? 'rgba(255,255,255,0.9)' : colors.textMuted}>
                  {t(`status.${s}Hint`)}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {form.status === 'read' || form.status === 'stopped' ? (
        <>
          <View style={styles.section}>
            <AppText variant="subtitle">{t('record.period')}</AppText>
            <View style={styles.row}>
              <DateField label={t('record.startDate')} value={form.startDate} onChange={(v) => set('startDate', v)} />
              <DateField
                label={form.status === 'read' ? t('record.endDate') : t('record.stopDate')}
                value={form.endDate}
                onChange={(v) => set('endDate', v)}
              />
            </View>
          </View>
          <View style={[styles.row, styles.between]}>
            <AppText variant="subtitle">{t('record.rating')}</AppText>
            <StarRating value={form.rating} allowHalf onChange={(v) => set('rating', v)} />
          </View>
          <Input
            label={t('record.review')}
            showCounter
            maxLength={REVIEW_MAX_LENGTH}
            multiline
            value={form.review}
            onChangeText={(v) => set('review', v)}
            placeholder={t('record.reviewPlaceholder')}
          />
          {book.isbn13 ? (
            <View style={[styles.visibility, visibility === 'public' ? styles.visibilityPublic : styles.visibilityPrivate]}>
              <AppText variant="tiny">
                {visibility === 'public'
                  ? `🌏 ${t('record.reviewPublic')}${form.rating ? '' : ` · ${t('record.reviewNeedsRating')}`}`
                  : `🔒 ${t('record.reviewPrivate')}`}
              </AppText>
            </View>
          ) : null}
        </>
      ) : null}

      {form.status === 'reading' ? (
        <>
          <View style={styles.section}>
            <AppText variant="subtitle">{t('record.period')}</AppText>
            <View style={styles.row}>
              <DateField label={t('record.startDate')} value={form.startDate} onChange={(v) => set('startDate', v)} />
              <View style={styles.flex} />
            </View>
          </View>
          <View style={styles.section}>
            <View style={[styles.row, styles.between]}>
              <AppText variant="subtitle">{t('record.progress')}</AppText>
              <View style={[styles.row, styles.center, styles.tight]}>
                {totalPages ? (
                  <AppText variant="caption" muted testID="total-pages">
                    {t('record.totalPages', { count: totalPages })}
                  </AppText>
                ) : null}
                <SegmentedControl
                  value={form.progressUnit}
                  onChange={(v) => set('progressUnit', v)}
                  options={[
                    { value: 'page', label: t('record.unitPage') },
                    { value: 'percent', label: t('record.unitPercent') },
                  ]}
                />
              </View>
            </View>
            {pagesFallback}
            {form.progressUnit === 'page' ? (
              <Input
                keyboardType="number-pad"
                value={form.currentPage}
                onChangeText={(v) => set('currentPage', v.replace(/[^0-9]/g, ''))}
                placeholder={t('record.currentPage')}
                right={
                  <AppText variant="caption" muted>
                    {totalPages ? t('record.totalPages', { count: totalPages }) : t('record.unitPage')}
                  </AppText>
                }
              />
            ) : (
              <Input
                keyboardType="number-pad"
                value={form.currentPercent}
                onChangeText={(v) => set('currentPercent', v.replace(/[^0-9]/g, '').slice(0, 3))}
                placeholder={t('record.currentPercent')}
                right={<AppText muted>%</AppText>}
              />
            )}
            <View style={[styles.row, styles.center]}>
              <ProgressBar percent={previewPercent} color={STATUS_META.reading.shadow} style={styles.flex} />
              <AppText variant="caption">{previewPercent}%</AppText>
              <GrowthBadge percent={previewPercent} />
            </View>
          </View>
        </>
      ) : null}

      {form.status === 'want' ? (
        <>
          <View style={[styles.row, styles.between]}>
            <AppText variant="subtitle">{t('record.expectation')}</AppText>
            <StarRating kind="heart" value={form.expectation} onChange={(v) => set('expectation', v)} />
          </View>
          <Input
            label={t('record.expectationNote')}
            showCounter
            maxLength={REVIEW_MAX_LENGTH}
            multiline
            value={form.expectationNote}
            onChangeText={(v) => set('expectationNote', v)}
            placeholder={t('record.expectationPlaceholder')}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  statusRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  statusCard: {
    width: 116,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  statusEmoji: { fontSize: 24, lineHeight: 30 },
  row: { flexDirection: 'row', gap: spacing.md },
  between: { justifyContent: 'space-between', alignItems: 'center' },
  center: { alignItems: 'center' },
  tight: { gap: spacing.sm },
  flex: { flex: 1 },
  pagesLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  visibility: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  visibilityPublic: { backgroundColor: palette.skySoft },
  visibilityPrivate: { backgroundColor: palette.stoneSoft },
});
