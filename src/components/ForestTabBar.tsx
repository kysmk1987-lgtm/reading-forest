import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { colors, palette, radius, softShadow, spacing } from '@/theme';

import { BannerAdPlaceholder } from './BannerAdPlaceholder';

export const TAB_ICONS: Record<string, string> = {
  index: '🌳',
  library: '📚',
  timer: '⏰',
  gallery: '🖼️',
  my: '🌼',
};

/** Wooden-plank tab bar with puffy bubbles; hosts the free-tier banner slot above it. */
export function ForestTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.outer}>
      <BannerAdPlaceholder />
      <View style={[styles.bar, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  tapFeedback();
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={styles.tab}>
              {({ pressed }) => (
                <>
                  <View
                    style={[
                      styles.bubble,
                      focused && styles.bubbleActive,
                      pressed && { transform: [{ scale: 0.9 }] },
                    ]}>
                    <AppText style={styles.icon}>{TAB_ICONS[route.name] ?? '🍃'}</AppText>
                  </View>
                  <AppText variant="tiny" color={focused ? colors.primaryDeep : colors.textMuted}>
                    {label}
                  </AppText>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: palette.wood,
    ...softShadow(),
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  bubble: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    borderBottomWidth: 4,
  },
  icon: { fontSize: 20, lineHeight: 26 },
});
