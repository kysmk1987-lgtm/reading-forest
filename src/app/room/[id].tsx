import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StackTabBar } from '@/components/ForestTabBar';
import { AppText, Button, Card, EmptyState, IconButton, Screen, showToast } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { useMixerStore } from '@/stores/mixerStore';
import { useTogetherStore } from '@/stores/togetherStore';
import { colors, palette, radius, spacing } from '@/theme';
import type { RankedReader } from '@/features/together/leaderboard';
import { usePresenceStore } from '@/features/together/presence';
import { useRoomLeaderboard } from '@/features/together/roomRanking';
import { roomById } from '@/features/together/rooms';
import { RoomScene } from '@/features/together/RoomScene';
import { PreAlertBanner, TimerControls } from '@/features/together/TimerControls';
import { TimerRing, useTimerClock } from '@/features/together/TimerRing';

const MEDALS = ['🥇', '🥈', '🥉'];

function ReaderRow({ reader }: { reader: RankedReader }) {
  const { t } = useTranslation();
  const state = !reader.live
    ? t('together.rooms.stateAway')
    : reader.phase === 'focus'
      ? `📖 ${t('together.rooms.stateReading')}`
      : reader.phase === 'break'
        ? `🍵 ${t('together.rooms.stateBreak')}`
        : reader.phase === 'paused'
          ? `⏸ ${t('together.rooms.statePaused')}`
          : `🌱 ${t('together.rooms.stateHere')}`;
  return (
    <View style={[styles.reader, reader.self && styles.readerSelf]} accessibilityLabel={`rank ${reader.rank} ${reader.nickname ?? ''} ${reader.minutes}`}>
      <AppText style={styles.rank}>{MEDALS[reader.rank - 1] ?? `${reader.rank}`}</AppText>
      <View style={styles.flex}>
        <AppText numberOfLines={1} color={reader.self ? palette.leafDeep : colors.text}>
          {reader.nickname ?? t('together.rooms.someone')}
          {reader.self ? ` (${t('together.rooms.me')})` : ''}
        </AppText>
        <AppText variant="tiny" muted>
          {state}
        </AppText>
      </View>
      <AppText variant="number" style={styles.minutes}>
        {t('together.rooms.minutes', { minutes: reader.minutes })}
      </AppText>
    </View>
  );
}

/** Theme reading room: who's reading here, today's ranking (friendly competition), the room's sound and the timer. */
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
  const { run, info } = useTimerClock();
  const { board, me, liveCount, server } = useRoomLeaderboard(room?.id ?? '');

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
      <Screen title={t('together.rooms.title')} headerLeft={back} footer={<StackTabBar />}>
        <EmptyState emoji="🔒" title={room ? t('together.rooms.locked') : t('together.rooms.notFound')} />
      </Screen>
    );
  }

  const soundOn = playing && !!roomMix;
  const leader = board[0];
  const gap = me && leader && !leader.self ? leader.minutes - me.minutes : 0;
  const myLine = !me
    ? t('together.rooms.notRanked')
    : me.rank === 1 && board.length > 1
      ? t('together.rooms.youLead')
      : me.rank === 1
        ? t('together.rooms.onlyYou')
        : gap > 0
          ? t('together.rooms.gapToFirst', { minutes: gap })
          : t('together.rooms.tiedFirst');
  const running = run.status === 'running';

  return (
    <Screen title={t(`together.rooms.${room.id}.name`)} subtitle={t(`together.rooms.${room.id}.desc`)} headerLeft={back} footer={<StackTabBar />}>
      <RoomScene room={room} peers={here} height={260} />
      <View style={styles.row}>
        <AppText variant="caption" muted style={styles.flex} accessibilityLabel="room-count">
          {mode === 'demo' ? t('together.rooms.demoHere', { count: liveCount }) : t('together.rooms.here', { count: liveCount })}
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

      <Card tint={palette.yellowSoft} edgeColor={palette.yellow} style={styles.myCard}>
        <AppText style={styles.myMedal}>{me ? (MEDALS[me.rank - 1] ?? '🏅') : '🌱'}</AppText>
        <View style={styles.flex}>
          <AppText variant="subtitle" accessibilityLabel="my-rank">
            {me ? t('together.rooms.myRank', { rank: me.rank, minutes: me.minutes }) : t('together.rooms.myRankNone')}
          </AppText>
          <AppText variant="caption" muted>
            {myLine}
          </AppText>
        </View>
      </Card>

      <Card tint={palette.cream} style={styles.timerCard}>
        <View style={styles.timerRow}>
          <TimerRing size={132} />
          <View style={styles.timerSide}>
            <AppText variant="subtitle">{t('together.rooms.miniTimer')}</AppText>
            <AppText variant="caption" muted>
              {running || run.status === 'paused'
                ? info.phase === 'focus'
                  ? t('together.rooms.timerCounting')
                  : t('together.rooms.timerBreak')
                : t('together.rooms.timerHint')}
            </AppText>
          </View>
        </View>
        <PreAlertBanner />
        <TimerControls compact />
      </Card>

      <Card style={styles.boardCard}>
        <AppText variant="subtitle">🏆 {t('together.rooms.boardTitle')}</AppText>
        {board.length ? (
          board.slice(0, 20).map((r) => <ReaderRow key={r.key} reader={r} />)
        ) : (
          <AppText variant="caption" muted>
            {t('together.rooms.boardEmpty')}
          </AppText>
        )}
        {me && me.rank > 20 ? <ReaderRow reader={me} /> : null}
        <AppText variant="tiny" muted>
          {mode === 'demo' ? t('together.rooms.boardDemo') : server ? t('together.rooms.boardServer') : t('together.rooms.boardLiveOnly')}
        </AppText>
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
  myCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  myMedal: { fontSize: 34, lineHeight: 42 },
  timerCard: { gap: spacing.md },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  timerSide: { flex: 1, gap: spacing.xs },
  boardCard: { gap: spacing.sm },
  reader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  readerSelf: { borderColor: palette.leaf, backgroundColor: palette.leafSoft },
  rank: { width: 30, textAlign: 'center', fontSize: 20, lineHeight: 26 },
  minutes: { fontSize: 18 },
});
