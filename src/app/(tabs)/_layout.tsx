import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { ForestTabBar } from '@/components/ForestTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ForestTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="library" options={{ title: t('tabs.library') }} />
      <Tabs.Screen name="timer" options={{ title: t('tabs.timer') }} />
      <Tabs.Screen name="gallery" options={{ title: t('tabs.gallery') }} />
      <Tabs.Screen name="my" options={{ title: t('tabs.my') }} />
    </Tabs>
  );
}
