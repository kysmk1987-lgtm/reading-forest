import { router } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Sheet, showToast } from '@/components/ui';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import { useForestStore } from '@/stores/forestStore';
import { useProfileStore } from '@/stores/profileStore';
import { palette, radius, spacing } from '@/theme';

import { DEMO_FOREST_ID } from './demo';
import type { ForestTree } from './model';
import { publishForest } from './publicForest';
import { absoluteUrl, forestPath, shareLink } from './share';

export function ShareForestSheet({ visible, onClose, trees }: { visible: boolean; onClose: () => void; trees: ForestTree[] }) {
  const { t } = useTranslation();
  const nickname = useProfileStore((s) => s.nickname);
  const localForestId = useForestStore((s) => s.localForestId);
  const [busy, setBusy] = useState(false);

  const share = async (path: string) => {
    const result = await shareLink(absoluteUrl(path), t('forest.shareTitle', { name: nickname }), t('forest.shareMessage'));
    if (result === 'copied') showToast(t('forest.linkCopied'));
    else if (result === 'failed') showToast(t('forest.shareFailed'));
  };

  const publishAndShare = async () => {
    const fb = getFirebase();
    if (!fb) return;
    setBusy(true);
    try {
      const user = fb.auth.currentUser ?? (await signInAnonymously(fb.auth)).user;
      await publishForest(user.uid, { nickname, trees });
      await share(forestPath(user.uid));
      onClose();
    } catch (err) {
      console.warn('[forest] publish failed', err);
      showToast(t('forest.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('forest.shareSheetTitle')}>
      {isFirebaseConfigured ? (
        <>
          <AppText center muted>
            {t('forest.shareBody')}
          </AppText>
          <Button label={t('forest.shareCta')} loading={busy} fullWidth onPress={publishAndShare} />
        </>
      ) : (
        <>
          <View style={styles.notice}>
            <AppText style={styles.noticeEmoji}>☁️</AppText>
            <AppText variant="subtitle" center>
              {t('forest.firebaseNotice')}
            </AppText>
            <AppText variant="caption" muted center>
              {t('forest.firebaseNoticeBody')}
            </AppText>
          </View>
          <Button label={t('forest.previewMine')} fullWidth onPress={() => go(forestPath(localForestId))} />
          <Button label={t('forest.viewDemo')} variant="sky" fullWidth onPress={() => go(forestPath(DEMO_FOREST_ID))} />
          <Button label={t('forest.copyDemo')} variant="soft" fullWidth onPress={() => share(forestPath(DEMO_FOREST_ID))} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.skySoft,
  },
  noticeEmoji: { fontSize: 32, lineHeight: 40 },
});
