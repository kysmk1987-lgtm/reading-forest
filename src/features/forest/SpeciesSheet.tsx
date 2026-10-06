import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Sheet, showToast } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { colors, palette, radius, spacing } from '@/theme';
import { TREE_SPECIES_IDS, type TreeSpeciesId } from '@/types';

import { TREE_SPECIES } from './species';
import { TreeGraphic } from './TreeGraphic';

/** Pick a tree species for one book; premium species are shown but locked for free users. */
export function SpeciesSheet({ entryId, current, onClose }: { entryId: string | null; current?: TreeSpeciesId; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useEntitlements();
  const updateEntry = useLibraryStore((s) => s.updateEntry);
  const unlocked = can('premiumTrees');

  const choose = (id: TreeSpeciesId) => {
    if (!entryId) return;
    if (TREE_SPECIES[id].premium && !unlocked) {
      showToast(t('forest.premiumLocked'));
      return;
    }
    tapFeedback();
    updateEntry(entryId, { treeSpecies: id });
    onClose();
  };

  return (
    <Sheet visible={!!entryId} onClose={onClose} title={t('forest.speciesTitle')}>
      <AppText variant="caption" muted center>
        {t('forest.speciesHint')}
      </AppText>
      <View style={styles.grid}>
        {TREE_SPECIES_IDS.map((id) => {
          const sp = TREE_SPECIES[id];
          const locked = sp.premium && !unlocked;
          const active = current === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: locked }}
              accessibilityLabel={t(`species.${id}`)}
              onPress={() => choose(id)}
              style={[styles.cell, active && styles.cellActive, locked && styles.cellLocked]}>
              <View style={locked ? styles.dim : undefined}>
                <TreeGraphic stage="bloom" species={id} size={76} />
              </View>
              <AppText variant="caption">{t(`species.${id}`)}</AppText>
              {sp.premium ? (
                <View style={[styles.badge, locked ? styles.badgeLocked : styles.badgeOpen]}>
                  <AppText variant="tiny" color={locked ? colors.textMuted : colors.text}>
                    {locked ? `🔒 ${t('my.premium')}` : `👑 ${t('my.premium')}`}
                  </AppText>
                </View>
              ) : (
                <AppText variant="tiny" muted>
                  {t('forest.basic')}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  cell: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 2,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
    backgroundColor: colors.surface,
  },
  cellActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cellLocked: { backgroundColor: palette.stoneSoft },
  dim: { opacity: 0.45 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill },
  badgeLocked: { backgroundColor: palette.stoneSoft, borderWidth: 1, borderColor: palette.stone },
  badgeOpen: { backgroundColor: palette.yellow },
});
