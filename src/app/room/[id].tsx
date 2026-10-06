import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, IconButton, Screen, showToast } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { useMixerStore } from '@/stores/mixerStore';
import { useTimerStore } from '@/stores/timerStore';
import { useTogetherStore } from '@/stores/togetherStore';
import { palette, spacing } from '@/theme';
import { usePresenceStore } from '@/features/together/presence';
import { roomById } from '@/features/together/rooms';
import { RoomScene } from '@/features/together/RoomScene';
import { TimerRing } from '@/features/together/TimerRing';

/** Theme reading room: illustrated scene, the room's sound mix, who's here (Presence) and a mini timer. */
export default function RoomScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const room = roomById(id);
  const { isPremium } = useEntitlements();
  const allowed = !!room && (!room.premium || isPremium);
  const setRoomId = useTogetherStore((s) => s.setRoomId);
  const peers = usePresenceStore((s) => s.peers);
  const mode = usePresenceStore((s) => s.mode);
  const playing = useMixerStore((s) => s.playing);
  const roomMix = useMixerStore((s) => s.roomMix);
  const enterRoomMix = useMixerStore((s) => s.enterRoomMix);
  const leaveRoomMix = useMixerStore((s) => s.leaveRoomMix);
  const timer = useTimerStore();

  useEffect(() => {
    if (!allowed || !room) return;
    setRoomId(room.id);
    return () => {
      setRoomId(null);
      leaveRoomMix();
    };
  }, [allowed, room, setRoomId, leaveRoomMix]);

  const here = useMemo(() => peers.filter((p) => p.room === room?.id), [peers, room?.id]);
  const back = <IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/together'))} />;

  if (!room || !allowed) {
    return (
      <Screen title={t('together.rooms.title')} headerLeft={back}>
        <EmptyState emoji="🔒" title={room ? t('together.rooms.locked') : t('together.rooms.notFound')} />
      </Screen>
    );
  }

  const soundOn = playing && !!roomMix;

  return (
    <Screen title={t(`together.rooms.${room.id}.name`)} subtitle={t(`together.rooms.${room.id}.desc`)} headerLeft={back}>
      <RoomScene room={room} peers={here} height={300} />
      <View style={styles.row}>
        <AppText variant="caption" muted style={styles.flex} accessibilityLabel="room-count">
          {mode === 'demo' ? t('together.rooms.demoHere', { count: here.length }) : t('together.rooms.here', { count: here.length })}
        </AppText>
        <Button
          size="sm"
          variant={soundOn ? 'soft' : 'sky'}
          label={soundOn ? `🔈 ${t('together.rooms.soundOff')}` : `🎧 ${t('together.rooms.soundOn')}`}
          onPress={async () => {
            if (soundOn) leaveRoomMix();
            else if (!(await enterRoomMix(room.mix))) showToast(t('together.mixer.blocked'));
          }}
        />
      </View>
      <Card tint={palette.cream} style={styles.timerCard}>
        <TimerRing size={132} label={timer.phase === 'focus' ? t('together.timer.focusLabel') : t('together.timer.breakLabel')} />
        <View style={styles.timerSide}>
          <AppText variant="subtitle">{t('together.rooms.miniTimer')}</AppText>
          <AppText variant="caption" muted>
            {t('together.timer.preset', { focus: timer.focusMin, break: timer.breakMin })}
          </AppText>
          {timer.status === 'running' ? (
            <Button variant="wood" label={`⏸ ${t('together.timer.pause')}`} onPress={timer.pause} />
          ) : (
            <Button
              label={timer.status === 'paused' ? `▶ ${t('together.timer.resume')}` : `▶ ${t('together.timer.start')}`}
              onPress={() => (timer.status === 'done' ? (timer.setPhase('focus'), timer.start()) : timer.start())}
            />
          )}
        </View>
      </Card>
      <AppText variant="tiny" muted center>
        {t('together.rooms.privacy')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  timerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  timerSide: { flex: 1, gap: spacing.xs },
});
