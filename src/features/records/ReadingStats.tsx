import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText, Card, IconButton, SegmentedControl } from '@/components/ui';
import { STATUS_META } from '@/features/library/statusMeta';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, palette, radius, spacing } from '@/theme';

import { daysInMonth, monthlyTotals, readingDaysInMonth } from './aggregate';

type Metric = 'books' | 'pages';
const BAR_MAX = 120;

export function ReadingStats() {
  const { t } = useTranslation();
  const logs = useLibraryStore((s) => s.logs);
  const entries = useLibraryStore((s) => s.entries);
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const [year, setYear] = useState(thisYear);
  const [metric, setMetric] = useState<Metric>('books');

  const firstYear = useMemo(
    () => Math.min(thisYear, ...logs.map((l) => Number(l.date.slice(0, 4))).filter(Boolean)),
    [logs, thisYear],
  );
  const months = useMemo(() => monthlyTotals(logs, year), [logs, year]);
  const values = months.map((m) => m[metric]);
  const max = Math.max(1, ...values);
  const yearTotal = values.reduce((a, b) => a + b, 0);

  const readingDays = readingDaysInMonth(logs, thisYear, thisMonth);
  const monthDays = daysInMonth(thisYear, thisMonth);

  const counts = useMemo(() => {
    const list = Object.values(entries);
    return {
      reading: list.filter((e) => e.status === 'reading').length,
      read: list.filter((e) => e.status === 'read').length,
      records: logs.length,
    };
  }, [entries, logs]);

  return (
    <View style={styles.wrap}>
      <View style={styles.countRow}>
        <CountCard emoji={STATUS_META.reading.emoji} label={t('records.countReading')} value={counts.reading} tint={STATUS_META.reading.soft} />
        <CountCard emoji={STATUS_META.read.emoji} label={t('records.countRead')} value={counts.read} tint={STATUS_META.read.soft} />
        <CountCard emoji="✏️" label={t('records.countRecords')} value={counts.records} tint={palette.yellowSoft} />
      </View>

      <Card style={styles.ringCard}>
        <Ring value={readingDays} total={monthDays} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{t('records.monthDaysTitle', { month: thisMonth })}</AppText>
          <AppText variant="caption" muted>
            {t('records.monthDaysBody', { days: readingDays, total: monthDays })}
          </AppText>
        </View>
      </Card>

      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <AppText variant="subtitle">{t('records.monthlyTitle')}</AppText>
          <SegmentedControl<Metric>
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'books', label: t('records.metricBooks') },
              { value: 'pages', label: t('records.metricPages') },
            ]}
          />
        </View>
        <View style={styles.yearRow}>
          <IconButton
            name="chevron-back"
            size={16}
            accessibilityLabel={t('records.prevYear')}
            onPress={() => setYear((y) => Math.max(firstYear, y - 1))}
          />
          <AppText variant="subtitle">{t('records.yearLabel', { year })}</AppText>
          <IconButton
            name="chevron-forward"
            size={16}
            accessibilityLabel={t('records.nextYear')}
            onPress={() => setYear((y) => Math.min(thisYear, y + 1))}
          />
        </View>
        <AppText variant="caption" muted center>
          {metric === 'books' ? t('records.yearBooks', { count: yearTotal }) : t('records.yearPages', { count: yearTotal })}
        </AppText>
        <View style={styles.bars}>
          {values.map((v, i) => {
            const current = year === thisYear && i + 1 === thisMonth;
            return (
              <View key={i} style={styles.barCol}>
                <AppText variant="tiny" style={styles.barValue} numberOfLines={1}>
                  {v > 0 ? (metric === 'pages' && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : ''}
                </AppText>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(4, (v / max) * BAR_MAX) },
                    v === 0 && styles.barEmpty,
                    current && styles.barCurrent,
                  ]}
                />
                <AppText variant="tiny" muted={!current} color={current ? colors.primaryDeep : undefined}>
                  {i + 1}
                </AppText>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const size = 104;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total ? Math.min(1, value / total) : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.leafSoft} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={palette.leafDeep}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * ratio} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <AppText variant="number" style={styles.ringValue}>
          {value}
        </AppText>
        <AppText variant="tiny" muted>
          / {total}
        </AppText>
      </View>
    </View>
  );
}

function CountCard({ emoji, label, value, tint }: { emoji: string; label: string; value: number; tint: string }) {
  return (
    <View style={[styles.count, { backgroundColor: tint }]}>
      <AppText style={styles.countEmoji}>{emoji}</AppText>
      <AppText variant="number" style={styles.countValue}>
        {value.toLocaleString()}
      </AppText>
      <AppText variant="tiny" muted>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  countRow: { flexDirection: 'row', gap: spacing.sm },
  count: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(91,70,54,0.12)',
    gap: 2,
  },
  countEmoji: { fontSize: 18 },
  countValue: { fontSize: 22 },
  ringCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringLabel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 26, lineHeight: 30 },
  chartCard: { gap: spacing.sm },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX + 40, gap: 3, paddingTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  barValue: { fontSize: 10 },
  bar: { width: '78%', borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: palette.leaf },
  barEmpty: { backgroundColor: palette.sand },
  barCurrent: { backgroundColor: palette.leafDeep },
  flex: { flex: 1, gap: 4 },
});
