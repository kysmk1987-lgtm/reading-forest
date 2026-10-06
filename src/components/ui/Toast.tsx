import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, softShadow, spacing } from '@/theme';

import { AppText } from './AppText';

interface ToastState {
  message: string | null;
  key: number;
  show: (message: string) => void;
  hide: () => void;
}

const useToastStore = create<ToastState>()((set) => ({
  message: null,
  key: 0,
  show: (message) => set((s) => ({ message, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

/** Non-blocking notice (web `alert()` would block the page). */
export function showToast(message: string) {
  useToastStore.getState().show(message);
}

/** Mount once near the root. */
export function ToastHost() {
  const { message, key, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    const useNativeDriver = Platform.OS !== 'web';
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver }),
    ]);
    anim.start(({ finished }) => finished && hide());
    return () => anim.stop();
  }, [message, key, opacity, hide]);

  if (!message) return null;
  return (
    <Animated.View style={[styles.toast, { top: insets.top + spacing.lg, opacity }]} accessibilityLiveRegion="polite">
      <AppText variant="caption" center color={colors.surface}>
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    pointerEvents: 'none',
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(91,70,54,0.92)',
    zIndex: 1000,
    ...softShadow(),
  },
});
