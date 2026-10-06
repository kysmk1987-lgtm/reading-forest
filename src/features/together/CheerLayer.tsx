import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { palette, radius, softShadow, spacing } from '@/theme';

import { usePresenceStore, type IncomingCheer } from './presence';
import { regionName } from './regions';

const useNativeDriver = Platform.OS !== 'web';

function FloatingCheer({ cheer, onDone }: { cheer: IncomingCheer; onDone: () => void }) {
  const { t } = useTranslation();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    tapFeedback();
    const run = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver }),
      Animated.delay(2600),
      Animated.timing(anim, { toValue: 2, duration: 700, useNativeDriver }),
    ]);
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [anim, onDone]);
  const translateY = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [24, 0, -36] });
  const opacity = anim.interpolate({ inputRange: [0, 1, 1.6, 2], outputRange: [0, 1, 1, 0] });
  const emojiY = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [10, -6, -40] });
  const from = cheer.from ? regionName(cheer.from) : t('together.map.somewhere');
  return (
    <Animated.View style={[styles.cheer, { opacity, transform: [{ translateY }] }]} accessibilityLiveRegion="polite">
      <Animated.Text style={[styles.bigEmoji, { transform: [{ translateY: emojiY }] }]}>{cheer.emoji}</Animated.Text>
      <AppText variant="caption" center>
        {t('together.map.cheerArrived', { region: from, emoji: cheer.emoji })}
      </AppText>
    </Animated.View>
  );
}

/** Gentle floating notice when another reader cheers your region. Mount once at the root. */
export function CheerLayer() {
  const cheers = usePresenceStore((s) => s.cheers);
  const drop = usePresenceStore((s) => s.dropCheer);
  const insets = useSafeAreaInsets();
  if (!cheers.length) return null;
  return (
    <View style={[styles.layer, { top: insets.top + 70 }]}>
      {cheers.map((c) => (
        <FloatingCheer key={c.id} cheer={c} onDone={() => drop(c.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { pointerEvents: 'none', position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing.sm, zIndex: 999 },
  cheer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: palette.leafSoft,
    ...softShadow(),
  },
  bigEmoji: { position: 'absolute', top: -18, fontSize: 30 },
});
