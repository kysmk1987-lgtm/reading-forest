import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useEntitlements } from '@/lib/entitlements';
import { growFeedback } from '@/lib/feedback';
import { useCelebrationStore } from '@/stores/celebrationStore';
import { colors, palette, radius, spacing } from '@/theme';

import { TreeGraphic } from './TreeGraphic';
import { speciesOf } from './species';

const useNativeDriver = Platform.OS !== 'web';
const SPARKLES = ['✨', '🍃', '✨', '🌼', '✨', '🍃'];

/** "Your tree grew!" overlay with a grow animation, chime and haptic. Mount once at the root. */
export function GrowthCelebration() {
  const { t } = useTranslation();
  const current = useCelebrationStore((s) => s.current);
  const dismiss = useCelebrationStore((s) => s.dismiss);
  const { isPremium } = useEntitlements();
  const [grow] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!current) return;
    growFeedback();
    grow.setValue(0);
    burst.setValue(0);
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.delay(450),
        Animated.spring(grow, { toValue: 1, friction: 3.5, tension: 70, useNativeDriver }),
      ]),
      Animated.sequence([Animated.delay(500), Animated.timing(burst, { toValue: 1, duration: 900, useNativeDriver })]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [current, grow, burst]);

  if (!current) return null;
  const species = speciesOf(current.entry, isPremium);
  const oldOpacity = grow.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' });
  const newScale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel={t('a11y.close')} />
      <View style={styles.center}>
        <View style={styles.card}>
          <AppText variant="title" center>
            {t('forest.grewTitle')}
          </AppText>
          <View style={styles.stage}>
            {SPARKLES.map((s, i) => {
              const angle = (i / SPARKLES.length) * Math.PI * 2;
              const translateX = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 95] });
              const translateY = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 80 - 20] });
              const opacity = burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
              return (
                <Animated.Text key={i} style={[styles.sparkle, { opacity, transform: [{ translateX }, { translateY }] }]}>
                  {s}
                </Animated.Text>
              );
            })}
            <Animated.View style={[styles.layer, { opacity: oldOpacity }]}>
              <TreeGraphic stage={current.from} species={species} size={170} />
            </Animated.View>
            <Animated.View style={[styles.layer, styles.grow, { opacity: grow, transform: [{ scale: newScale }] }]}>
              <TreeGraphic stage={current.to} species={species} size={170} />
            </Animated.View>
          </View>
          <View style={styles.stagePill}>
            <AppText variant="caption" color={colors.primaryDeep}>
              {t(`growth.${current.from}`)} → {t(`growth.${current.to}`)}
            </AppText>
          </View>
          <AppText center numberOfLines={2}>
            {current.entry.book.title}
          </AppText>
          <AppText variant="caption" muted center>
            {current.to === 'bloom' ? t('forest.grewBloom') : t('forest.grewBody')}
          </AppText>
          <Button label={t('common.confirm')} fullWidth onPress={dismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  center: { pointerEvents: 'box-none', flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 6,
    borderBottomColor: palette.leafDeep,
  },
  stage: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute' },
  grow: { transformOrigin: '50% 92%' },
  sparkle: { position: 'absolute', fontSize: 22 },
  stagePill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
});
