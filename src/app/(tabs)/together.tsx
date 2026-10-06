import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen, SegmentedControl } from '@/components/ui';
import { MAP_SCOPE } from '@/config/locale';
import { MixerPanel } from '@/features/sound/MixerPanel';
import { GlobalReadersPlaceholder } from '@/features/together/GlobalReadersPlaceholder';
import { KoreaLiveMap } from '@/features/together/KoreaLiveMap';
import { RoomList } from '@/features/together/RoomList';
import { TimerPanel } from '@/features/together/TimerPanel';

type Section = 'timer' | 'sound' | 'map' | 'rooms';

/** 함께 읽기: focus timer, white-noise mixer, live readers map and theme reading rooms. */
export default function TogetherScreen() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('timer');
  return (
    <Screen title={t('together.title')} subtitle={t('together.subtitle')}>
      <View style={styles.switcher}>
        <SegmentedControl<Section>
          value={section}
          onChange={setSection}
          options={[
            { value: 'timer', label: `⏱️ ${t('together.tabs.timer')}` },
            { value: 'sound', label: `🎧 ${t('together.tabs.sound')}` },
            { value: 'map', label: `🗺️ ${t('together.tabs.map')}` },
            { value: 'rooms', label: `🏠 ${t('together.tabs.rooms')}` },
          ]}
        />
      </View>
      {section === 'timer' ? <TimerPanel /> : null}
      {section === 'sound' ? <MixerPanel /> : null}
      {section === 'map' ? MAP_SCOPE === 'KR' ? <KoreaLiveMap /> : <GlobalReadersPlaceholder /> : null}
      {section === 'rooms' ? <RoomList /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { alignItems: 'center' },
});
