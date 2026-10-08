import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Sheet } from '@/components/ui';
import { useMixerStore } from '@/stores/mixerStore';
import { useTimerStore } from '@/stores/timerStore';
import { colors, palette, radius, spacing } from '@/theme';

import { elapsedAt, phaseAt } from '../together/timerEngine';
import { MixerPanel } from './MixerPanel';

function SettingRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText>{label}</AppText>
        <AppText variant="tiny" muted>
          {hint}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        {...({ activeThumbColor: colors.surface } as object)}
      />
    </View>
  );
}

/** 소리 설정: preview and mix ambient sounds on their own, and choose how they follow the reading timer. */
export function SoundSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const withTimer = useMixerStore((s) => s.withTimer);
  const duringBreak = useMixerStore((s) => s.duringBreak);
  const setWithTimer = useMixerStore((s) => s.setWithTimer);
  const setDuringBreak = useMixerStore((s) => s.setDuringBreak);

  const close = () => {
    // A preview stops with the sheet; the timer's own sound (or a room's) keeps going.
    const m = useMixerStore.getState();
    const { run } = useTimerStore.getState();
    const focusing = run.status === 'running' && phaseAt(run, elapsedAt(run, Date.now())).phase === 'focus';
    if (m.playing && m.owner === 'user' && !(focusing && m.withTimer)) m.stop();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={`🎧 ${t('together.sound.title')}`}>
      <View style={styles.settings}>
        <SettingRow label={t('together.sound.withTimer')} hint={t('together.sound.withTimerHint')} value={withTimer} onChange={setWithTimer} />
        <SettingRow
          label={t('together.sound.duringBreak')}
          hint={t('together.sound.duringBreakHint')}
          value={duringBreak}
          onChange={setDuringBreak}
        />
      </View>
      <MixerPanel />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  settings: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: palette.cream, borderWidth: 2, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
