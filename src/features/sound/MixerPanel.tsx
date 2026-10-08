import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, showToast } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { useMixerStore } from '@/stores/mixerStore';
import { palette, radius, spacing } from '@/theme';

import { AMBIENT_SOUNDS } from './ambient';
import { VolumeSlider } from './VolumeSlider';

export function MixerPanel() {
  const { t } = useTranslation();
  const { isPremium } = useEntitlements();
  const volumes = useMixerStore((s) => s.volumes);
  const roomMix = useMixerStore((s) => s.roomMix);
  const playing = useMixerStore((s) => s.playing);
  const setVolume = useMixerStore((s) => s.setVolume);
  const play = useMixerStore((s) => s.play);
  const stop = useMixerStore((s) => s.stop);
  const owner = useMixerStore((s) => s.owner);
  const setOwner = useMixerStore((s) => s.setOwner);
  const mix = roomMix ?? volumes;
  const anyOn = Object.values(mix).some((v) => (v ?? 0) > 0);
  const stopSound = () => {
    const timerOwned = owner === 'timer';
    stop();
    // Stopped by hand during a timer run: the timer leaves it off until the next 시작.
    if (timerOwned) setOwner('muted');
  };

  return (
    <View style={styles.root}>
      <Card tint={palette.skySoft} edgeColor={palette.sky} style={styles.hero}>
        <AppText style={styles.heroEmoji}>{playing ? '🎧' : '🔈'}</AppText>
        <View style={styles.flex}>
          <AppText variant="subtitle">{t('together.mixer.title')}</AppText>
          <AppText variant="caption" muted>
            {playing ? t('together.mixer.playing') : t('together.mixer.body')}
          </AppText>
        </View>
        <Button
          variant={playing ? 'soft' : 'sky'}
          label={playing ? `⏹ ${t('together.mixer.stop')}` : `▶ ${t('together.mixer.play')}`}
          disabled={!playing && !anyOn}
          onPress={async () => {
            if (playing) stopSound();
            else if (!(await play(owner === 'muted' ? 'timer' : 'user'))) showToast(t('together.mixer.blocked'));
          }}
        />
      </Card>

      {AMBIENT_SOUNDS.map((snd) => {
        const locked = snd.premium && !isPremium;
        const value = mix[snd.id] ?? 0;
        return (
          <View key={snd.id} style={[styles.row, value > 0 && !locked && styles.rowOn]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`together.sounds.${snd.id}`)}
              style={styles.label}
              onPress={() => {
                if (locked) showToast(t('together.mixer.locked'));
                else setVolume(snd.id, value > 0 ? 0 : 0.6);
              }}>
              <AppText style={styles.emoji}>{snd.emoji}</AppText>
              <View>
                <AppText variant="caption">{t(`together.sounds.${snd.id}`)}</AppText>
                {locked ? (
                  <AppText variant="tiny" color={palette.yellowDeep}>
                    🔒 {t('together.mixer.premium')}
                  </AppText>
                ) : (
                  <AppText variant="tiny" muted>
                    {value > 0 ? `${Math.round(value * 100)}%` : t('together.mixer.off')}
                  </AppText>
                )}
              </View>
            </Pressable>
            <VolumeSlider
              value={locked ? 0 : value}
              disabled={locked}
              accessibilityLabel={`${t(`together.sounds.${snd.id}`)} ${t('together.mixer.volume')}`}
              onChange={(v) => setVolume(snd.id, v < 0.03 ? 0 : v)}
            />
          </View>
        );
      })}
      <AppText variant="tiny" muted center>
        {t('together.mixer.credit')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  heroEmoji: { fontSize: 34, lineHeight: 42 },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowOn: { borderColor: palette.leafSoft },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: 118 },
  emoji: { fontSize: 24, lineHeight: 30 },
});
