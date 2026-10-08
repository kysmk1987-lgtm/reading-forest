import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { planOf, useTimerStore } from '@/stores/timerStore';
import { palette } from '@/theme';

import { elapsedAt, phaseAt, preAlertAt, type PhaseInfo } from './timerEngine';

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Live view of the run, re-rendered a few times a second while running; time always comes from the start timestamp. */
export function useTimerClock() {
  const run = useTimerStore((s) => s.run);
  const focusMin = useTimerStore((s) => s.focusMin);
  const breakMin = useTimerStore((s) => s.breakMin);
  const repeat = useTimerStore((s) => s.repeat);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [run.status]);
  const idle = run.status === 'idle';
  // Idle shows the plan that 시작 would run (the preset may have just changed).
  const plan = idle ? planOf({ focusMin, breakMin, repeat }) : run;
  const elapsed = idle ? 0 : elapsedAt(run, now);
  const info: PhaseInfo = phaseAt(plan, elapsed);
  const preAlert = run.status === 'running' ? preAlertAt(plan, elapsed) : null;
  return { run, plan, elapsed, info, preAlert };
}

/** Big friendly countdown ring (also used small in theme rooms). */
export function TimerRing({ size = 240 }: { size?: number }) {
  const { t } = useTranslation();
  const { run, info, preAlert } = useTimerClock();
  const done = run.status === 'done' || info.phase === 'done';
  const isBreak = info.phase === 'break';
  const remaining = done ? 0 : info.remainingMs;
  const progress = done ? 1 : info.phaseMs > 0 ? info.phaseElapsedMs / info.phaseMs : 0;
  const stroke = Math.max(8, size * 0.07);
  const r = (size - stroke) / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const color = preAlert ? palette.yellowDeep : isBreak ? palette.skyDeep : palette.leafDeep;
  const soft = isBreak ? palette.skySoft : palette.leafSoft;
  const big = size >= 160;
  const label = done
    ? t('together.timer.doneLabel')
    : run.status === 'idle'
      ? t('together.timer.readyLabel')
      : run.status === 'paused'
        ? t('together.timer.pausedLabel')
        : isBreak
          ? t('together.timer.breakLabel')
          : t('together.timer.focusLabel');

  return (
    <View style={{ width: size, height: size }} accessibilityRole="timer" accessibilityLabel={`${label} ${formatClock(remaining)}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 2} fill={palette.cream} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={soft} strokeWidth={stroke} fill="none" />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
          />
        </G>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const rr = r - stroke * 1.1;
          return <Circle key={i} cx={size / 2 + Math.sin(a) * rr} cy={size / 2 - Math.cos(a) * rr} r={big ? 2.2 : 1.2} fill={soft} />;
        })}
      </Svg>
      <View style={styles.center}>
        <AppText variant={big ? 'caption' : 'tiny'} color={isBreak ? palette.skyDeep : palette.leafDeep}>
          {label}
        </AppText>
        <AppText variant="number" style={{ fontSize: big ? size * 0.2 : size * 0.22, lineHeight: big ? size * 0.25 : size * 0.28, color }}>
          {formatClock(remaining)}
        </AppText>
        {big && info.totalCycles > 1 && !done ? (
          <AppText variant="tiny" muted>
            {t('together.timer.cycleOf', { cycle: info.cycle, total: info.totalCycles })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
