import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Platform, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, IconButton, Screen, showToast } from '@/components/ui';
import { DEMO_FOREST, DEMO_FOREST_ID } from '@/features/forest/demo';
import { ForestGarden } from '@/features/forest/ForestGarden';
import { treeFromEntry, type ForestTree } from '@/features/forest/model';
import { fetchPublicForest, kstDay, waterForest, type PublicForest } from '@/features/forest/publicForest';
import { WaterDrops } from '@/features/forest/WaterDrops';
import { useEntitlements } from '@/lib/entitlements';
import { todayISO } from '@/lib/date';
import { waterFeedback } from '@/lib/feedback';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useForestStore } from '@/stores/forestStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { colors, palette, radius, spacing } from '@/theme';

const useNativeDriver = Platform.OS !== 'web';

interface ForestView {
  nickname: string;
  trees: ForestTree[];
  baseCount: number;
  mode: 'local' | 'remote';
}

/** Public, read-only forest that visitors can water once a day. */
export default function PublicForestScreen() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const forestId = String(slug ?? '');
  const { isPremium } = useEntitlements();
  const localForestId = useForestStore((s) => s.localForestId);
  const localWater = useForestStore((s) => s.waterings[forestId]);
  const waterLocal = useForestStore((s) => s.waterLocal);
  const myEntries = useLibraryStore((s) => s.entries);
  const myNickname = useProfileStore((s) => s.nickname);
  const queryClient = useQueryClient();
  const [dropsKey, setDropsKey] = useState(0);
  const [bump] = useState(() => new Animated.Value(1));
  const [gardenSize, setGardenSize] = useState({ width: 0, height: 0 });
  const [watering, setWatering] = useState(false);
  const [wateredRemote, setWateredRemote] = useState(false);

  const localView = useMemo<ForestView | null>(() => {
    if (forestId === DEMO_FOREST_ID) {
      return { nickname: DEMO_FOREST.nickname, trees: DEMO_FOREST.trees, baseCount: DEMO_FOREST.baseWaterCount, mode: 'local' };
    }
    if (forestId === localForestId) {
      const trees = Object.values(myEntries).map((e) => treeFromEntry(e, isPremium));
      return { nickname: myNickname, trees, baseCount: 0, mode: 'local' };
    }
    return null;
  }, [forestId, localForestId, myEntries, myNickname, isPremium]);

  const remote = useQuery({
    queryKey: ['publicForest', forestId],
    enabled: !localView && isFirebaseConfigured && !!forestId,
    queryFn: async () => {
      const [forest, count] = await Promise.all([fetchForest(forestId), countWaterings(forestId)]);
      return forest ? { ...forest, count } : null;
    },
  });

  const view: ForestView | null =
    localView ?? (remote.data ? { nickname: remote.data.nickname, trees: remote.data.trees, baseCount: remote.data.count, mode: 'remote' } : null);
  const count = view ? view.baseCount + (view.mode === 'local' ? (localWater?.count ?? 0) : 0) : 0;
  const wateredToday = view?.mode === 'local' ? localWater?.lastDay === todayISO() : wateredRemote;

  const celebrate = () => {
    waterFeedback();
    setDropsKey((k) => k + 1);
    bump.setValue(1.4);
    Animated.spring(bump, { toValue: 1, friction: 3, useNativeDriver }).start();
  };

  const water = async () => {
    if (!view || wateredToday) return;
    if (view.mode === 'local') {
      if (waterLocal(forestId, todayISO())) celebrate();
      return;
    }
    setWatering(true);
    const result = await waterForest(forestId);
    setWatering(false);
    if (result === 'ok') {
      celebrate();
      setWateredRemote(true);
      queryClient.setQueryData(['publicForest', forestId], (d: typeof remote.data) => (d ? { ...d, count: d.count + 1 } : d));
    } else if (result === 'already') {
      setWateredRemote(true);
      showToast(t('forest.alreadyWatered'));
    } else {
      showToast(t('forest.waterFailed'));
    }
  };

  const back = (
    <IconButton
      name="chevron-back"
      accessibilityLabel={t('common.back')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );

  if (!view) {
    return (
      <Screen title={t('forest.publicTitleFallback')} headerLeft={back}>
        {remote.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <EmptyState
            emoji="🌫️"
            title={t('forest.notFound')}
            body={isFirebaseConfigured ? t('forest.notFoundBody') : t('forest.firebaseNoticeBody')}
            action={<Button label={t('forest.viewDemo')} onPress={() => router.replace({ pathname: '/forest/[userId]', params: { userId: DEMO_FOREST_ID } })} />}
          />
        )}
      </Screen>
    );
  }

  const finished = view.trees.filter((tr) => tr.status === 'read').length;

  return (
    <Screen title={t('forest.publicTitle', { name: view.nickname })} subtitle={t('forest.publicSubtitle', { trees: view.trees.length, finished })} headerLeft={back}>
      {view.mode === 'local' ? (
        <View style={styles.demoPill}>
          <AppText variant="tiny" color={palette.skyDeep}>
            {forestId === DEMO_FOREST_ID ? t('forest.demoBadge') : t('forest.previewBadge')}
          </AppText>
        </View>
      ) : null}

      <Card tint={palette.skySoft} edgeColor={palette.sky} padded={false} style={styles.gardenCard}>
        <View onLayout={(e) => setGardenSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          <ForestGarden
            trees={view.trees}
            emptyLabel={t('forest.publicEmpty')}
            onOpenBook={(tree) => router.push({ pathname: '/book/[id]', params: { id: tree.bookId } })}
          />
          <WaterDrops runKey={dropsKey} width={gardenSize.width} height={gardenSize.height} />
        </View>
      </Card>

      <Card style={styles.waterCard}>
        <Animated.View style={[styles.countRow, { transform: [{ scale: bump }] }]}>
          <AppText style={styles.dropEmoji}>💧</AppText>
          <AppText variant="number" style={styles.count} accessibilityLabel="water-count">
            {count.toLocaleString()}
          </AppText>
        </Animated.View>
        <AppText variant="caption" muted center>
          {t('forest.waterCount', { name: view.nickname })}
        </AppText>
        <Button
          size="lg"
          variant="sky"
          fullWidth
          loading={watering}
          disabled={wateredToday}
          label={wateredToday ? t('forest.wateredToday') : t('forest.water')}
          onPress={water}
        />
        <AppText variant="tiny" muted center>
          {t('forest.waterRule', { day: view.mode === 'remote' ? utcDay() : todayISO() })}
        </AppText>
      </Card>

      <Button label={t('forest.makeMine')} variant="soft" fullWidth onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  demoPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.skySoft,
    borderWidth: 1.5,
    borderColor: palette.sky,
  },
  gardenCard: { overflow: 'hidden', paddingVertical: spacing.md },
  waterCard: { alignItems: 'center', gap: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dropEmoji: { fontSize: 28, lineHeight: 36 },
  count: { fontSize: 32, lineHeight: 38, color: palette.skyDeep },
});
