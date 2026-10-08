import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, showToast } from '@/components/ui';
import { ProgressSheet } from '@/features/library/ProgressSheet';
import { focusMinutesOn } from '@/features/records/aggregate';
import { AMBIENT_SOUNDS } from '@/features/sound/ambient';
import { SoundSheet } from '@/features/sound/SoundSheet';
import { todayISO } from '@/lib/date';
import { useLibraryStore } from '@/stores/libraryStore';
import { useMixerStore } from '@/stores/mixerStore';
import { TIMER_PRESETS, useTimerStore } from '@/stores/timerStore';
import { palette, radius, spacing } from '@/theme';
import type { LibraryEntry } from '@/types';

import { REPEAT_CYCLES } from './timerEngine';
import { canRequestWebNotifications, requestWebNotifications } from './timerNotify';
import { PreAlertBanner, TimerControls } from './TimerControls';
import { TimerRing, useTimerClock } from './TimerRing';

function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={styles.stepperRow}>
        <Button size="sm" variant="soft" label="−" accessibilityLabel={`${label} −`} onPress={() => onChange(Math.max(1, value - step))} />
        <AppText variant="number" style={styles.stepperValue}>
          {value}
        </AppText>
        <Button size="sm" variant="soft" label="+" accessibilityLabel={`${label} +`} onPress={() => onChange(Math.min(180, value + step))} />
      </View>
    </View>
  );
}

/** 📖 집중 25분 → 🍵 휴식 5분, with the current phase lit up and the cycle count. */
function PhaseStrip() {
  const { t } = useTranslation();
  const { run, plan, info } = useTimerClock();
  const active = run.status === 'running' || run.status === 'paused';
  const focusMin = Math.round(plan.focusMs / 60_000);
  const breakMin = Math.round(plan.breakMs / 60_000);
  const step = (phase: 'focus' | 'break') => {
    const on = active && info.phase === phase;
    const color = phase === 'focus' ? palette.leafDeep : palette.skyDeep;
    return (
      <View
        style={[styles.phase, on && { backgroundColor: phase === 'focus' ? palette.leafSoft : palette.skySoft, borderColor: color }]}
        accessibilityState={{ selected: on }}>
        <AppText variant="caption" color={on ? color : undefined}>
          {phase === 'focus' ? `📖 ${t('together.timer.focus')} ${focusMin}${t('together.timer.min')}` : `🍵 ${t('together.timer.break')} ${breakMin}${t('together.timer.min')}`}
        </AppText>
        {on ? (
          <AppText variant="tiny" color={color}>
            {phase === 'focus' ? t('together.timer.focusing') : t('together.timer.resting')}
          </AppText>
        ) : null}
      </View>
    );
  };
  return (
    <View style={styles.strip}>
      <View style={styles.stripRow}>
        {step('focus')}
        <AppText muted>→</AppText>
        {step('break')}
        {plan.repeat ? <AppText muted>↻</AppText> : null}
      </View>
      <AppText variant="tiny" muted center>
        {active
          ? plan.repeat
            ? t('together.timer.cycleNow', { cycle: info.cycle, total: info.totalCycles })
            : t('together.timer.onceNow')
          : plan.repeat
            ? t('together.timer.repeatPlan', { focus: focusMin, break: breakMin, max: REPEAT_CYCLES })
            : t('together.timer.oncePlan', { focus: focusMin, break: breakMin, total: focusMin + breakMin })}
      </AppText>
    </View>
  );
}

function SoundCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const volumes = useMixerStore((s) => s.volumes);
  const playing = useMixerStore((s) => s.playing);
  const withTimer = useMixerStore((s) => s.withTimer);
  const owner = useMixerStore((s) => s.owner);
  const on = AMBIENT_SOUNDS.filter((s) => (volumes[s.id] ?? 0) > 0);
  const summary = on.length ? on.map((s) => `${s.emoji} ${t(`together.sounds.${s.id}`)}`).join(' · ') : t('together.sound.none');
  const state = playing
    ? t('together.sound.playingNow')
    : owner === 'muted'
      ? t('together.sound.mutedForRun')
      : withTimer && on.length
        ? t('together.sound.autoOn')
        : t('together.sound.autoOff');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('together.sound.title')} onPress={onOpen}>
      {({ pressed }) => (
        <Card tint={palette.skySoft} edgeColor={palette.sky} style={[styles.soundCard, pressed && styles.pressed]}>
          <AppText style={styles.soundEmoji}>{playing ? '🎧' : '🔈'}</AppText>
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('together.sound.title')}</AppText>
            <AppText variant="caption" numberOfLines={1}>
              {summary}
            </AppText>
            <AppText variant="tiny" muted>
              {state}
            </AppText>
          </View>
          <AppText variant="caption" color={palette.skyDeep}>
            {t('together.sound.open')} ›
          </AppText>
        </Card>
      )}
    </Pressable>
  );
}

/** Shown once a run has finished all its cycles. */
function FinishCard({ onPages }: { onPages: (entry: LibraryEntry) => void }) {
  const { t } = useTranslation();
  const lastRun = useTimerStore((s) => s.lastRun);
  const status = useTimerStore((s) => s.run.status);
  const entry = useLibraryStore((s) => (lastRun?.entryId ? s.entries[lastRun.entryId] : undefined));
  if (status !== 'done' || !lastRun) return null;
  return (
    <Card tint={palette.leafSoft} edgeColor={palette.leaf} style={styles.doneCard}>
      <AppText variant="subtitle" center>
        🎉 {t('together.timer.runDoneTitle')}
      </AppText>
      <AppText variant="caption" muted center>
        {entry
          ? t('together.timer.loggedFor', { minutes: lastRun.focusMinutes, title: entry.book.title })
          : t('together.timer.loggedNoBook', { minutes: lastRun.focusMinutes })}
      </AppText>
      {entry ? <Button label={t('together.timer.updatePages')} variant="sky" fullWidth onPress={() => onPages(entry)} /> : null}
    </Card>
  );
}

