import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { AppText, Card, IconButton, SegmentedControl } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, palette, radius, spacing } from '@/theme';

import { activitiesByDay, daysInMonth, type DayActivity } from './aggregate';

type Filter = 'all' | 'complete';
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function ReadingCalendar() {
  const { t } = useTranslation();
  const logs = useLibraryStore((s) => s.logs);
  const entries = useLibraryStore((s) => s.entries);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const today = todayISO();

  const byDay = useMemo(
    () => activitiesByDay(logs, entries, cursor.year, cursor.month, filter === 'complete'),
    [logs, entries, cursor, filter],
  );

  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const total = daysInMonth(cursor.year, cursor.month);
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const summary = useMemo(() => {
    const all = [...byDay.values()].flat();
    return {
      days: byDay.size,
      finished: new Set(all.filter((a) => a.kind === 'complete').map((a) => a.entry.id)).size,
      pages: all.reduce((s, a) => s + a.pages, 0),
    };
  }, [byDay]);

  const move = (delta: number) => {
    setSelectedDay(null);
    setCursor(({ year, month }) => {
      const d = new Date(year, month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  const iso = (day: number) => `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const selected = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel={t('records.prevMonth')} onPress={() => move(-1)} size={18} />
        <AppText variant="subtitle" style={styles.monthLabel}>
          {t('records.monthLabel', { year: cursor.year, month: cursor.month })}
        </AppText>
        <IconButton name="chevron-forward" accessibilityLabel={t('records.nextMonth')} onPress={() => move(1)} size={18} />
      </View>
      <View style={styles.filterRow}>
        <SegmentedControl<Filter>
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setSelectedDay(null);
          }}
          options={[
            { value: 'all', label: t('records.filterAll') },
            { value: 'complete', label: t('records.filterComplete') },
          ]}
        />
      </View>

      <Card padded={false} style={styles.calendar}>
        <View style={styles.row}>
          {WEEKDAYS.map((w, i) => (
            <AppText key={w} variant="tiny" center style={[styles.weekday, i === 0 && styles.sunday]}>
              {t(`records.weekday.${w}`)}
            </AppText>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={styles.cell} />;
            const date = iso(day);
            const items = byDay.get(date) ?? [];
            const first = items[0];
            const isToday = date === today;
            const isSelected = date === selectedDay;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${day}`}
                onPress={() => {
                  tapFeedback();
                  setSelectedDay(isSelected ? null : date);
                }}
                style={styles.cell}>
                <View style={[styles.cellInner, isSelected && styles.cellSelected]}>
                  {first ? <DayCover activity={first} /> : null}
                  <View style={[styles.dayNum, first && styles.dayNumOnCover, isToday && styles.dayToday]}>
                    <AppText variant="tiny" color={isToday ? colors.textOnPrimary : i % 7 === 0 ? palette.pinkDeep : colors.text}>
                      {day}
                    </AppText>
                  </View>
                  {items.length > 1 ? (
                    <View style={styles.more}>
                      <AppText variant="tiny" color={colors.textOnPrimary}>
                        +{items.length - 1}
                      </AppText>
                    </View>
                  ) : null}
                  {first?.kind === 'complete' ? <AppText style={styles.flag}>🏁</AppText> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.summary}>
        <SummaryPill emoji="🗓️" label={t('records.summaryDays', { count: summary.days })} />
        <SummaryPill emoji="🏁" label={t('records.summaryFinished', { count: summary.finished })} />
        <SummaryPill emoji="📄" label={t('records.summaryPages', { count: summary.pages })} />
      </View>

      {selectedDay ? (
        <Card style={styles.dayCard}>
          <AppText variant="subtitle">{selectedDay.replaceAll('-', '. ')}</AppText>
          {selected.length === 0 ? (
            <AppText variant="caption" muted>
              {t('records.noActivity')}
            </AppText>
          ) : (
            selected.map((a) => (
              <Pressable
                key={a.entry.id}
                onPress={() => router.push({ pathname: '/book/[id]', params: { id: a.entry.book.id } })}
                style={styles.dayRow}>
                <BookCover uri={a.entry.book.coverUrl} title={a.entry.book.title} width={34} />
                <View style={styles.flex}>
                  <AppText numberOfLines={1}>{a.entry.book.title}</AppText>
                  <AppText variant="tiny" muted>
                    {t(`records.kind.${a.kind}`)}
                    {a.pages > 0 ? ` · ${t('common.pages', { count: a.pages })}` : ''}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </Card>
      ) : (
        <AppText variant="caption" muted center>
          {byDay.size ? t('records.tapDayHint') : t('records.emptyMonth')}
        </AppText>
      )}
    </View>
  );
}

function DayCover({ activity }: { activity: DayActivity }) {
  const uri = activity.entry.book.coverUrl;
  return uri ? (
    <Image source={{ uri }} style={styles.cover} contentFit="cover" transition={150} />
  ) : (
    <View style={[styles.cover, styles.coverFallback]}>
      <AppText style={styles.coverEmoji}>📗</AppText>
    </View>
  );
}

function SummaryPill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.pill}>
      <AppText variant="tiny">
        {emoji} {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { flex: 1, textAlign: 'center' },
  filterRow: { alignItems: 'center' },
  calendar: { padding: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, color: colors.textMuted, paddingVertical: 4 },
  sunday: { color: palette.pinkDeep },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.72, padding: 2 },
  cellInner: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: palette.beige, borderWidth: 1.5, borderColor: 'transparent' },
  cellSelected: { borderColor: colors.primary },
  cover: { ...StyleSheet.absoluteFill },
  coverFallback: { backgroundColor: palette.leafSoft, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 16 },
  dayNum: { alignSelf: 'flex-start', margin: 2, paddingHorizontal: 4, borderRadius: radius.pill },
  dayNumOnCover: { backgroundColor: 'rgba(255,253,246,0.88)' },
  dayToday: { backgroundColor: colors.primary },
  more: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(91,70,54,0.75)',
  },
  flag: { position: 'absolute', left: 2, bottom: 0, fontSize: 11 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  dayCard: { gap: spacing.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
