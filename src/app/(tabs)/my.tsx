import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Card, Chip, Screen, SegmentedControl, showToast } from '@/components/ui';
import { ENABLED_LOCALES, isLanguagePickerEnabled, LOCALE_LABELS } from '@/config/locale';
import { useAuthActions, type AuthErrorCode } from '@/features/auth/useAuth';
import { STATUS_META } from '@/features/library/statusMeta';
import { AvatarPortrait } from '@/features/profile/AvatarArt';
import { effectiveAvatar } from '@/features/profile/avatars';
import { ProfileSheet } from '@/features/profile/ProfileSheet';
import { REGIONS, regionName } from '@/features/together/regions';
import { hideMyReviews, isReviewsConfigured } from '@/features/reviews/api';
import { confirmAsync, notify } from '@/lib/confirm';
import { useEntitlements, useEntitlementsStore } from '@/lib/entitlements';
import { tapFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore, type AppLanguage, type ReviewVisibility } from '@/stores/settingsStore';
import { useTogetherStore } from '@/stores/togetherStore';
import { colors, palette, radius, spacing } from '@/theme';
import { READING_STATUSES } from '@/types';

export default function MyScreen() {
  const { t } = useTranslation();
  const profile = useProfileStore();
  const entriesMap = useLibraryStore((s) => s.entries);
  const { isPremium } = useEntitlements();
  const setPremium = useEntitlementsStore((s) => s.setPremium);
  const settings = useSettingsStore();
  const auth = useAuthActions();
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = () => {
    tapFeedback();
    setProfileOpen(true);
  };

  const counts = useMemo(() => {
    const c = { read: 0, reading: 0, want: 0, stopped: 0 };
    Object.values(entriesMap).forEach((e) => c[e.status]++);
    return c;
  }, [entriesMap]);

  const handleAuthResult = (code: AuthErrorCode | null) => {
    if (code === 'failed') notify(t('my.authError'));
  };

  const accountLabel = t(`my.account.${profile.authMode}`);
  const signedIn = profile.authMode !== 'guest' && profile.authMode !== 'anonymous';

  const changeVisibility = async (next: ReviewVisibility) => {
    tapFeedback();
    if (next === settings.reviewVisibility) return;
    settings.setReviewVisibility(next);
    if (next === 'private' && isReviewsConfigured()) {
      const ok = await confirmAsync(t('my.reviewVisibility'), t('my.reviewHideExisting'), t('my.reviewHideConfirm'), t('common.cancel'));
      if (ok) showToast((await hideMyReviews()) ? t('my.reviewHidden') : t('reviews.failed'));
    }
  };

  return (
    <Screen title={t('my.title')}>
      <Card style={styles.profile}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('my.editProfile')} onPress={openProfile} style={styles.avatar}>
          <AvatarPortrait id={effectiveAvatar(profile.avatar, isPremium)} size={62} />
        </Pressable>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <AppText variant="title" numberOfLines={1} style={styles.flex}>
              {profile.nickname}
            </AppText>
            <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
              <AppText variant="tiny" color={isPremium ? colors.text : colors.textMuted}>
                {isPremium ? `👑 ${t('my.premium')}` : t('my.free')}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" muted numberOfLines={1}>
            🌳 {profile.forestName || t('forest.myForest')}
          </AppText>
          <AppText variant="caption" muted>
            {accountLabel}
            {profile.email ? ` · ${profile.email}` : ''}
          </AppText>
        </View>
      </Card>

      <View style={styles.row}>
        <Button size="sm" variant="soft" label={`✏️ ${t('my.editProfile')}`} onPress={openProfile} />
        {auth.isSupabaseConfigured && profile.authMode !== 'guest' ? (
          <Button
            size="sm"
            variant="soft"
            label={t('my.signOut')}
            loading={auth.pending === 'signOut'}
            onPress={async () => handleAuthResult(await auth.signOut())}
          />
        ) : null}
      </View>
      {auth.isSupabaseConfigured && !signedIn ? (
        <Card style={styles.section}>
          <AppText variant="subtitle">{t('my.loginTitle')}</AppText>
          <AppText variant="caption" muted>
            {profile.authMode === 'anonymous' ? t('my.anonymousHint') : t('my.loginBody')}
          </AppText>
          <Button
            label={t('my.signInKakao')}
            variant="wood"
            fullWidth
            loading={auth.pending === 'kakao'}
            onPress={async () => handleAuthResult(await auth.signInKakao())}
          />
          <Button
            label={t('my.signInGoogle')}
            variant="soft"
            fullWidth
            loading={auth.pending === 'google'}
            onPress={async () => handleAuthResult(await auth.signInGoogle())}
          />
          {profile.authMode === 'guest' ? (
            <Button
              label={t('my.signInAnonymous')}
              variant="sky"
              fullWidth
              loading={auth.pending === 'anonymous'}
              onPress={async () => handleAuthResult(await auth.signInAnon())}
            />
          ) : null}
        </Card>
      ) : null}
      {!auth.isSupabaseConfigured ? (
        <AppText variant="caption" muted>
          ☁️ {t('my.serverOff')} · {t('my.guestHint')}
        </AppText>
      ) : null}

      <View style={styles.section}>
        <AppText variant="subtitle">{t('my.stats')}</AppText>
        <View style={styles.statRow}>
          {READING_STATUSES.map((s) => (
            <View key={s} style={[styles.stat, { backgroundColor: STATUS_META[s].soft }]}>
              <AppText style={styles.statEmoji}>{STATUS_META[s].emoji}</AppText>
              <AppText variant="number">{counts[s]}</AppText>
              <AppText variant="tiny" muted numberOfLines={1}>
                {t(`status.${s}`)}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <Card tint={palette.yellowSoft} edgeColor={palette.yellowDeep} style={styles.premium}>
        <View style={styles.nameRow}>
          <AppText style={styles.crown}>👑</AppText>
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('my.premiumTitle')}</AppText>
            <AppText variant="caption" muted>
              {t('my.premiumBody')}
            </AppText>
          </View>
        </View>
        <Button label={t('my.premiumCta')} variant="wood" fullWidth disabled />
        <SettingRow label={t('my.premiumDevToggle')} value={isPremium} onChange={setPremium} />
      </Card>

      <Card tint={palette.pinkSoft} edgeColor={palette.pinkDeep} style={styles.section}>
        <Pressable
          accessibilityRole="button"
          style={styles.galleryCard}
          onPress={() => {
            tapFeedback();
            router.push('/gallery');
          }}>
          <AppText style={styles.crown}>🖼️</AppText>
          <View style={styles.flex}>
            <AppText variant="subtitle">{t('gallery.title')}</AppText>
            <AppText variant="caption" muted>
              {t('my.galleryTeaser')}
            </AppText>
          </View>
        </Pressable>
        <View style={[styles.row, styles.center]}>
          <Button size="sm" variant="soft" label={`🔖 ${t('my.myScraps')}`} onPress={() => router.push({ pathname: '/gallery', params: { tab: 'scraps' } })} />
          <Button size="sm" variant="soft" label={`🗂️ ${t('my.myCards')}`} onPress={() => router.push({ pathname: '/gallery', params: { tab: 'mine' } })} />
          <Button size="sm" label={`✍️ ${t('gallery.make')}`} onPress={() => router.push('/card/new')} />
        </View>
      </Card>

      <RegionSetting />

      <Card style={styles.section}>
        <AppText variant="subtitle">{t('my.settings')}</AppText>
        {isLanguagePickerEnabled ? (
          <View style={styles.settingRow}>
            <AppText>{t('my.language')}</AppText>
            <SegmentedControl<AppLanguage | 'system'>
              value={settings.language && ENABLED_LOCALES.includes(settings.language) ? settings.language : 'system'}
              onChange={(v) => settings.setLanguage(v === 'system' ? null : v)}
              options={[
                { value: 'system', label: t('my.languageSystem') },
                ...ENABLED_LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] })),
              ]}
            />
          </View>
        ) : null}
        <SettingRow label={t('my.sound')} value={settings.soundEnabled} onChange={settings.setSoundEnabled} />
        <View style={styles.visibility}>
          <View style={styles.settingRow}>
            <AppText style={styles.flex}>{t('my.reviewVisibility')}</AppText>
            <SegmentedControl<ReviewVisibility>
              value={settings.reviewVisibility}
              onChange={changeVisibility}
              options={[
                { value: 'public', label: `🌏 ${t('my.reviewPublic')}` },
                { value: 'private', label: `🔒 ${t('my.reviewPrivate')}` },
              ]}
            />
          </View>
          <AppText variant="tiny" muted>
            {settings.reviewVisibility === 'public' ? t('my.reviewPublicHint') : t('my.reviewPrivateHint')}
          </AppText>
        </View>
        <SettingRow label={t('my.blurUnowned')} value={settings.blurUnownedQuotes} onChange={settings.setBlurUnownedQuotes} />
        <AppText variant="tiny" muted>
          {t('my.blurUnownedHint')}
        </AppText>
        <View style={styles.settingRow}>
          <AppText>{t('my.export')}</AppText>
          <AppText variant="caption" muted>
            {t('common.nextUpdate')}
          </AppText>
        </View>
        <View style={styles.settingRow}>
          <AppText>{t('my.version')}</AppText>
          <AppText variant="number" style={styles.version}>
            {Constants.expoConfig?.version ?? '0.1.0'}
          </AppText>
        </View>
      </Card>
      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </Screen>
  );
}