export function TimerPanel({ highlightStart, onStarted }: { highlightStart?: boolean; onStarted?: () => void }) {
  const { t } = useTranslation();
  const presetId = useTimerStore((s) => s.presetId);
  const focusMin = useTimerStore((s) => s.focusMin);
  const breakMin = useTimerStore((s) => s.breakMin);
  const repeat = useTimerStore((s) => s.repeat);
  const status = useTimerStore((s) => s.run.status);
  const entryId = useTimerStore((s) => s.entryId);
  const todayStats = useTimerStore((s) => s.today);
  const setPreset = useTimerStore((s) => s.setPreset);
  const setRepeat = useTimerStore((s) => s.setRepeat);
  const linkEntry = useTimerStore((s) => s.linkEntry);
  const entries = useLibraryStore((s) => s.entries);
  const logs = useLibraryStore((s) => s.logs);
  const [progressEntry, setProgressEntry] = useState<LibraryEntry | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const locked = status === 'running' || status === 'paused';
  const linked = entryId ? entries[entryId] : undefined;
  const choices = useMemo(() => {
    const reading = Object.values(entries)
      .filter((e) => e.status === 'reading')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6);
    // A book chosen from its detail page stays visible even when it isn't among the latest reading books.
    if (linked && !reading.some((e) => e.id === linked.id)) reading.unshift(linked);
    return reading;
  }, [entries, linked]);
  const today = todayISO();
  const todaySessions = todayStats.day === today ? todayStats : { sessions: 0, minutes: 0 };
  const loggedMinutes = focusMinutesOn(logs, today);

  const pickPreset = (id: (typeof TIMER_PRESETS)[number]['id'] | 'custom') => {
    if (locked) showToast(t('together.timer.lockedWhileRunning'));
    else setPreset(id);
  };

  return (
    <View style={styles.root}>
      <View style={styles.presets}>
        {TIMER_PRESETS.map((p) => (
          <Chip key={p.id} label={t('together.timer.preset', { focus: p.focus, break: p.break })} selected={presetId === p.id} onPress={() => pickPreset(p.id)} />
        ))}
        <Chip label={t('together.timer.custom')} selected={presetId === 'custom'} onPress={() => pickPreset('custom')} />
        <Chip
          label={`🔁 ${t('together.timer.repeat')} ${repeat ? t('together.timer.on') : t('together.timer.off')}`}
          selected={repeat}
          color={palette.skyDeep}
          edgeColor={palette.skyDeep}
          onPress={() => {
            if (!setRepeat(!repeat)) showToast(t('together.timer.repeatNextRun'));
          }}
        />
      </View>
      {presetId === 'custom' && !locked ? (
        <View style={styles.customRow}>
          <Stepper label={t('together.timer.focusMinutes')} value={focusMin} step={5} onChange={(v) => setPreset('custom', { focus: v, break: breakMin })} />
          <Stepper label={t('together.timer.breakMinutes')} value={breakMin} step={1} onChange={(v) => setPreset('custom', { focus: focusMin, break: v })} />
        </View>
      ) : null}

      <PhaseStrip />

      <View style={styles.center}>
        <TimerRing size={248} />
      </View>
      <PreAlertBanner />

      <FinishCard onPages={setProgressEntry} />
      {highlightStart && linked && status !== 'running' ? (
        <AppText variant="caption" center color={palette.leafDeep}>
          📖 {t('together.timer.readyWithBook', { title: linked.book.title })}
        </AppText>
      ) : null}
      <TimerControls highlight={highlightStart} onStarted={onStarted} />

      <SoundCard onOpen={() => setSoundOpen(true)} />

      <Card style={[styles.section, highlightStart && linked ? styles.sectionHighlight : null]}>
        <AppText variant="subtitle">{t('together.timer.bookTitle')}</AppText>
        {choices.length ? (
          <View style={styles.books}>
            <Chip label={t('together.timer.noBook')} selected={!entryId} onPress={() => linkEntry(null)} />
            {choices.map((e) => (
              <Chip key={e.id} label={`📖 ${e.book.title.slice(0, 14)}`} selected={entryId === e.id} onPress={() => linkEntry(e.id)} />
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
      ) : (
        <AppText variant="tiny" muted center>
          🔒 {t('together.timer.lockScreenHint')}
        </AppText>
      )}

      <ProgressSheet entry={progressEntry} onClose={() => setProgressEntry(null)} />
      <SoundSheet visible={soundOpen} onClose={() => setSoundOpen(false)} />
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
  strip: { gap: spacing.xs },
  stripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  phase: {
    alignItems: 'center',
    minWidth: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: palette.cream,
  },
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  soundCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  soundEmoji: { fontSize: 30, lineHeight: 38 },
  doneCard: { gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionHighlight: { borderColor: palette.leaf },
  books: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  todayRow: { flexDirection: 'row', gap: spacing.sm },
  todayPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg },
});
