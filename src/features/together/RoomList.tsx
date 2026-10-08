import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, showToast } from '@/components/ui';
import { MAP_SCOPE } from '@/config/locale';
import { todayISO } from '@/lib/date';
import { useEntitlements } from '@/lib/entitlements';
import { tapFeedback } from '@/lib/feedback';
import { useMixerStore } from '@/stores/mixerStore';
import { useTimerStore } from '@/stores/timerStore';
import { palette, radius, spacing } from '@/theme';

import { GlobalReadersPlaceholder } from './GlobalReadersPlaceholder';
import { KoreaLiveMap } from './KoreaLiveMap';
import { buildLeaderboard, roomMinutesOn } from './leaderboard';
import { usePresenceStore } from './presence';
import { useNow, useRoomSummaries } from './roomRanking';
import { THEME_ROOMS, type ThemeRoom } from './rooms';
import { RoomScene } from './RoomScene';

/** 독서실: theme rooms ranked by today's reading minutes, with the nationwide live map folded in below. */
export function RoomList() {
  const { t } = useTranslation();
  const { isPremium } = useEntitlements();
  const peers = usePresenceStore((s) => s.peers);
  const mode = usePresenceStore((s) => s.mode);
  const history = useTimerStore((s) => s.history);
  const enterRoomMix = useMixerStore((s) => s.enterRoomMix);
  const summaries = useRoomSummaries();
  const [mapOpen, setMapOpen] = useState(false);
  const today = todayISO();

  const now = useNow(30_000);
  const byRoom = useMemo(() => {
    const m = new Map<string, { live: number; top: { nickname: string | null; minutes: number } | null }>();
    for (const room of THEME_ROOMS) {
      const here = peers.filter((p) => p.room === room.id);
      const liveTop = buildLeaderboard({ rows: [], peers: here, now })[0];
      const server = summaries?.[room.id];
      const top =
        server && (!liveTop || server.topMinutes >= liveTop.minutes)
          ? { nickname: server.topNickname, minutes: server.topMinutes }
          : liveTop && liveTop.minutes > 0
            ? { nickname: liveTop.nickname, minutes: liveTop.minutes }
            : null;
      m.set(room.id, { live: here.length, top });
    }
    return m;
  }, [peers, summaries, now]);
  const inRooms = peers.filter((p) => p.status === 'room').length;

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
      <Card tint={palette.yellowSoft} edgeColor={palette.yellow} style={styles.hero}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, mode === 'live' ? styles.badgeLive : mode === 'demo' ? styles.badgeDemo : null]}>
            <AppText variant="tiny" color={mode === 'live' ? palette.white : palette.brown}>
              {mode === 'live' ? `● ${t('together.map.live')}` : mode === 'demo' ? `🧪 ${t('together.map.demo')}` : t('together.map.connecting')}
            </AppText>
          </View>
        </View>
        <AppText variant="subtitle" accessibilityLabel="rooms-headline">
          🏆 {t('together.rooms.headline', { count: inRooms })}
        </AppText>
        <AppText variant="caption" muted>
          {t('together.rooms.body')}
        </AppText>
      </Card>

      {THEME_ROOMS.map((room) => {
        const locked = room.premium && !isPremium;
        const info = byRoom.get(room.id);
        const mine = roomMinutesOn(history, room.id, today);
        return (
          <Pressable key={room.id} accessibilityRole="button" accessibilityLabel={t(`together.rooms.${room.id}.name`)} onPress={() => enter(room)}>
            {({ pressed }) => (
              <Card padded={false} style={[styles.card, pressed && { transform: [{ scale: 0.98 }] }]}>
                <View style={[styles.preview, locked && styles.locked]}>
                  <RoomScene room={room} peers={[]} height={110} />
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
                    {locked ? `🔒 ${t('together.mixer.premium')}` : t('together.rooms.liveCount', { count: info?.live ?? 0 })}
                  </AppText>
                </View>
                {!locked ? (
                  <View style={styles.stats}>
                    <AppText variant="tiny" color={palette.brown} style={styles.flex} numberOfLines={1}>
                      {info?.top
                        ? `👑 ${t('together.rooms.topToday', { name: info.top.nickname ?? t('together.rooms.someone'), minutes: info.top.minutes })}`
                        : `🌱 ${t('together.rooms.beFirst')}`}
                    </AppText>
                    {mine > 0 ? (
                      <AppText variant="tiny" color={palette.leafDeep}>
                        {t('together.rooms.mineToday', { minutes: mine })}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            )}
          </Pressable>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: mapOpen }}
        accessibilityLabel={t('together.rooms.mapTitle')}
        onPress={() => {
          tapFeedback();
          setMapOpen((v) => !v);
        }}>
        <Card tint={palette.leafSoft} edgeColor={palette.leaf} style={styles.mapHeader}>
          <AppText style={styles.emoji}>🗺️</AppText>
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('together.rooms.mapTitle')}</AppText>
            <AppText variant="caption" muted>
              {t('together.map.headline', { count: peers.length })}
            </AppText>
          </View>
          <AppText variant="caption" color={palette.leafDeep}>
            {mapOpen ? t('together.rooms.mapClose') : t('together.rooms.mapOpen')}
          </AppText>
        </Card>
      </Pressable>
      {mapOpen ? MAP_SCOPE === 'KR' ? <KoreaLiveMap /> : <GlobalReadersPlaceholder /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  hero: { gap: 4 },
  badgeRow: { flexDirection: 'row' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: palette.sand },
  badgeLive: { backgroundColor: palette.leafDeep },
  badgeDemo: { backgroundColor: palette.yellow },
  card: { overflow: 'hidden' },
  preview: { height: 110 },
  locked: { opacity: 0.55 },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  emoji: { fontSize: 26, lineHeight: 32 },
  flex: { flex: 1 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
