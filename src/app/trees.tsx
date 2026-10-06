import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, IconButton, Screen } from '@/components/ui';
import { AnimatedTree } from '@/features/forest/AnimatedTree';
import { TREE_SPECIES } from '@/features/forest/species';
import { TreeGraphic } from '@/features/forest/TreeGraphic';
import { GROWTH_STAGES } from '@/features/library/growth';
import { useEntitlements } from '@/lib/entitlements';
import { colors, palette, radius, spacing } from '@/theme';
import { TREE_SPECIES_IDS } from '@/types';

/** 나무 도감: every species at every growth stage, plus the special looks. */
export default function TreeGuideScreen() {
  const { t } = useTranslation();
  const { can } = useEntitlements();
  return (
    <Screen
      title={t('trees.title')}
      subtitle={t('trees.subtitle')}
      headerLeft={
        <IconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      }>
      <Card tint={palette.skySoft} edgeColor={palette.sky} style={styles.stagesCard}>
        <AppText variant="subtitle">{t('trees.stagesTitle')}</AppText>
        <View style={styles.stageRow}>
          {GROWTH_STAGES.map(({ stage, minPercent }, i) => (
            <View key={stage} style={styles.stageCell}>
              <AnimatedTree stage={stage} species="apple" size={52} phaseMs={i * 300} />
              <AppText variant="tiny" center numberOfLines={1}>
                {t(`growth.${stage}`)}
              </AppText>
              <AppText variant="tiny" muted center>
                {stage === 'bloom' ? t('trees.finished') : `${minPercent}%+`}
              </AppText>
            </View>
          ))}
        </View>
        <View style={styles.specialRow}>
          <View style={styles.special}>
            <TreeGraphic stage="seed" species="round" variant="pot" size={48} />
            <AppText variant="tiny" muted>
              {t('status.want')} · {t('growth.pot')}
            </AppText>
          </View>
          <View style={styles.special}>
            <TreeGraphic stage="seed" species="round" variant="withered" size={48} />
            <AppText variant="tiny" muted>
              {t('status.stopped')} · {t('growth.stump')}
            </AppText>
          </View>
        </View>
      </Card>

      {TREE_SPECIES_IDS.map((id) => {
        const locked = TREE_SPECIES[id].premium && !can('premiumTrees');
        return (
          <Card key={id} style={styles.speciesCard}>
            <View style={styles.speciesHeader}>
              <AppText variant="subtitle">{t(`species.${id}`)}</AppText>
              <View style={[styles.badge, TREE_SPECIES[id].premium ? styles.badgePremium : styles.badgeBasic]}>
                <AppText variant="tiny" color={colors.text}>
                  {TREE_SPECIES[id].premium ? `${locked ? '🔒' : '👑'} ${t('my.premium')}` : t('forest.basic')}
                </AppText>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.stageRow, locked && styles.dim]}>
              {GROWTH_STAGES.filter((s) => s.stage !== 'seed' && s.stage !== 'sprout').map(({ stage }) => (
                <TreeGraphic key={stage} stage={stage} species={id} size={64} />
              ))}
            </ScrollView>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stagesCard: { gap: spacing.sm },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  stageCell: { flex: 1, alignItems: 'center' },
  specialRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  special: { alignItems: 'center' },
  speciesCard: { gap: spacing.xs, paddingVertical: spacing.md },
  speciesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  badgePremium: { backgroundColor: palette.yellowSoft },
  badgeBasic: { backgroundColor: palette.leafSoft },
  dim: { opacity: 0.5 },
});
