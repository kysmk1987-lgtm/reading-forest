import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, SegmentedControl, showToast } from '@/components/ui';
import { ProgressSheet } from '@/features/library/ProgressSheet';
import { focusMinutesOn } from '@/features/records/aggregate';
import { todayISO } from '@/lib/date';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { TIMER_PRESETS, useTimerStore, type TimerPhase } from '@/stores/timerStore';
import { palette, radius, spacing } from '@/theme';
import type { LibraryEntry } from '@/types';

import { canRequestWebNotifications, requestWebNotifications } from './timerAlarm';
import { TimerRing } from './TimerRing';

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={styles.stepperRow}>
        <Button size="sm" variant="soft" label="−" onPress={() => onChange(Math.max(1, value - 5))} />
        <AppText variant="number" style={styles.stepperValue}>
          {value}
        </AppText>
        <Button size="sm" variant="soft" label="+" onPress={() => onChange(Math.min(180, value + 5))} />
      </View>
    </View>
  );
}

export function TimerPanel() {
  const { t } = useTranslation();
  const timer = useTimerStore();
  const entries = useLibraryStore((s) => s.entries);
  const logs = useLibraryStore((s) => s.logs);
  const [progressEntry, setProgressEntry] = useState<LibraryEntry | null>(null);
  const reading = useMemo(
    () => Object.values(entries).filter((e) => e.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );
  const linked = timer.entryId ? entries[timer.entryId] : undefined;
  const today = todayISO();
  const todaySessions = timer.today.day === today ? timer.today : { sessions: 0, minutes: 0 };
  const loggedMinutes = focusMinutesOn(logs, today);
  const done = timer.status === 'done' && timer.lastSession;

  const startNext = (phase: TimerPhase) => {
    timer.setPhase(phase);
    timer.start();
  };

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <SegmentedControl<TimerPhase>
          value={timer.phase}
          onChange={(p) => timer.status !== 'running' && timer.setPhase(p)}
          options={[
            { value: 'focus', label: `📖 ${t('together.timer.focus')}` },
            { value: 'break', label: `🍵 ${t('together.timer.break')}` },
          ]}
        />
      </View>

      <View style={styles.presets}>
        {TIMER_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={t('together.timer.preset', { focus: p.focus, break: p.break })}
            selected={timer.presetId === p.id}
            onPress={() => timer.status !== 'running' && timer.setPreset(p.id)}
          />
        ))}
        <Chip
          label={t('together.timer.custom')}
          selected={timer.presetId === 'custom'}
          onPress={() => timer.status !== 'running' && timer.setPreset('custom')}
        />
      </View>
      {timer.presetId === 'custom' && timer.status !== 'running' ? (
        <View style={styles.customRow}>
          <Stepper label={t('together.timer.focusMinutes')} value={timer.focusMin} onChange={(v) => timer.setPreset('custom', { focus: v, break: timer.breakMin })} />
          <Stepper label={t('together.timer.breakMinutes')} value={timer.breakMin} onChange={(v) => timer.setPreset('custom', { focus: timer.focusMin, break: v })} />
        </View>
      ) : null}

      <View style={styles.center}>
        <TimerRing size={248} label={timer.phase === 'focus' ? t('together.timer.focusLabel') : t('together.timer.breakLabel')} />
      </View>

      {done ? (
        <Card tint={palette.leafSoft} edgeColor={palette.leaf} style={styles.doneCard}>
          <AppText variant="subtitle" center>
            {timer.lastSession!.phase === 'focus' ? `🎉 ${t('together.timer.focusDoneTitle')}` : `☀️ ${t('together.timer.breakDoneTitle')}`}
          </AppText>
          {timer.lastSession!.phase === 'focus' ? (
            <>
              <AppText variant="caption" muted center>
                {linked
                  ? t('together.timer.loggedFor', { minutes: timer.lastSession!.minutes, title: linked.book.title })
                  : t('together.timer.loggedNoBook', { minutes: timer.lastSession!.minutes })}
              </AppText>
              {linked ? (
                <Button label={t('together.timer.updatePages')} fullWidth onPress={() => setProgressEntry(linked)} />
              ) : null}
              <Button label={t('together.timer.startBreak', { minutes: timer.breakMin })} variant="sky" fullWidth onPress={() => startNext('break')} />
            </>
          ) : (
            <Button label={t('together.timer.startFocus', { minutes: timer.focusMin })} fullWidth onPress={() => startNext('focus')} />
          )}
        </Card>
      ) : (
        <View style={styles.controls}>
          {timer.status === 'running' ? (
            <Button size="lg" variant="wood" label={`⏸ ${t('together.timer.pause')}`} style={styles.flex} onPress={timer.pause} />
          ) : (
            <Button
              size="lg"
              label={timer.status === 'paused' ? `▶ ${t('together.timer.resume')}` : `▶ ${t('together.timer.start')}`}
              style={styles.flex}
              onPress={() => {
                tapFeedback('medium');
                timer.start();
              }}
            />
          )}
          <Button size="lg" variant="soft" label={`↺ ${t('together.timer.reset')}`} onPress={timer.reset} />
        </View>
      )}

      <Card style={styles.section}>
        <AppText variant="subtitle">{t('together.timer.bookTitle')}</AppText>
        {reading.length ? (
          <View style={styles.books}>
            <Chip label={t('together.timer.noBook')} selected={!timer.entryId} onPress={() => timer.linkEntry(null)} />
            {reading.slice(0, 6).map((e) => (
              <Chip key={e.id} label={`📖 ${e.book.title.slice(0, 14)}`} selected={timer.entryId === e.id} onPress={() => timer.linkEntry(e.id)} />
            ))}
          </View>
        ) : (
          <AppText variant="caption" muted>
            {t('together.timer.noReading')}
          </AppText>
        )}
        <AppText variant="tiny" muted>
          {t('together.timer.bookHint')}
        </AppText>
      </Card>

      <View style={styles.todayRow}>
        <View style={[styles.todayPill, { backgroundColor: palette.leafSoft }]}>
          <AppText variant="number">{todaySessions.sessions}</AppText>
          <AppText variant="tiny" muted>
            {t('together.timer.todaySessions')}
          </AppText>
        </View>
        <View style={[styles.todayPill, { backgroundColor: palette.yellowSoft }]}>
          <AppText variant="number">{todaySessions.minutes}</AppText>
          <AppText variant="tiny" muted>
            {t('together.timer.todayMinutes')}
          </AppText>
        </View>
        <View style={[styles.todayPill, { backgroundColor: palette.skySoft }]}>
          <AppText variant="number">{loggedMinutes}</AppText>
          <AppText variant="tiny" muted>
            {t('together.timer.loggedMinutes')}
          </AppText>
        </View>
      </View>

      {Platform.OS === 'web' && canRequestWebNotifications ? (
        <Pressable
          accessibilityRole="button"
          onPress={async () => showToast((await requestWebNotifications()) ? t('together.timer.notifyOn') : t('together.timer.notifyDenied'))}>
          <AppText variant="tiny" muted center>
            🔔 {t('together.timer.notifyWeb')}
          </AppText>
        </Pressable>
      ) : null}

      <ProgressSheet entry={progressEntry} onClose={() => setProgressEntry(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  center: { alignItems: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  customRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  stepper: { alignItems: 'center', gap: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperValue: { minWidth: 36, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  doneCard: { gap: spacing.sm },
  section: { gap: spacing.sm },
  books: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  todayRow: { flexDirection: 'row', gap: spacing.sm },
  todayPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg },
});
