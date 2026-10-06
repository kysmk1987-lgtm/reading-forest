import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { remainingMsOf, useTimerStore } from '@/stores/timerStore';
import { palette } from '@/theme';

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Re-renders a few times a second while the timer runs; time itself always comes from `endsAt`. */
export function useRemainingMs() {
  const status = useTimerStore((s) => s.status);
  const endsAt = useTimerStore((s) => s.endsAt);
  const remainingMs = useTimerStore((s) => s.remainingMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [status]);
  return remainingMsOf({ status, endsAt, remainingMs }, now);
}

/** Big friendly countdown ring (also used small in theme rooms). */
export function TimerRing({ size = 240, label }: { size?: number; label?: string }) {
  const phase = useTimerStore((s) => s.phase);
  const focusMin = useTimerStore((s) => s.focusMin);
  const breakMin = useTimerStore((s) => s.breakMin);
  const total = (phase === 'focus' ? focusMin : breakMin) * 60_000;
  const remaining = Math.min(total, useRemainingMs());
  const progress = total > 0 ? 1 - remaining / total : 0;
  const stroke = Math.max(8, size * 0.07);
  const r = (size - stroke) / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const color = phase === 'focus' ? palette.leafDeep : palette.skyDeep;
  const soft = phase === 'focus' ? palette.leafSoft : palette.skySoft;
  const big = size >= 160;

  return (
    <View style={{ width: size, height: size }} accessibilityRole="timer" accessibilityLabel={`timer ${formatClock(remaining)}`}>
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
        {label ? (
          <AppText variant={big ? 'caption' : 'tiny'} muted>
            {label}
          </AppText>
        ) : null}
        <AppText variant="number" style={{ fontSize: big ? size * 0.2 : size * 0.22, lineHeight: big ? size * 0.25 : size * 0.28, color }}>
          {formatClock(remaining)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
