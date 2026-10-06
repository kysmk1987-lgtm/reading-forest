import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, showToast } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { tapFeedback } from '@/lib/feedback';
import { useMixerStore } from '@/stores/mixerStore';
import { palette, spacing } from '@/theme';

import { usePresenceStore } from './presence';
import { THEME_ROOMS, type ThemeRoom } from './rooms';
import { RoomScene } from './RoomScene';

export function RoomList() {
  const { t } = useTranslation();
  const { isPremium } = useEntitlements();
  const peers = usePresenceStore((s) => s.peers);
  const enterRoomMix = useMixerStore((s) => s.enterRoomMix);
  const byRoom = useMemo(() => {
    const m = new Map<string, number>();
    peers.forEach((p) => p.room && m.set(p.room, (m.get(p.room) ?? 0) + 1));
    return m;
  }, [peers]);

  const enter = async (room: ThemeRoom) => {
    if (room.premium && !isPremium) {
      showToast(t('together.rooms.locked'));
      return;
    }
    tapFeedback('medium');
    // Start the room's sound mix inside the tap so browsers allow audio.
    await enterRoomMix(room.mix);
    router.push({ pathname: '/room/[id]', params: { id: room.id } });
  };

  return (
    <View style={styles.root}>
      <AppText variant="caption" muted>
        {t('together.rooms.body')}
      </AppText>
      {THEME_ROOMS.map((room) => {
        const locked = room.premium && !isPremium;
        const count = byRoom.get(room.id) ?? 0;
        return (
          <Pressable key={room.id} accessibilityRole="button" accessibilityLabel={t(`together.rooms.${room.id}.name`)} onPress={() => enter(room)}>
            {({ pressed }) => (
              <Card padded={false} style={[styles.card, pressed && { transform: [{ scale: 0.98 }] }]}>
                <View style={[styles.preview, locked && styles.locked]}>
                  <RoomScene room={room} peers={[]} height={120} />
                </View>
                <View style={styles.info}>
                  <AppText style={styles.emoji}>{room.emoji}</AppText>
                  <View style={styles.flex}>
                    <AppText variant="subtitle">{t(`together.rooms.${room.id}.name`)}</AppText>
                    <AppText variant="caption" muted numberOfLines={1}>
                      {t(`together.rooms.${room.id}.desc`)}
                    </AppText>
                  </View>
                  <AppText variant="tiny" color={locked ? palette.yellowDeep : palette.leafDeep}>
                    {locked ? `🔒 ${t('together.mixer.premium')}` : t('together.rooms.count', { count })}
                  </AppText>
                </View>
              </Card>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  card: { overflow: 'hidden' },
  preview: { height: 120 },
  locked: { opacity: 0.55 },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  emoji: { fontSize: 26, lineHeight: 32 },
  flex: { flex: 1 },
});
