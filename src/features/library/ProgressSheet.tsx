import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { GrowthBadge } from '@/components/GrowthBadge';
import { AppText, Button, Input, ProgressBar, SegmentedControl, Sheet } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { successFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { spacing } from '@/theme';
import type { LibraryEntry, ProgressUnit } from '@/types';

import { progressPercent } from './growth';
import { STATUS_META } from './statusMeta';

export function ProgressSheet({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { t } = useTranslation();
  const updateEntry = useLibraryStore((s) => s.updateEntry);
  const [unit, setUnit] = useState<ProgressUnit>('page');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!entry) return;
    const u = entry.progressUnit ?? 'page';
    setUnit(u);
    const v = u === 'page' ? entry.currentPage : entry.currentPercent;
    setValue(v ? String(v) : '');
  }, [entry]);

  if (!entry) return null;
  const total = entry.book.pageCount;
  const num = parseInt(value, 10) || 0;
  const clamped = unit === 'percent' ? Math.min(num, 100) : total ? Math.min(num, total) : num;
  const preview = progressPercent({
    ...entry,
    progressUnit: unit,
    currentPage: unit === 'page' ? clamped : undefined,
    currentPercent: unit === 'percent' ? clamped : undefined,
  });

  const save = () => {
    const done = preview >= 100;
    updateEntry(entry.id, {
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