function RegionSetting() {
  const { t } = useTranslation();
  const detected = useTogetherStore((s) => s.detectedRegion);
  const override = useTogetherStore((s) => s.regionOverride);
  const setOverride = useTogetherStore((s) => s.setRegionOverride);
  return (
    <Card style={styles.section}>
      <AppText variant="subtitle">📍 {t('my.region')}</AppText>
      <AppText variant="caption" muted>
        {t('my.regionHint')}
      </AppText>
      <View style={styles.row}>
        <Chip
          label={detected ? t('my.regionAuto', { region: regionName(detected) }) : t('my.regionAutoUnknown')}
          selected={!override}
          onPress={() => setOverride(null)}
        />
        {REGIONS.map((r) => (
          <Chip key={r.key} label={r.name} selected={override === r.key} onPress={() => setOverride(r.key)} />
        ))}
      </View>
    </Card>
  );
}

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <AppText style={styles.flex}>{label}</AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        {...({ activeThumbColor: colors.surface } as object)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.woodSoft,
    borderWidth: 3,
    borderColor: palette.wood,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
  },
  planBadgePremium: { backgroundColor: palette.yellow },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  center: { justifyContent: 'center' },
  visibility: { gap: 2, paddingVertical: spacing.xs },
  section: { gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, gap: 2 },
  statEmoji: { fontSize: 18 },
  premium: { gap: spacing.md },
  galleryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  crown: { fontSize: 32 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  version: { color: colors.textMuted, fontSize: 14 },
  flex: { flex: 1 },
});
