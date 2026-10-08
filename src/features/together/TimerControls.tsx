import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText, Button, showToast } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { useTimerStore } from '@/stores/timerStore';
import { palette, radius, spacing } from '@/theme';

import { pauseTimer, resetTimer, resumeTimer, startTimer } from './timerActions';
import { useTimerClock } from './TimerRing';

/** 5-second heads-up before a phase ends ("5초 후 휴식이 시작돼요"). */
export function PreAlertBanner() {
  const { t } = useTranslation();
  const { preAlert } = useTimerClock();
  if (!preAlert) return null;
  const key = preAlert.next === 'break' ? 'preBreak' : preAlert.next === 'focus' ? 'preFocus' : 'preDone';
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityLabel="pre-alert">
      <AppText color={palette.brown} center>
        ⏰ {t(`together.timer.${key}`, { seconds: preAlert.seconds })}
      </AppText>
    </View>
  );
}

/** 시작 · 일시정지 · 계속 + 처음으로. `highlight` pulses 시작 (opened from a book's "이 책 읽기"). */
export function TimerControls({ compact, highlight, onStarted }: { compact?: boolean; highlight?: boolean; onStarted?: () => void }) {
  const { t } = useTranslation();
  const status = useTimerStore((s) => s.run.status);
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!highlight || status === 'running') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [highlight, status, pulse]);

  const size = compact ? 'md' : 'lg';
  const start = async () => {
    tapFeedback('medium');
    onStarted?.();
    const ok = status === 'paused' ? await resumeTimer() : await startTimer();
    if (!ok) showToast(t('together.mixer.blocked'));
  };
  const reset = () => {
    const logged = resetTimer();
    if (logged > 0) showToast(t('together.timer.partialLogged', { minutes: logged }));
  };

  return (
    <View style={styles.controls}>
      {status === 'running' ? (
        <Button size={size} variant="wood" label={`⏸ ${t('together.timer.pause')}`} style={styles.flex} onPress={pauseTimer} />
      ) : (
        <Animated.View style={[styles.flex, highlight && styles.glow, { transform: [{ scale: pulse }] }]}>
          <Button
            size={size}
            fullWidth
            label={status === 'paused' ? `▶ ${t('together.timer.resume')}` : `▶ ${t('together.timer.start')}`}
            onPress={start}
          />
        </Animated.View>
      )}
      <Button
        size={size}
        variant="soft"
        label={`↺ ${t('together.timer.reset')}`}
        disabled={status === 'idle'}
        onPress={reset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  flex: { flex: 1 },
  glow: { borderRadius: radius.lg + 4, padding: 3, backgroundColor: palette.yellowSoft, borderWidth: 2, borderColor: palette.yellow },
  banner: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.yellowSoft,
    borderWidth: 2,
    borderColor: palette.yellow,
  },
});
