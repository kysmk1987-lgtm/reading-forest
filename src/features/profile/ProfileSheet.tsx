import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Input, Sheet, showToast } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { tapFeedback } from '@/lib/feedback';
import { FOREST_NAME_MAX, useProfileStore } from '@/stores/profileStore';
import { colors, palette, radius, spacing } from '@/theme';

import { AvatarPortrait } from './AvatarArt';
import { AVATAR_IDS, AVATARS, effectiveAvatar, type AvatarId } from './avatars';

/** 프로필 수정: character, nickname and forest name in one sheet (saved together). */
export function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useEntitlements();
  const unlocked = can('premiumTrees');
  const profile = useProfileStore();
  const [nickname, setNickname] = useState(profile.nickname);
  const [forestName, setForestName] = useState(profile.forestName);
  const [avatar, setAvatar] = useState<AvatarId>(effectiveAvatar(profile.avatar, unlocked));
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setNickname(profile.nickname);
      setForestName(profile.forestName);
      setAvatar(effectiveAvatar(profile.avatar, unlocked));
    }
  }

  const choose = (id: AvatarId) => {
    if (AVATARS[id].premium && !unlocked) {
      showToast(t('my.avatarLocked'));
      return;
    }
    tapFeedback();
    setAvatar(id);
  };

  const save = () => {
    profile.setNickname(nickname);
    profile.setForestName(forestName);
    profile.setAvatar(avatar);
    showToast(t('my.profileSaved'));
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('my.profileTitle')} footer={<Button label={t('common.save')} fullWidth onPress={save} />}>
      <View style={styles.section}>
        <AppText variant="subtitle">{t('my.avatarTitle')}</AppText>
        <AppText variant="caption" muted>
          {t('my.avatarHint')}
        </AppText>
        <View style={styles.grid}>
          {AVATAR_IDS.map((id) => {
            const def = AVATARS[id];
            const locked = def.premium && !unlocked;
            const active = avatar === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={t(`my.avatars.${id}`)}
                accessibilityState={{ selected: active, disabled: locked }}
                onPress={() => choose(id)}
                style={[styles.cell, active && styles.cellActive, locked && styles.cellLocked]}>
                <View style={locked ? styles.dim : undefined}>
                  <AvatarPortrait id={id} size={54} />
                </View>
                <AppText variant="tiny" numberOfLines={1}>
                  {t(`my.avatars.${id}`)}
                </AppText>
                {def.premium ? (
                  <View style={[styles.badge, locked ? styles.badgeLocked : styles.badgeOpen]}>
                    <AppText variant="tiny" color={locked ? colors.textMuted : colors.text}>
                      {locked ? '🔒' : '👑'}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      <Input label={t('my.nickname')} value={nickname} onChangeText={setNickname} maxLength={16} showCounter placeholder={t('my.nicknamePlaceholder')} />
      <View style={styles.section}>
        <Input
          label={t('my.forestName')}
          value={forestName}
          onChangeText={setForestName}
          maxLength={FOREST_NAME_MAX}
          showCounter
          placeholder={t('my.forestNamePlaceholder')}
          onSubmitEditing={save}
        />
        <AppText variant="tiny" muted>
          {t('my.forestNameHint')}
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.xs },
  cell: {
    width: '22%',
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: spacing.xs,
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
  badge: { position: 'absolute', top: 4, right: 4, paddingHorizontal: 4, borderRadius: radius.pill },
  badgeLocked: { backgroundColor: palette.stoneSoft, borderWidth: 1, borderColor: palette.stone },
  badgeOpen: { backgroundColor: palette.yellow },
});
