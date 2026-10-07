import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { ForestTabBar } from '@/components/ForestTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false }} backBehavior="history" tabBar={(props) => <ForestTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="library" options={{ title: t('tabs.library') }} />
      <Tabs.Screen name="records" options={{ title: t('tabs.records') }} />
      <Tabs.Screen name="together" options={{ title: t('tabs.together') }} />
      <Tabs.Screen name="my" options={{ title: t('tabs.my') }} />
      {/* Hidden tab so the tab bar and ad banner stay put while browsing the gallery (URL stays /gallery). */}
      <Tabs.Screen name="gallery" options={{ title: t('gallery.title'), href: null }} />
    </Tabs>
  );
}
