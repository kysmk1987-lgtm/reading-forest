import { router, useRootNavigationState, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { tapFeedback } from '@/lib/feedback';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { colors, palette, radius, softShadow, spacing } from '@/theme';

import { BannerAdPlaceholder } from './BannerAdPlaceholder';

export const TAB_ICONS: Record<string, string> = {
  index: '🌳',
  library: '📚',
  records: '📅',
  together: '🕯️',
  my: '🌼',
};

const TAB_HREFS: Record<string, Href> = {
  index: '/',
  library: '/library',
  records: '/records',
  together: '/together',
  my: '/my',
};

const isMainTab = (name: string) => name in TAB_ICONS;

interface TabItem {
  key: string;
  name: string;
  label: string;
}

/**
 * Wooden-plank tab bar with puffy bubbles; hosts the free-tier banner slot above it.
 * Steps aside while the on-screen keyboard is open so it never covers inputs or the buttons under them.
 */
function TabBarView({ tabs, activeKey, onPress }: { tabs: TabItem[]; activeKey: string | undefined; onPress: (tab: TabItem) => void }) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardVisible();
  if (keyboardOpen) return null;
  return (
    <View style={styles.outer}>
      <BannerAdPlaceholder />
      <View style={[styles.bar, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {tabs.map((tab) => {
          const focused = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              aria-selected={focused}
              accessibilityLabel={tab.label}
              onPress={() => onPress(tab)}
              style={styles.tab}>
              {({ pressed }) => (
                <>
                  <View style={[styles.bubble, focused && styles.bubbleActive, pressed && { transform: [{ scale: 0.9 }] }]}>
                    <AppText style={styles.icon}>{TAB_ICONS[tab.name] ?? '🍃'}</AppText>
                  </View>
                  <AppText variant="tiny" color={focused ? colors.primaryDeep : colors.textMuted}>
                    {tab.label}
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

export function ForestTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  // Hidden tabs (e.g. the gallery) keep the tab the user came from highlighted.
  const current = state.routes[state.index];
  const activeKey = isMainTab(current.name)
    ? current.key
    : ([...state.history].reverse().find((h) => h.type === 'route' && state.routes.some((r) => r.key === h.key && isMainTab(r.name)))?.key ??
      state.routes[0].key);
  const tabs = state.routes
    .filter((route) => isMainTab(route.name))
    .map((route) => {
      const { options } = descriptors[route.key];
      return { key: route.key, name: route.name, label: typeof options.title === 'string' ? options.title : route.name };
    });
  return (
    <TabBarView
      tabs={tabs}
      activeKey={activeKey}
      onPress={(tab) => {
        const route = state.routes.find((r) => r.key === tab.key)!;
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (route.key !== current.key && !event.defaultPrevented) {
          tapFeedback();
          navigation.navigate(route.name, route.params);
        }
      }}
    />
  );
}

interface NavRoute {
  key: string;
  name: string;
  params?: object;
  state?: NavState;
}
interface NavState {
  index?: number;
  routes: NavRoute[];
  history?: { type: string; key?: string }[];
}

/** The main tab focused in the topmost `(tabs)` group still mounted below the current screen. */
function originTab(state: NavState | undefined): string | undefined {
  if (!state) return undefined;
  for (let i = state.routes.length - 1; i >= 0; i--) {
    const route = state.routes[i];
    if (route.name === '(tabs)') {
      const tabs = route.state;
      if (!tabs) {
        const screen = (route.params as { screen?: string } | undefined)?.screen;
        return screen && isMainTab(screen) ? screen : 'index';
      }
      const current = tabs.routes[tabs.index ?? 0];
      if (current && isMainTab(current.name)) return current.name;
      const key = [...(tabs.history ?? [])].reverse().find((h) => h.type === 'route' && tabs.routes.some((r) => r.key === h.key && isMainTab(r.name)))?.key;
      return tabs.routes.find((r) => r.key === key)?.name ?? 'index';
    }
    const nested = originTab(route.state);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * The same tab bar + banner for secondary screens in the root Stack (search, book detail, …), so they can keep
 * their own back stack. A tab press returns to the existing tab group (`dismissTo`) instead of stacking a new one.
 */
export function StackTabBar() {
  const { t } = useTranslation();
  const origin = originTab(useRootNavigationState() as unknown as NavState);
  const tabs: TabItem[] = [
    { key: 'index', name: 'index', label: t('tabs.home') },
    { key: 'library', name: 'library', label: t('tabs.library') },
    { key: 'records', name: 'records', label: t('tabs.records') },
    { key: 'together', name: 'together', label: t('tabs.together') },
    { key: 'my', name: 'my', label: t('tabs.my') },
  ];
  return (
    <TabBarView
      tabs={tabs}
      activeKey={origin}
      onPress={(tab) => {
        tapFeedback();
        router.dismissTo(TAB_HREFS[tab.name]);
      }}
    />
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
