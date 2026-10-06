import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { GrowthBadge } from '@/components/GrowthBadge';
import { AppText, Button, Input, ProgressBar, SegmentedControl, Sheet } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { successFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, spacing } from '@/theme';
import type { LibraryEntry, ProgressUnit } from '@/types';

import { progressPercent } from './growth';
import { defaultProgressUnit } from './pages';
import { STATUS_META } from './statusMeta';

export function ProgressSheet({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  if (!entry) return null;
  return <ProgressForm key={entry.id} entry={entry} onClose={onClose} />;
}

function ProgressForm({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const { t } = useTranslation();
  const updateEntry = useLibraryStore((s) => s.updateEntry);
  const [unit, setUnit] = useState<ProgressUnit>(() => defaultProgressUnit(entry.book.pageCount, entry.progressUnit));
  const [manualPages, setManualPages] = useState(false);
  const [value, setValue] = useState(() => {
    const v = unit === 'page' ? entry.currentPage : entry.currentPercent;
    return v ? String(v) : '';
  });
  const [totalText, setTotalText] = useState('');

  const missingPageCount = !entry.book.pageCount;
  const total = entry.book.pageCount ?? (parseInt(totalText, 10) || undefined);
  const book = total === entry.book.pageCount ? entry.book : { ...entry.book, pageCount: total };
  const num = parseInt(value, 10) || 0;
  const clamped = unit === 'percent' ? Math.min(num, 100) : total ? Math.min(num, total) : num;
  const preview = progressPercent({
    ...entry,
    book,
    progressUnit: unit,
    currentPage: unit === 'page' ? clamped : undefined,
    currentPercent: unit === 'percent' ? clamped : undefined,
  });

  const save = () => {
    const done = preview >= 100;
    updateEntry(entry.id, {
      book,
      progressUnit: unit,
      currentPage: unit === 'page' ? clamped : undefined,
      currentPercent: unit === 'percent' ? clamped : undefined,
      ...(done ? { status: 'read' as const, endDate: todayISO() } : null),
    });
    successFeedback();
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('library.updateProgress')}
      footer={<Button label={t('common.save')} size="lg" fullWidth onPress={save} />}>
      <AppText center numberOfLines={2}>
        {entry.book.title}
      </AppText>
      <View style={styles.center}>
        <SegmentedControl
          value={unit}
          onChange={(u) => {
            setUnit(u);
            setValue('');
          }}
          options={[
            { value: 'page', label: t('record.unitPage') },
            { value: 'percent', label: t('record.unitPercent') },
          ]}
        />
      </View>
      <Input
        keyboardType="number-pad"
        autoFocus
        value={value}
        onChangeText={(v) => setValue(v.replace(/[^0-9]/g, '').slice(0, 5))}
        placeholder={unit === 'page' ? t('record.currentPage') : t('record.currentPercent')}
        right={
          <AppText variant="caption" muted>
            {unit === 'percent' ? '%' : total ? t('record.totalPages', { count: total }) : t('record.unitPage')}
          </AppText>
        }
      />
      {missingPageCount && manualPages ? (
        <View style={styles.gap}>
          <Input
            label={t('record.totalPagesLabel')}
            keyboardType="number-pad"
            value={totalText}
            onChangeText={(v) => setTotalText(v.replace(/[^0-9]/g, '').slice(0, 5))}
            placeholder={t('record.totalPagesPlaceholder')}
            right={<AppText variant="caption" muted>{t('record.unitPage')}</AppText>}
          />
          <AppText variant="tiny" muted>
            {t('record.totalPagesHint')}
          </AppText>
        </View>
      ) : missingPageCount ? (
        <Pressable accessibilityRole="button" onPress={() => setManualPages(true)} style={styles.link}>
          <AppText variant="caption" muted>
            {t('record.pagesUnknown')} · <AppText variant="caption" color={colors.primaryDeep}>{t('record.pagesManual')}</AppText>
          </AppText>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <ProgressBar percent={preview} color={STATUS_META.reading.shadow} style={styles.flex} />
        <AppText variant="caption">{preview}%</AppText>
        <GrowthBadge percent={preview} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  gap: { gap: spacing.sm },
  link: { alignSelf: 'center', paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
